import React from 'react';
import { ArrowRight, RefreshCw, ShieldAlert, Upload } from 'lucide-react';
import type { WorkspaceSnapshot } from '../../lib/api.ts';
import { SeverityLabel } from '../StatusText.tsx';

export type NavSectionId =
  | 'overview'
  | 'inventory'
  | 'vulnerabilities'
  | 'exposure'
  | 'graph'
  | 'incidents'
  | 'remediation'
  | 'reports'
  | 'api'
  | 'settings';

interface OverviewSectionProps {
  snapshot: WorkspaceSnapshot;
  onNavigate: (section: NavSectionId) => void;
  onScanAll: () => Promise<void>;
  scanning: boolean;
}

export const OverviewSection: React.FC<OverviewSectionProps> = ({
  snapshot,
  onNavigate,
  onScanAll,
  scanning,
}) => {
  const { metrics, sboms, exposures, auditLogs, components, organization } = snapshot;

  const totalSev =
    metrics.criticalFindings +
      metrics.highFindings +
      metrics.mediumFindings +
      metrics.lowFindings || 1;

  const sevRows = [
    { label: 'Critical', count: metrics.criticalFindings, color: 'bg-[#DC2626]' },
    { label: 'High', count: metrics.highFindings, color: 'bg-[#EA580C]' },
    { label: 'Medium', count: metrics.mediumFindings, color: 'bg-[#D97706]' },
    { label: 'Low', count: metrics.lowFindings, color: 'bg-[#16A34A]' },
  ];

  // Compute ecosystem breakdown deterministically from components
  const ecoCounts = new Map<string, number>();
  for (const c of components) {
    ecoCounts.set(c.ecosystem, (ecoCounts.get(c.ecosystem) ?? 0) + 1);
  }
  const topEcosystems = Array.from(ecoCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Executive Action Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0F1115] border border-[#222732] rounded-lg px-5 py-3.5">
        <div className="space-y-0.5">
          <div className="text-xs font-medium text-white">Supply-Chain Security Posture</div>
          <div className="text-xs text-[#6B7484]">
            {metrics.sbomCount} manifests · {metrics.confirmedVulnerabilities} confirmed matches ·{' '}
            {organization.isDemo ? 'Simulated Demo Environment' : 'Live Production Telemetry'}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('inventory')}
            className="px-3.5 py-2 text-xs font-medium bg-[#161920] hover:bg-[#1E232E] border border-[#222732] text-white rounded transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span>Upload SBOM</span>
          </button>
          <button
            type="button"
            disabled={scanning || sboms.length === 0}
            onClick={onScanAll}
            className="px-3.5 py-2 text-xs font-medium bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded transition-colors inline-flex items-center gap-1.5 disabled:opacity-40 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Scanning OSV & NVD...' : 'Run Live OSV/NVD Scan'}</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          {
            label: 'Total Components',
            value: metrics.totalComponents,
            sub: `${metrics.uniqueComponents} unique packages`,
            nav: 'inventory' as NavSectionId,
          },
          {
            label: 'Known Vulnerabilities',
            value: metrics.totalKnownVulnerabilities,
            sub: `${metrics.confirmedVulnerabilities} confirmed matches`,
            nav: 'vulnerabilities' as NavSectionId,
          },
          {
            label: 'Critical Findings',
            value: metrics.criticalFindings,
            sub: `${metrics.noFixAvailableCount} with no upstream fix`,
            nav: 'exposure' as NavSectionId,
            accent: metrics.criticalFindings > 0 ? 'text-[#F87171]' : 'text-white',
          },
          {
            label: 'High-Severity Findings',
            value: metrics.highFindings,
            sub: `${metrics.outdatedDependencies} outdated dependencies`,
            nav: 'exposure' as NavSectionId,
            accent: metrics.highFindings > 0 ? 'text-[#FB923C]' : 'text-white',
          },
          {
            label: 'Active Incidents',
            value: metrics.activeIncidents,
            sub: `${metrics.resolvedIncidents} resolved with evidence`,
            nav: 'incidents' as NavSectionId,
          },
          {
            label: 'Remediation Completion',
            value: `${metrics.remediationCompletionPct}%`,
            sub: `${metrics.remediationCompleted} of ${metrics.remediationTotal} tasks closed`,
            nav: 'remediation' as NavSectionId,
          },
        ].map((kpi) => (
          <button
            key={kpi.label}
            type="button"
            onClick={() => onNavigate(kpi.nav)}
            className="text-left bg-[#0F1115] hover:bg-[#141820] hover:border-[#323A4A] border border-[#222732] rounded-lg p-4 transition-colors"
          >
            <div className="text-xs text-[#A1AAB8]">{kpi.label}</div>
            <div
              className={`text-2xl font-semibold font-mono tabular-nums mt-2 ${
                kpi.accent ?? 'text-white'
              }`}
            >
              {kpi.value}
            </div>
            <div className="text-xs text-[#6B7484] mt-1 truncate">{kpi.sub}</div>
          </button>
        ))}
      </div>

      {/* Main Middle Split: Severity Distribution + Priority Exposure Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 bg-[#0F1115] border border-[#222732] rounded-lg p-5 flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">Severity & Ecosystem Breakdown</h3>
              <span className="text-xs font-mono text-[#6B7484]">
                {organization.isDemo ? 'DEMO DATA' : 'LIVE VERIFIED'}
              </span>
            </div>
            <p className="text-xs text-[#A1AAB8] mt-1">
              Deterministic CVSS and OSV advisory distribution across tracked packages.
            </p>
          </div>

          <div className="space-y-3">
            {sevRows.map((row) => {
              const pct = Math.round((row.count / totalSev) * 100);
              return (
                <div key={row.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#E2E8F0]">{row.label}</span>
                    <span className="font-mono tabular-nums text-[#A1AAB8]">
                      {row.count} ({metrics.totalKnownVulnerabilities > 0 ? `${pct}%` : '0%'})
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#08090B] rounded-sm overflow-hidden">
                    <div
                      className={`h-full ${row.color}`}
                      style={{
                        width: `${metrics.totalKnownVulnerabilities > 0 ? pct : 0}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {topEcosystems.length > 0 && (
            <div className="pt-3 border-t border-[#222732] space-y-2">
              <div className="text-xs font-medium text-[#A1AAB8]">Top Ecosystems</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {topEcosystems.map(([eco, count]) => (
                  <div
                    key={eco}
                    className="flex items-center justify-between px-2.5 py-1.5 bg-[#08090B] border border-[#222732] rounded"
                  >
                    <span className="font-mono text-[#E2E8F0] truncate">{eco}</span>
                    <span className="font-mono tabular-nums text-[#6B7484]">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-[#222732] flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => onNavigate('graph')}
              className="text-[#3B82F6] hover:underline"
            >
              Inspect Dependency Graph →
            </button>
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="text-[#3B82F6] hover:underline"
            >
              Export Reports →
            </button>
          </div>
        </div>

        <div className="lg:col-span-7 bg-[#0F1115] border border-[#222732] rounded-lg p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-white">Priority Exposure Queue</h3>
              <p className="text-xs text-[#A1AAB8] mt-0.5">
                Top affected components ranked by CVSS, match certainty, and fix availability.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('exposure')}
              className="text-xs text-[#3B82F6] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {exposures.length === 0 ? (
            <div className="py-12 text-center space-y-3 border border-dashed border-[#222732] rounded">
              <ShieldAlert className="w-6 h-6 text-[#6B7484] mx-auto" />
              <div className="text-sm font-medium text-white">No Exposure Findings Recorded</div>
              <p className="text-xs text-[#A1AAB8] max-w-sm mx-auto">
                Upload a CycloneDX or SPDX SBOM in Software Inventory to evaluate vulnerability exposure.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('inventory')}
                className="px-3.5 py-2 text-xs font-medium bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded"
              >
                Ingest First SBOM
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#222732] text-xs text-[#6B7484]">
                    <th className="py-2 pr-3 font-medium">Component</th>
                    <th className="py-2 px-3 font-medium">Advisory</th>
                    <th className="py-2 px-3 font-medium">Severity</th>
                    <th className="py-2 px-3 font-medium">Application</th>
                    <th className="py-2 pl-3 font-medium text-right">Fixed Version</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#222732] text-xs">
                  {exposures.slice(0, 6).map((exp) => (
                    <tr
                      key={exp.id}
                      onClick={() => onNavigate('exposure')}
                      className="hover:bg-[#161920]/70 cursor-pointer"
                    >
                      <td className="py-2.5 pr-3 font-mono text-white whitespace-nowrap">
                        {exp.componentName}@{exp.componentVersion}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[#A1AAB8] whitespace-nowrap">
                        {exp.advisoryId}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <SeverityLabel severity={exp.severity} />
                      </td>
                      <td className="py-2.5 px-3 text-[#A1AAB8] whitespace-nowrap">
                        {exp.applicationName}
                      </td>
                      <td className="py-2.5 pl-3 font-mono text-right whitespace-nowrap">
                        {exp.fixedVersion ? (
                          <span className="text-[#4ADE80]">{exp.fixedVersion}</span>
                        ) : (
                          <span className="text-[#F87171]">None published</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Split: Recently Uploaded SBOMs + Recent Security Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-[#0F1115] border border-[#222732] rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Recently Uploaded SBOMs</h3>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="text-xs text-[#3B82F6] hover:underline"
            >
              Manage Inventory →
            </button>
          </div>

          {sboms.length === 0 ? (
            <p className="text-xs text-[#6B7484] py-4">No SBOM manifests uploaded yet.</p>
          ) : (
            <div className="divide-y divide-[#222732]">
              {sboms.slice(0, 4).map((sbom) => (
                <button
                  key={sbom.id}
                  type="button"
                  onClick={() => onNavigate('inventory')}
                  className="w-full text-left py-3 flex items-center justify-between gap-4 text-xs hover:bg-[#161920]/40 px-1 rounded transition-colors"
                >
                  <div>
                    <div className="font-medium text-white">{sbom.applicationName}</div>
                    <div className="text-[#6B7484] mt-0.5">
                      {sbom.format} · {sbom.componentCount} components · {sbom.dataOrigin}
                    </div>
                  </div>
                  <div className="text-right font-mono text-[#A1AAB8] whitespace-nowrap">
                    {sbom.uploadedAt.slice(0, 10)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#0F1115] border border-[#222732] rounded-lg p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Recent Security Events</h3>
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="text-xs text-[#3B82F6] hover:underline"
            >
              Audit Log →
            </button>
          </div>

          {auditLogs.length === 0 ? (
            <p className="text-xs text-[#6B7484] py-4">No security audit events recorded yet.</p>
          ) : (
            <div className="divide-y divide-[#222732]">
              {auditLogs.slice(0, 5).map((log) => (
                <div key={log.id} className="py-2.5 flex items-center justify-between gap-4 text-xs">
                  <div>
                    <div className="font-mono text-[#E2E8F0]">{log.action}</div>
                    <div className="text-[#6B7484] mt-0.5">
                      {log.actorEmail} · {log.resourceType} ({log.resourceId})
                    </div>
                  </div>
                  <div className="font-mono text-[#6B7484] whitespace-nowrap">
                    {log.timestamp.slice(0, 19).replace('T', ' ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
