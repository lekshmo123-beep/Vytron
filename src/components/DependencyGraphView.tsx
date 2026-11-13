import React, { useMemo, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Search } from 'lucide-react';
import type {
  ComponentRecord,
  DependencyEdge,
  SbomRecord,
  SeverityLevel,
  VulnerabilityMatch,
} from '../types/vytron.ts';
import { SeverityLabel } from './StatusText.tsx';

interface DependencyGraphViewProps {
  sboms: SbomRecord[];
  components: ComponentRecord[];
  dependencies: DependencyEdge[];
  vulnerabilities: VulnerabilityMatch[];
}

const SEV_COLOR: Record<SeverityLevel, string> = {
  Critical: '#DC2626',
  High: '#EA580C',
  Medium: '#D97706',
  Low: '#16A34A',
  Unknown: '#64748B',
};

const SEV_RANK: Record<SeverityLevel, number> = {
  Critical: 5,
  High: 4,
  Medium: 3,
  Low: 2,
  Unknown: 1,
};

export const DependencyGraphView: React.FC<DependencyGraphViewProps> = ({
  sboms,
  components,
  dependencies,
  vulnerabilities,
}) => {
  const [selectedSbomId, setSelectedSbomId] = useState<string>(sboms[0]?.id ?? 'all');
  const [searchQuery, setSearchQuery] = useState('');
  const [zoom, setZoom] = useState(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const activeSbomId =
    selectedSbomId === 'all' || sboms.some((s) => s.id === selectedSbomId)
      ? selectedSbomId
      : sboms[0]?.id ?? 'all';

  const filteredComponents = useMemo(() => {
    const base =
      activeSbomId === 'all'
        ? components
        : components.filter((c) => c.sbomId === activeSbomId);
    return base.slice(0, 60);
  }, [components, activeSbomId]);

  const compIdSet = useMemo(() => new Set(filteredComponents.map((c) => c.id)), [filteredComponents]);

  const filteredEdges = useMemo(
    () =>
      dependencies.filter(
        (d) => compIdSet.has(d.sourceComponentId) && compIdSet.has(d.targetComponentId)
      ),
    [dependencies, compIdSet]
  );

  const vulnByComponent = useMemo(() => {
    const map = new Map<string, VulnerabilityMatch[]>();
    for (const v of vulnerabilities) {
      const list = map.get(v.componentId) ?? [];
      list.push(v);
      map.set(v.componentId, list);
    }
    return map;
  }, [vulnerabilities]);

  // Layered hierarchical layout by dependencyDepth
  const layout = useMemo(() => {
    const layers = new Map<number, ComponentRecord[]>();
    for (const c of filteredComponents) {
      const depth = Math.min(4, Math.max(0, c.dependencyDepth));
      const arr = layers.get(depth) ?? [];
      arr.push(c);
      layers.set(depth, arr);
    }

    const sortedDepths = Array.from(layers.keys()).sort((a, b) => a - b);
    const width = Math.max(960, sortedDepths.length * 260);
    const maxPerLayer = Math.max(1, ...Array.from(layers.values()).map((l) => l.length));
    const height = Math.max(480, maxPerLayer * 84 + 80);

    const positions = new Map<string, { x: number; y: number }>();
    sortedDepths.forEach((depth, colIdx) => {
      const nodes = layers.get(depth) ?? [];
      const x = 130 + colIdx * 240;
      const spacing = height / (nodes.length + 1);
      nodes.forEach((node, rowIdx) => {
        positions.set(node.id, {
          x,
          y: spacing * (rowIdx + 1),
        });
      });
    });

    return { positions, width, height };
  }, [filteredComponents]);

  const selectedNode = filteredComponents.find((c) => c.id === selectedNodeId) ?? null;
  const selectedNodeVulns = selectedNode ? vulnByComponent.get(selectedNode.id) ?? [] : [];

  if (sboms.length === 0 || components.length === 0) {
    return (
      <div className="bg-[#0F1115] border border-[#222732] rounded-lg p-12 text-center">
        <h3 className="text-base font-semibold text-white">No Dependency Graph Data</h3>
        <p className="text-sm text-[#A1AAB8] mt-2 max-w-md mx-auto">
          Ingest a CycloneDX or SPDX SBOM in Software Inventory to render component dependency topology and vulnerability propagation paths.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0F1115] border border-[#222732] rounded-lg px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={activeSbomId}
            onChange={(e) => {
              setSelectedSbomId(e.target.value);
              setSelectedNodeId(null);
            }}
            className="px-3 py-1.5 text-xs bg-[#08090B] border border-[#222732] rounded text-white focus:outline-none focus:border-[#3B82F6]"
          >
            <option value="all">All Applications ({components.length} components)</option>
            {sboms.map((s) => (
              <option key={s.id} value={s.id}>
                {s.applicationName} ({s.format})
              </option>
            ))}
          </select>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#6B7484] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Highlight package..."
              className="pl-8 pr-3 py-1.5 text-xs bg-[#08090B] border border-[#222732] rounded text-white placeholder:text-[#6B7484] focus:outline-none focus:border-[#3B82F6]"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))}
            className="p-1.5 bg-[#161920] border border-[#222732] rounded text-[#A1AAB8] hover:text-white"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono tabular-nums text-[#A1AAB8] w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(1.8, +(z + 0.15).toFixed(2)))}
            className="p-1.5 bg-[#161920] border border-[#222732] rounded text-[#A1AAB8] hover:text-white"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setSearchQuery('');
              setSelectedNodeId(null);
            }}
            className="p-1.5 bg-[#161920] border border-[#222732] rounded text-[#A1AAB8] hover:text-white"
            title="Reset view"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Split: Graph Viewport + Node Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 bg-[#0B0D11] border border-[#222732] rounded-lg overflow-auto min-h-[500px] max-h-[620px] relative">
          <svg
            width={layout.width * zoom}
            height={layout.height * zoom}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            className="block"
          >
            <defs>
              <marker
                id="arrow-edge"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" fill="#334155" />
              </marker>
            </defs>

            {/* Edges */}
            {filteredEdges.map((edge) => {
              const p1 = layout.positions.get(edge.sourceComponentId);
              const p2 = layout.positions.get(edge.targetComponentId);
              if (!p1 || !p2) return null;
              const isHighlighted =
                selectedNodeId === edge.sourceComponentId ||
                selectedNodeId === edge.targetComponentId;
              const midX = (p1.x + p2.x) / 2;
              return (
                <path
                  key={edge.id}
                  d={`M ${p1.x + 86} ${p1.y} C ${midX} ${p1.y}, ${midX} ${p2.y}, ${p2.x - 86} ${p2.y}`}
                  fill="none"
                  stroke={isHighlighted ? '#3B82F6' : '#262C38'}
                  strokeWidth={isHighlighted ? 2 : 1.25}
                  markerEnd="url(#arrow-edge)"
                />
              );
            })}

            {/* Nodes */}
            {filteredComponents.map((comp) => {
              const pos = layout.positions.get(comp.id);
              if (!pos) return null;
              const nodeVulns = vulnByComponent.get(comp.id) ?? [];
              const maxSev = nodeVulns.reduce<SeverityLevel>(
                (best, v) => (SEV_RANK[v.severity] > SEV_RANK[best] ? v.severity : best),
                'Unknown'
              );
              const hasVuln = nodeVulns.length > 0;
              const isSelected = selectedNodeId === comp.id;
              const matchesSearch =
                searchQuery.trim() !== '' &&
                comp.name.toLowerCase().includes(searchQuery.trim().toLowerCase());

              const strokeColor = isSelected
                ? '#3B82F6'
                : matchesSearch
                ? '#FBBF24'
                : hasVuln
                ? SEV_COLOR[maxSev]
                : '#272D3A';

              return (
                <g
                  key={comp.id}
                  transform={`translate(${pos.x - 86}, ${pos.y - 24})`}
                  onClick={() => setSelectedNodeId(comp.id)}
                  className="cursor-pointer"
                >
                  <rect
                    width={172}
                    height={48}
                    rx={4}
                    fill={comp.isRoot ? '#151B26' : '#12151C'}
                    stroke={strokeColor}
                    strokeWidth={isSelected || matchesSearch ? 2 : 1.25}
                  />
                  {hasVuln && (
                    <rect
                      x={0}
                      y={0}
                      width={4}
                      height={48}
                      rx={1}
                      fill={SEV_COLOR[maxSev]}
                    />
                  )}
                  <text
                    x={12}
                    y={20}
                    fill="#F4F6FA"
                    fontSize={11.5}
                    fontWeight={600}
                    fontFamily="Plus Jakarta Sans, sans-serif"
                  >
                    {comp.name.length > 20 ? `${comp.name.slice(0, 19)}…` : comp.name}
                  </text>
                  <text
                    x={12}
                    y={36}
                    fill={hasVuln ? '#F87171' : '#8A94A6'}
                    fontSize={10}
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {`${comp.version} · ${comp.ecosystem}${hasVuln ? ` · ${nodeVulns.length} vuln` : ''}`}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Node Inspector */}
        <div className="lg:col-span-4 bg-[#0F1115] border border-[#222732] rounded-lg p-5 flex flex-col justify-between">
          {selectedNode ? (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-[#6B7484] font-mono">
                  Depth {selectedNode.dependencyDepth} · {selectedNode.ecosystem}
                </div>
                <h3 className="text-base font-semibold text-white mt-1 break-all">
                  {selectedNode.name}
                </h3>
                <div className="text-xs font-mono text-[#A1AAB8] mt-1">
                  Version {selectedNode.version} · License {selectedNode.license || 'NOASSERTION'}
                </div>
              </div>

              <div className="border-t border-[#222732] pt-3 space-y-2 text-xs">
                <div>
                  <span className="text-[#6B7484]">Supplier:</span>{' '}
                  <span className="text-[#E2E8F0]">{selectedNode.supplier || 'Unspecified'}</span>
                </div>
                {selectedNode.purl && (
                  <div className="break-all">
                    <span className="text-[#6B7484]">PURL:</span>{' '}
                    <span className="font-mono text-[#A1AAB8]">{selectedNode.purl}</span>
                  </div>
                )}
              </div>

              <div className="border-t border-[#222732] pt-3">
                <div className="text-xs font-medium text-[#A1AAB8] mb-2">
                  Linked Advisories ({selectedNodeVulns.length})
                </div>
                {selectedNodeVulns.length === 0 ? (
                  <p className="text-xs text-[#4ADE80]">
                    No matched vulnerabilities recorded on this node.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {selectedNodeVulns.map((v) => (
                      <div
                        key={v.id}
                        className="p-2.5 bg-[#08090B] border border-[#222732] rounded text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-medium text-white">
                            {v.cveIds[0] ?? v.osvId}
                          </span>
                          <SeverityLabel severity={v.severity} />
                        </div>
                        <p className="text-[#A1AAB8] line-clamp-2">{v.summary}</p>
                        {v.fixedVersions.length > 0 && (
                          <div className="font-mono text-[#4ADE80]">
                            Fixed in: {v.fixedVersions.join(', ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-sm text-[#A1AAB8] space-y-2">
              <div className="font-semibold text-white">Node Inspector</div>
              <p className="text-xs leading-relaxed">
                Click any component node in the dependency graph to inspect package metadata, PURL identifier, supplier, and linked vulnerability advisories.
              </p>
              <div className="pt-4 border-t border-[#222732] space-y-1.5 text-xs text-[#6B7484]">
                <div>Column 0: Root Application Manifest</div>
                <div>Column 1: Direct Dependencies</div>
                <div>Column 2+: Transitive Dependencies</div>
              </div>
            </div>
          )}

          <div className="border-t border-[#222732] pt-3 mt-4 flex items-center justify-between text-xs text-[#6B7484] font-mono">
            <span>Nodes: {filteredComponents.length}</span>
            <span>Edges: {filteredEdges.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
