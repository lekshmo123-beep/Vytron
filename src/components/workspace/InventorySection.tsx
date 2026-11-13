import React, { useEffect, useMemo, useState } from 'react';
import { Upload, Search, Trash2, RefreshCw, Loader2, FileCode2, Download } from 'lucide-react';
import { vytronApi, type SampleSbom, type WorkspaceSnapshot } from '../../lib/api.ts';

interface InventorySectionProps {
  snapshot: WorkspaceSnapshot;
  canWrite: boolean;
  onRefresh: () => Promise<void>;
}

export const InventorySection: React.FC<InventorySectionProps> = ({
  snapshot,
  canWrite,
  onRefresh,
}) => {
  const [samples, setSamples] = useState<SampleSbom[]>([]);
  const [selectedSampleId, setSelectedSampleId] = useState('');
  const [appNameOverride, setAppNameOverride] = useState('');
  const [runScanOnUpload, setRunScanOnUpload] = useState(true);
  const [ingestMode, setIngestMode] = useState<'file' | 'paste'>('file');
  const [pasteContent, setPasteContent] = useState('');
  const [pasteFileName, setPasteFileName] = useState('pasted-sbom.json');

  const [uploading, setUploading] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [ecosystemFilter, setEcosystemFilter] = useState('ALL');
  const [sbomFilter, setSbomFilter] = useState('ALL');

  useEffect(() => {
    vytronApi
      .getSampleSboms()
      .then((res) => {
        setSamples(res.samples);
        if (res.samples.length > 0) setSelectedSampleId(res.samples[0].id);
      })
      .catch(() => {});
  }, []);

  const ecosystems = useMemo(() => {
    const set = new Set(snapshot.components.map((c) => c.ecosystem));
    return ['ALL', ...Array.from(set).sort()];
  }, [snapshot.components]);

  const filteredComponents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return snapshot.components.filter((c) => {
      if (ecosystemFilter !== 'ALL' && c.ecosystem !== ecosystemFilter) return false;
      if (sbomFilter !== 'ALL' && c.sbomId !== sbomFilter) return false;
      if (
        q &&
        !c.name.toLowerCase().includes(q) &&
        !c.version.toLowerCase().includes(q) &&
        !(c.purl || '').toLowerCase().includes(q) &&
        !(c.license || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [snapshot.components, ecosystemFilter, sbomFilter, search]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError(null);
    setStatusMessage(null);

    if (file.size > 5 * 1024 * 1024) {
      setError('File exceeds 5 MB maximum upload limit.');
      return;
    }

    setUploading(true);
    try {
      const text = await file.text();
      const res = await vytronApi.ingestSbom({
        content: text,
        fileName: file.name,
        applicationName: appNameOverride.trim() || undefined,
        runScan: runScanOnUpload,
      });
      await onRefresh();
      setAppNameOverride('');
      setStatusMessage(
        `Ingested ${res.sbom.fileName} (${res.sbom.format}): ${res.componentsCount} components, ${res.edgesCount} dependency edges, ${res.duplicatesDetected} duplicates.${
          res.scanSummary
            ? ` Live OSV/NVD scan matched ${res.scanSummary.vulnerabilitiesFound} advisories.`
            : ''
        }`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SBOM upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const handlePasteIngest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteContent.trim()) return;
    setError(null);
    setStatusMessage(null);
    setUploading(true);
    try {
      const res = await vytronApi.ingestSbom({
        content: pasteContent,
        fileName: pasteFileName.trim() || 'pasted-sbom.json',
        applicationName: appNameOverride.trim() || undefined,
        runScan: runScanOnUpload,
      });
      await onRefresh();
      setPasteContent('');
      setAppNameOverride('');
      setStatusMessage(
        `Ingested ${res.sbom.fileName} (${res.sbom.format}): ${res.componentsCount} components parsed.${
          res.scanSummary
            ? ` Live OSV/NVD scan matched ${res.scanSummary.vulnerabilitiesFound} advisories.`
            : ''
        }`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'SBOM parsing failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleIngestSample = async () => {
    const sample = samples.find((s) => s.id === selectedSampleId);
    if (!sample) return;
    setError(null);
    setStatusMessage(null);
    setUploading(true);
    try {
      const res = await vytronApi.ingestSbom({
        content: sample.content,
        fileName: sample.fileName,
        applicationName: appNameOverride.trim() || sample.applicationName,
        runScan: runScanOnUpload,
      });
      await onRefresh();
      setAppNameOverride('');
      setStatusMessage(
        `Ingested sample ${sample.fileName} (${res.sbom.format}): ${res.componentsCount} components parsed.${
          res.scanSummary
            ? ` Live OSV/NVD check returned ${res.scanSummary.vulnerabilitiesFound} advisories${
                res.scanSummary.warnings.length ? ` (${res.scanSummary.warnings[0]})` : ''
              }.`
            : ''
        }`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sample ingestion failed.');
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadSample = () => {
    const sample = samples.find((s) => s.id === selectedSampleId);
    if (!sample) return;
    const blob = new Blob([sample.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sample.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRescanSbom = async (sbomId: string) => {
    setError(null);
    setStatusMessage(null);
    setScanningId(sbomId);
    try {
      const res = await vytronApi.scanVulnerabilities(sbomId);
      await onRefresh();
      setStatusMessage(
        `Live OSV/NVD scan complete: ${res.scannedComponents} components checked, ${res.vulnerabilitiesMatched} advisories matched.${
          res.warnings.length ? ` Notice: ${res.warnings[0]}` : ''
        }`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed.');
    } finally {
      setScanningId(null);
    }
  };

  const handleDeleteSbom = async (sbomId: string) => {
    setError(null);
    setStatusMessage(null);
    try {
      await vytronApi.deleteSbom(sbomId);
      await onRefresh();
      setStatusMessage('SBOM manifest and associated components removed from workspace.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.');
    }
  };

  const sbomNameMap = new Map(snapshot.sboms.map((s) => [s.id, s.applicationName]));

  return (
    <div className="space-y-6">
      {/* Ingestion Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 bg-[#0F1115] border border-[#222732] rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Ingest SBOM Manifest</h3>
              <p className="text-xs text-[#A1AAB8] mt-0.5">
                CycloneDX JSON/XML & SPDX 2.3 JSON/Tag-Value (.json, .xml, .spdx, .txt)
              </p>
            </div>
            <div className="flex items-center gap-1 p-0.5 bg-[#08090B] border border-[#222732] rounded">
              <button
                type="button"
                onClick={() => setIngestMode('file')}
                className={`px-2.5 py-1 text-xs rounded whitespace-nowrap ${
                  ingestMode === 'file' ? 'bg-[#161920] text-white' : 'text-[#A1AAB8]'
                }`}
              >
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setIngestMode('paste')}
                className={`px-2.5 py-1 text-xs rounded whitespace-nowrap ${
                  ingestMode === 'paste' ? 'bg-[#161920] text-white' : 'text-[#A1AAB8]'
                }`}
              >
                Paste Raw
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={appNameOverride}
              onChange={(e) => setAppNameOverride(e.target.value)}
              placeholder="Optional application name override"
              disabled={!canWrite || uploading}
              className="px-3 py-2 text-xs bg-[#08090B] border border-[#222732] rounded text-white placeholder:text-[#6B7484] focus:outline-none focus:border-[#3B82F6]"
            />
            <label className="flex items-center gap-2 text-xs text-[#A1AAB8] cursor-pointer">
              <input
                type="checkbox"
                checked={runScanOnUpload}
                onChange={(e) => setRunScanOnUpload(e.target.checked)}
                className="accent-[#2563EB]"
              />
              <span>Auto-run live OSV/NVD scan on upload</span>
            </label>
          </div>

          {ingestMode === 'file' ? (
            <label
              className={`flex items-center justify-center gap-2.5 py-5 px-4 border border-dashed border-[#2F3746] rounded-md text-xs font-medium transition-colors ${
                canWrite
                  ? 'bg-[#08090B] hover:border-[#3B82F6] text-white cursor-pointer'
                  : 'bg-[#08090B]/50 text-[#6B7484] cursor-not-allowed'
              }`}
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#3B82F6]" />
              ) : (
                <Upload className="w-4 h-4 text-[#3B82F6]" />
              )}
              <span>
                {canWrite
                  ? uploading
                    ? 'Parsing SBOM & Querying OSV...'
                    : 'Select CycloneDX / SPDX File to Ingest (Max 5 MB)'
                  : 'Read-only role (upload disabled)'}
              </span>
              <input
                type="file"
                accept=".json,.xml,.spdx,.txt"
                onChange={handleFileUpload}
                disabled={!canWrite || uploading}
                className="hidden"
              />
            </label>
          ) : (
            <form onSubmit={handlePasteIngest} className="space-y-2.5">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={pasteFileName}
                  onChange={(e) => setPasteFileName(e.target.value)}
                  placeholder="manifest.json / manifest.xml / manifest.spdx"
                  className="flex-1 px-3 py-1.5 text-xs bg-[#08090B] border border-[#222732] rounded text-white font-mono"
                />
                <button
                  type="submit"
                  disabled={!canWrite || uploading || !pasteContent.trim()}
                  className="px-3.5 py-1.5 text-xs font-medium bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded disabled:opacity-40 whitespace-nowrap"
                >
                  {uploading ? 'Parsing...' : 'Parse & Ingest'}
                </button>
              </div>
              <textarea
                rows={4}
                value={pasteContent}
                onChange={(e) => setPasteContent(e.target.value)}
                placeholder="Paste raw CycloneDX JSON/XML or SPDX JSON/Tag-Value manifest..."
                className="w-full px-3 py-2 text-xs font-mono bg-[#08090B] border border-[#222732] rounded text-white placeholder:text-[#6B7484]"
              />
            </form>
          )}
        </div>

        {/* Sample SBOM Preset Tester */}
        <div className="lg:col-span-6 bg-[#0F1115] border border-[#222732] rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">Test with Real Sample SBOMs</h3>
              <p className="text-xs text-[#A1AAB8] mt-1">
                Ingest verified CycloneDX or SPDX fixtures to test parser extraction and live OSV.dev matching.
              </p>
            </div>
            <FileCode2 className="w-4 h-4 text-[#3B82F6]" />
          </div>

          <select
            value={selectedSampleId}
            onChange={(e) => setSelectedSampleId(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-[#08090B] border border-[#222732] rounded text-white focus:outline-none focus:border-[#3B82F6]"
          >
            {samples.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label} — {s.fileName}
              </option>
            ))}
          </select>

          {selectedSampleId && (
            <p className="text-xs text-[#6B7484]">
              {samples.find((s) => s.id === selectedSampleId)?.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!canWrite || uploading || !selectedSampleId}
              onClick={handleIngestSample}
              className="px-4 py-2 text-xs font-medium bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded transition-colors inline-flex items-center gap-2 disabled:opacity-40 whitespace-nowrap"
            >
              {uploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Ingest & Scan Sample</span>
            </button>
            <button
              type="button"
              disabled={!selectedSampleId}
              onClick={handleDownloadSample}
              className="px-3.5 py-2 text-xs font-medium bg-[#161920] hover:bg-[#1E232E] border border-[#222732] text-[#E2E8F0] rounded transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Raw File</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3.5 text-xs text-[#F87171] bg-[#DC2626]/10 border border-[#DC2626]/30 rounded">
          {error}
        </div>
      )}
      {statusMessage && (
        <div className="p-3.5 text-xs text-[#4ADE80] bg-[#16A34A]/10 border border-[#16A34A]/30 rounded">
          {statusMessage}
        </div>
      )}

      {/* SBOM Inventory History */}
      <div className="bg-[#0F1115] border border-[#222732] rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#222732] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">
            Ingested SBOM History ({snapshot.sboms.length})
          </h3>
          <span className="text-xs text-[#6B7484]">SHA-256 verified manifests</span>
        </div>

        {snapshot.sboms.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#A1AAB8]">
            No SBOM manifests uploaded in this workspace yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#222732] text-xs text-[#6B7484]">
                  <th className="py-2.5 px-4 font-medium">Application</th>
                  <th className="py-2.5 px-4 font-medium">Format</th>
                  <th className="py-2.5 px-4 font-medium text-right">Components</th>
                  <th className="py-2.5 px-4 font-medium text-right">Duplicates</th>
                  <th className="py-2.5 px-4 font-medium">Origin</th>
                  <th className="py-2.5 px-4 font-medium">Last Scanned</th>
                  <th className="py-2.5 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222732] text-xs">
                {snapshot.sboms.map((sbom) => (
                  <tr key={sbom.id} className="hover:bg-[#161920]/60">
                    <td className="py-3 px-4">
                      <div className="font-medium text-white">
                        {sbom.applicationName}@{sbom.applicationVersion}
                      </div>
                      <div className="font-mono text-[#6B7484] text-[11px]">{sbom.fileName}</div>
                    </td>
                    <td className="py-3 px-4 text-[#E2E8F0] whitespace-nowrap">
                      {sbom.format} ({sbom.specVersion})
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-right text-white">
                      {sbom.componentCount}
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums text-right text-[#A1AAB8]">
                      {sbom.duplicateCount}
                    </td>
                    <td className="py-3 px-4 font-mono text-[#A1AAB8] whitespace-nowrap">
                      {sbom.dataOrigin}
                    </td>
                    <td className="py-3 px-4 font-mono text-[#6B7484] whitespace-nowrap">
                      {sbom.lastScannedAt ? sbom.lastScannedAt.slice(0, 19).replace('T', ' ') : 'Not scanned'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                      {canWrite && (
                        <>
                          <button
                            type="button"
                            disabled={scanningId === sbom.id}
                            onClick={() => handleRescanSbom(sbom.id)}
                            className="px-2.5 py-1 bg-[#161920] hover:bg-[#1E232E] border border-[#222732] rounded text-white inline-flex items-center gap-1"
                          >
                            <RefreshCw
                              className={`w-3 h-3 ${scanningId === sbom.id ? 'animate-spin' : ''}`}
                            />
                            <span>Scan</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSbom(sbom.id)}
                            className="p-1.5 text-[#6B7484] hover:text-[#F87171]"
                            title="Delete SBOM"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Component Inventory Table */}
      <div className="bg-[#0F1115] border border-[#222732] rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#222732] flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-white">
            Component Inventory ({filteredComponents.length})
          </h3>
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#6B7484] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search package, version, PURL, license..."
                className="pl-8 pr-3 py-1.5 text-xs bg-[#08090B] border border-[#222732] rounded text-white placeholder:text-[#6B7484] focus:outline-none focus:border-[#3B82F6] w-64"
              />
            </div>
            <select
              value={ecosystemFilter}
              onChange={(e) => setEcosystemFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-[#08090B] border border-[#222732] rounded text-white"
            >
              {ecosystems.map((eco) => (
                <option key={eco} value={eco}>
                  {eco === 'ALL' ? 'All Ecosystems' : eco}
                </option>
              ))}
            </select>
            <select
              value={sbomFilter}
              onChange={(e) => setSbomFilter(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-[#08090B] border border-[#222732] rounded text-white"
            >
              <option value="ALL">All SBOMs</option>
              {snapshot.sboms.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.applicationName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {filteredComponents.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#A1AAB8]">
            No components match the current search or filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#0F1115]">
                <tr className="border-b border-[#222732] text-xs text-[#6B7484]">
                  <th className="py-2.5 px-4 font-medium">Component</th>
                  <th className="py-2.5 px-4 font-medium">Version</th>
                  <th className="py-2.5 px-4 font-medium">Ecosystem</th>
                  <th className="py-2.5 px-4 font-medium">License</th>
                  <th className="py-2.5 px-4 font-medium">Supplier</th>
                  <th className="py-2.5 px-4 font-medium">Application</th>
                  <th className="py-2.5 px-4 font-medium text-right">Depth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222732] text-xs">
                {filteredComponents.map((comp) => (
                  <tr key={comp.id} className="hover:bg-[#161920]/60">
                    <td className="py-2.5 px-4">
                      <div className="font-mono text-white font-medium">{comp.name}</div>
                      {comp.purl && (
                        <div className="font-mono text-[11px] text-[#6B7484] truncate max-w-xs">
                          {comp.purl}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[#E2E8F0] whitespace-nowrap">
                      {comp.version}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[#A1AAB8] whitespace-nowrap">
                      {comp.ecosystem}
                    </td>
                    <td className="py-2.5 px-4 text-[#A1AAB8] whitespace-nowrap">
                      {comp.license || 'NOASSERTION'}
                    </td>
                    <td className="py-2.5 px-4 text-[#A1AAB8] whitespace-nowrap">
                      {comp.supplier || 'Unspecified'}
                    </td>
                    <td className="py-2.5 px-4 text-[#E2E8F0] whitespace-nowrap">
                      {sbomNameMap.get(comp.sbomId) ?? 'Unknown'}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-right text-[#A1AAB8]">
                      {comp.dependencyDepth === 0 ? 'Root' : `L${comp.dependencyDepth}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
