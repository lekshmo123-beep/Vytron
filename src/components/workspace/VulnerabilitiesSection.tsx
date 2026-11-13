import React, { useMemo, useState } from 'react';
import { RefreshCw, ExternalLink, Sparkles, Loader2, X, Search, ShieldPlus, Wrench } from 'lucide-react';
import { vytronApi, type WorkspaceSnapshot } from '../../lib/api.ts';
import type { MatchConfidence, SeverityLevel, VulnerabilityMatch } from '../../types/vytron.ts';
import { ConfidenceLabel, SeverityLabel } from '../StatusText.tsx';

interface VulnerabilitiesSectionProps {
  snapshot: WorkspaceSnapshot;
  canWrite: boolean;
  onRefresh: () => Promise<void>;
}

export const VulnerabilitiesSection: React.FC<VulnerabilitiesSectionProps> = ({
  snapshot,
  canWrite,
  onRefresh,
}) => {
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [scanErr, setScanErr] = useState<string | null>(null);

  const [severityFilter, setSeverityFilter] = useState<SeverityLevel | 'ALL'>('ALL');
  const [confidenceFilter, setConfidenceFilter] = useState<MatchConfidence | 'ALL'>('ALL');
  const [search, setSearch] = useState('');

  // AI Explainer Modal state
  const [explainingVuln, setExplainingVuln] = useState<VulnerabilityMatch | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return snapshot.vulnerabilities.filter((v) => {
      if (severityFilter !== 'ALL' && v.severity !== severityFilter) return false;
      if (confidenceFilter !== 'ALL' && v.matchConfidence !== confidenceFilter) return false;
      if (
        q &&
        !v.componentName.toLowerCase().includes(q) &&
        !v.osvId.toLowerCase().includes(q) &&
        !v.cveIds.some((c) => c.toLowerCase().includes(q)) &&
        !v.summary.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [snapshot.vulnerabilities, severityFilter, confidenceFilter, search]);

  const handleScan = async () => {
    setScanErr(null);
    setScanMsg(null);
    setScanning(true);
    try {
      const res = await vytronApi.scanVulnerabilities();
      await onRefresh();
      setScanMsg(
        `Scanned ${res.scannedComponents} versioned components against OSV.dev & NIST NVD: ${res.vulnerabilitiesMatched} advisories matched.${
          res.warnings.length ? ` (${res.warnings[0]})` : ''
        }`
      );
    } catch (err) {
      setScanErr(err instanceof Error ? err.message : 'Vulnerability scan failed.');
    } finally {
      setScanning(false);
    }
  };

  const handleExplain = async (vuln: VulnerabilityMatch) => {
    setExplainingVuln(vuln);
    setAiText(null);
    setAiError(null);
    setAiLoading(true);
    try {
      const res = await vytronApi.explainVulnerability(vuln.id);
      setAiText(res.analysis);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to generate AI technical brief.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleEscalateFromVuln = async (vuln: VulnerabilityMatch) => {
    setScanErr(null);
    setScanMsg(null);
    setActionBusy(true);
    try {
      const advisory = vuln.cveIds[0] ?? vuln.osvId;
      await vytronApi.createIncident({
        title: `${advisory} Affecting ${vuln.componentName}@${vuln.componentVersion}`,
        description: `${vuln.summary}\nMatch verification: ${vuln.matchReason}`,
        severity: vuln.severity,
        linkedVulnerabilityIds: [vuln.id],
        linkedComponentIds: [vuln.componentId],
        linkedAdvisoryIds: [advisory],
      });
      await onRefresh();
      setScanMsg(`Security incident opened for ${advisory}.`);
    } catch (err) {
      setScanErr(err instanceof Error ? err.message : 'Failed to create incident.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleRemediateFromVuln = async (vuln: VulnerabilityMatch) => {
    setScanErr(null);
    setScanMsg(null);
    setActionBusy(true);
    try {
      const advisory = vuln.cveIds[0] ?? vuln.osvId;
      const sbom = snapshot.sboms.find((s) => s.id === vuln.sbomId);
      const action =
        vuln.fixedVersions.length > 0
          ? `Upgrade ${vuln.componentName} from ${vuln.componentVersion} to ${vuln.fixedVersions[vuln.fixedVersions.length - 1]}`
          : `No upstream fix published for ${advisory}. Apply isolation or compensating controls.`;
      await vytronApi.createRemediation({
        advisoryId: advisory,
        componentId: vuln.componentId,
        componentName: vuln.componentName,
        componentVersion: vuln.componentVersion,
        applicationName: sbom?.applicationName ?? 'Workspace Application',
        severity: vuln.severity,
        recommendedAction: action,
      });
      await onRefresh();
      setScanMsg(`Remediation task created for ${vuln.componentName}@${vuln.componentVersion}.`);
    } catch (err) {
      setScanErr(err instanceof Error ? err.message : 'Failed to create remediation task.');
    } finally {
      setActionBusy(false);
    }
  };

  const vulnComponentIds = new Set(snapshot.vulnerabilities.map((v) => v.componentId));
  const cleanCount = snapshot.components.filter(
    (c) => !c.isRoot && !vulnComponentIds.has(c.id)
  ).length;

  return (
    <div className="space-y-5">
      {/* Intelligence Status Summary & Scan Trigger */}
      <div className="bg-[#0F1115] border border-[#222732] rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6 text-xs">
          <div>
            <span className="text-[#6B7484]">Confirmed Matches:</span>{' '}
            <span className="font-mono font-semibold text-[#F87171] tabular-nums">
              {snapshot.metrics.confirmedVulnerabilities}
            </span>
          </div>
          <div>
            <span className="text-[#6B7484]">Potentially Affected / Unverified:</span>{' '}
            <span className="font-mono font-semibold text-[#FBBF24] tabular-nums">
              {snapshot.metrics.potentiallyAffected}
            </span>
          </div>
          <div>
            <span className="text-[#6B7484]">No Known Vulnerability Found:</span>{' '}
            <span className="font-mono font-semibold text-[#4ADE80] tabular-nums">
              {cleanCount}
            </span>
          </div>
        </div>

        {canWrite && (
          <button
            type="button"
            disabled={scanning || snapshot.sboms.length === 0}
            onClick={handleScan}
            className="px-4 py-2 text-xs font-medium bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded transition-colors inline-flex items-center gap-2 disabled:opacity-40 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            <span>{scanning ? 'Querying OSV & NVD...' : 'Verify All Against Live OSV/NVD'}</span>
          </button>
        )}
      </div>

      {scanErr && (
        <div className="p-3 text-xs text-[#F87171] bg-[#DC2626]/10 border border-[#DC2626]/30 rounded">
          {scanErr}
        </div>
      )}
      {scanMsg && (
        <div className="p-3 text-xs text-[#4ADE80] bg-[#16A34A]/10 border border-[#16A34A]/30 rounded">
          {scanMsg}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#6B7484] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by CVE, OSV ID, package..."
            className="pl-8 pr-3 py-1.5 text-xs bg-[#0F1115] border border-[#222732] rounded text-white placeholder:text-[#6B7484] w-64 focus:outline-none focus:border-[#3B82F6]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value as SeverityLevel | 'ALL')}
            className="px-2.5 py-1.5 text-xs bg-[#0F1115] border border-[#222732] rounded text-white"
          >
            <option value="ALL">All Severities</option>
            <option value="Critical">Critical</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
            <option value="Unknown">Unknown</option>
          </select>

          <select
            value={confidenceFilter}
            onChange={(e) => setConfidenceFilter(e.target.value as MatchConfidence | 'ALL')}
            className="px-2.5 py-1.5 text-xs bg-[#0F1115] border border-[#222732] rounded text-white"
          >
            <option value="ALL">All Match Confidence</option>
            <option value="confirmed_match">Confirmed Match</option>
            <option value="potentially_affected">Potentially Affected</option>
            <option value="unverified">Unverified</option>
          </select>
        </div>
      </div>

      {/* Vulnerability Table */}
      <div className="bg-[#0F1115] border border-[#222732] rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-xs text-[#A1AAB8]">
            {snapshot.vulnerabilities.length === 0
              ? 'No vulnerabilities found or no scan executed yet.'
              : 'No vulnerability records match the selected filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#222732] text-xs text-[#6B7484]">
                  <th className="py-3 px-4 font-medium">Advisory / CVE</th>
                  <th className="py-3 px-4 font-medium">Component</th>
                  <th className="py-3 px-4 font-medium">Severity & CVSS</th>
                  <th className="py-3 px-4 font-medium">Confidence</th>
                  <th className="py-3 px-4 font-medium">Affected / Fixed</th>
                  <th className="py-3 px-4 font-medium">Source & Checked</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222732] text-xs">
                {filtered.map((v) => (
                  <tr key={v.id} className="hover:bg-[#161920]/60 align-top">
                    <td className="py-3 px-4 space-y-1">
                      <div className="font-mono font-semibold text-white">
                        {v.cveIds[0] ?? v.osvId}
                      </div>
                      {v.cveIds[0] && v.osvId !== v.cveIds[0] && (
                        <div className="font-mono text-[11px] text-[#6B7484]">{v.osvId}</div>
                      )}
                      <div className="text-[#A1AAB8] max-w-xs line-clamp-2">{v.summary}</div>
                      {v.references[0] && (
                        <a
                          href={v.references[0].url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-[#3B82F6] hover:underline"
                        >
                          <span>Advisory Reference</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono whitespace-nowrap">
                      <div className="text-white">{v.componentName}</div>
                      <div className="text-[#6B7484]">
                        {v.componentVersion} · {v.ecosystem}
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap space-y-1">
                      <SeverityLabel severity={v.severity} />
                      <div className="font-mono text-[#A1AAB8] tabular-nums">
                        {v.cvssScore !== null ? `CVSS ${v.cvssScore.toFixed(1)}` : 'CVSS unrated'}
                      </div>
                    </td>
                    <td className="py-3 px-4 space-y-1">
                      <ConfidenceLabel confidence={v.matchConfidence} />
                      <div className="text-[11px] text-[#6B7484] max-w-[200px]">
                        {v.matchReason}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] space-y-1">
                      <div className="text-[#A1AAB8]">
                        {v.affectedRanges.length > 0 ? v.affectedRanges.join(', ') : 'Range unspecified'}
                      </div>
                      {v.fixedVersions.length > 0 ? (
                        <div className="text-[#4ADE80]">Fix: {v.fixedVersions.join(', ')}</div>
                      ) : (
                        <div className="text-[#F87171]">No fix published</div>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-[#6B7484] whitespace-nowrap">
                      <div>{v.source}</div>
                      <div>{v.checkedAt.slice(0, 16).replace('T', ' ')}</div>
                      <div>{v.dataOrigin}</div>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                      <button
                        type="button"
                        onClick={() => handleExplain(v)}
                        className="px-2.5 py-1.5 bg-[#161920] hover:bg-[#1E232E] border border-[#222732] rounded text-white inline-flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3 text-[#3B82F6]" />
                        <span>Explain</span>
                      </button>
                      {canWrite && (
                        <>
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() => handleEscalateFromVuln(v)}
                            title="Escalate to Incident"
                            className="p-1.5 bg-[#161920] hover:bg-[#1E232E] border border-[#222732] rounded text-[#F87171] inline-flex items-center"
                          >
                            <ShieldPlus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={actionBusy}
                            onClick={() => handleRemediateFromVuln(v)}
                            title="Create Remediation Task"
                            className="p-1.5 bg-[#161920] hover:bg-[#1E232E] border border-[#222732] rounded text-[#3B82F6] inline-flex items-center"
                          >
                            <Wrench className="w-3.5 h-3.5" />
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

      {/* AI Technical Explainer Modal */}
      {explainingVuln && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-2xl bg-[#0F1115] border border-[#222732] rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-[#222732] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  Technical Briefing: {explainingVuln.cveIds[0] ?? explainingVuln.osvId}
                </h3>
                <p className="text-xs text-[#6B7484] font-mono mt-0.5">
                  {explainingVuln.componentName}@{explainingVuln.componentVersion} ·{' '}
                  {explainingVuln.dataOrigin}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExplainingVuln(null)}
                className="p-1.5 text-[#A1AAB8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">
              {aiLoading && (
                <div className="flex items-center gap-2 text-xs text-[#A1AAB8] py-8 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-[#3B82F6]" />
                  <span>Generating evidence-grounded technical explanation...</span>
                </div>
              )}
              {aiError && (
                <div className="p-3 text-xs text-[#F87171] bg-[#DC2626]/10 border border-[#DC2626]/30 rounded">
                  {aiError}
                </div>
              )}
              {aiText && (
                <div className="text-xs text-[#E2E8F0] leading-relaxed whitespace-pre-wrap">
                  {aiText}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
