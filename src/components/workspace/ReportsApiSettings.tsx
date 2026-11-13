import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  Sparkles,
  Loader2,
  KeyRound,
  Trash2,
  RotateCcw,
  UserPlus,
  Play,
} from 'lucide-react';
import { vytronApi, type WorkspaceSnapshot } from '../../lib/api.ts';
import { generateSecurityPdfReport } from '../../lib/pdfReport.ts';
import type { UserRole } from '../../types/vytron.ts';
import { AcquisitionChecklistView } from '../AcquisitionChecklistView.tsx';
import { SeverityLabel } from '../StatusText.tsx';

// --- MODULE F: REPORTS ---
export const ReportsSection: React.FC<{ snapshot: WorkspaceSnapshot }> = ({ snapshot }) => {
  const [narrative, setNarrative] = useState<string | null>(null);
  const [generatingAi, setGeneratingAi] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateBrief = async () => {
    setError(null);
    setGeneratingAi(true);
    try {
      const res = await vytronApi.generateManagementReport();
      setNarrative(res.narrative);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate management brief.');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleDownloadCsv = async () => {
    setError(null);
    setExportingCsv(true);
    try {
      const blob = await vytronApi.downloadCsvUrl();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `vytron-report-${snapshot.organization.slug}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV export failed.');
    } finally {
      setExportingCsv(false);
    }
  };

  const handleDownloadPdf = () => {
    generateSecurityPdfReport(snapshot, narrative ?? undefined);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#0F1115] border border-[#222732] rounded-lg p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-white">
              Security Posture & Compliance Reports
            </h3>
            <p className="text-xs text-[#A1AAB8] mt-1">
              Reports include inventory overview, deterministic vulnerability findings, severity distribution, incident evidence, and explicit classification ({snapshot.organization.isDemo ? 'DEMO DATA' : 'LIVE VERIFIED'}).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="px-4 py-2 text-xs font-medium bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded inline-flex items-center gap-2 whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download PDF Report</span>
            </button>
            <button
              type="button"
              disabled={exportingCsv}
              onClick={handleDownloadCsv}
              className="px-4 py-2 text-xs font-medium bg-[#161920] hover:bg-[#1E232E] border border-[#222732] text-white rounded inline-flex items-center gap-2 whitespace-nowrap"
            >
              {exportingCsv ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-3.5 h-3.5 text-[#3B82F6]" />
              )}
              <span>Download CSV Export</span>
            </button>
          </div>
        </div>

        <div className="border-t border-[#222732] pt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-[#A1AAB8]">
            Optionally attach an AI-synthesized management brief grounded strictly in workspace metrics before downloading PDF.
          </div>
          <button
            type="button"
            disabled={generatingAi}
            onClick={handleGenerateBrief}
            className="px-3.5 py-2 text-xs font-medium bg-[#161920] hover:bg-[#1E232E] border border-[#222732] text-white rounded inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            {generatingAi ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3B82F6]" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-[#3B82F6]" />
            )}
            <span>Generate Management Narrative</span>
          </button>
        </div>

        {error && (
          <div className="p-3 text-xs text-[#F87171] bg-[#DC2626]/10 border border-[#DC2626]/30 rounded">
            {error}
          </div>
        )}

        {narrative && (
          <div className="p-4 bg-[#08090B] border border-[#222732] rounded text-xs text-[#E2E8F0] leading-relaxed whitespace-pre-wrap">
            {narrative}
          </div>
        )}
      </div>

      {/* Report Preview Summary */}
      <div className="bg-[#0F1115] border border-[#222732] rounded-lg p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div>
          <div className="text-[#6B7484]">Data Classification</div>
          <div className="font-mono font-semibold text-white mt-1">
            {snapshot.organization.isDemo ? 'DEMO DATA ONLY' : 'LIVE VERIFIED'}
          </div>
        </div>
        <div>
          <div className="text-[#6B7484]">Tracked Components</div>
          <div className="font-mono text-white mt-1 tabular-nums">
            {snapshot.metrics.totalComponents}
          </div>
        </div>
        <div>
          <div className="text-[#6B7484]">Verified Advisories</div>
          <div className="font-mono text-white mt-1 tabular-nums">
            {snapshot.metrics.totalKnownVulnerabilities}
          </div>
        </div>
        <div>
          <div className="text-[#6B7484]">Incidents w/ Evidence</div>
          <div className="font-mono text-white mt-1 tabular-nums">
            {snapshot.incidents.filter((i) => Boolean(i.verificationEvidence)).length} /{' '}
            {snapshot.incidents.length}
          </div>
        </div>
      </div>

      {/* Live Preview Table of Report Contents */}
      <div className="bg-[#0F1115] border border-[#222732] rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-[#222732] flex items-center justify-between text-xs">
          <span className="font-semibold text-white">Report Findings Preview</span>
          <span className="font-mono text-[#6B7484]">
            {snapshot.exposures.length} exposure rows included
          </span>
        </div>
        {snapshot.exposures.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#6B7484]">
            No exposure records to preview. Exported report will reflect zero findings.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#222732] text-[#6B7484]">
                  <th className="py-2.5 px-4 font-medium">Application</th>
                  <th className="py-2.5 px-4 font-medium">Component</th>
                  <th className="py-2.5 px-4 font-medium">Advisory</th>
                  <th className="py-2.5 px-4 font-medium">Severity</th>
                  <th className="py-2.5 px-4 font-medium">Origin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222732]">
                {snapshot.exposures.slice(0, 10).map((exp) => (
                  <tr key={exp.id}>
                    <td className="py-2.5 px-4 text-white">{exp.applicationName}</td>
                    <td className="py-2.5 px-4 font-mono text-[#A1AAB8]">
                      {exp.componentName}@{exp.componentVersion}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-white">{exp.advisoryId}</td>
                    <td className="py-2.5 px-4">
                      <SeverityLabel severity={exp.severity} />
                    </td>
                    <td className="py-2.5 px-4 font-mono text-[#6B7484]">{exp.dataOrigin}</td>
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

// --- MODULE G & H: API & INTEGRATIONS ---
export const ApiIntegrationsSection: React.FC<{
  snapshot: WorkspaceSnapshot;
  canAdminOrEng: boolean;
  onRefresh: () => Promise<void>;
}> = ({ snapshot, canAdminOrEng, onRefresh }) => {
  const [keyName, setKeyName] = useState('');
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [probeResp, setProbeResp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNewRawKey(null);
    setCreating(true);
    try {
      const res = await vytronApi.createApiKey({
        name: keyName,
        scopes: ['sbom:ingest', 'vuln:scan', 'reports:read'],
      });
      setNewRawKey(res.rawKey);
      setKeyName('');
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'API key generation failed.');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    setError(null);
    try {
      await vytronApi.revokeApiKey(id);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke API key.');
    }
  };

  const handleTestHealth = async () => {
    try {
      const res = await vytronApi.health();
      setProbeResp(JSON.stringify(res, null, 2));
    } catch (err) {
      setProbeResp(err instanceof Error ? err.message : 'Health probe failed.');
    }
  };

  const handleTestWorkspace = async () => {
    try {
      const res = await vytronApi.getWorkspace();
      setProbeResp(
        JSON.stringify(
          {
            organization: res.organization.name,
            isDemo: res.organization.isDemo,
            metrics: res.metrics,
          },
          null,
          2
        )
      );
    } catch (err) {
      setProbeResp(err instanceof Error ? err.message : 'Workspace probe failed.');
    }
  };

  const apiEndpoints = [
    ['GET', '/api/v1/health', 'Public', 'Service liveness & version check'],
    ['POST', '/api/v1/auth/register', 'Public', 'Provision isolated org workspace & admin'],
    ['POST', '/api/v1/auth/login', 'Public', 'Authenticate & issue HMAC session token'],
    ['GET', '/api/v1/workspace', 'Bearer / API Key', 'Fetch org-isolated inventory, exposures, incidents'],
    ['POST', '/api/v1/sboms/ingest', 'Admin / SecEng / Key', 'Parse CycloneDX/SPDX & optional live scan'],
    ['POST', '/api/v1/vulnerabilities/scan', 'Admin / SecEng', 'Run live OSV.dev + NIST NVD verification'],
    ['PATCH', '/api/v1/exposures/:id', 'Admin / SecEng', 'Update exposure investigation triage status'],
    ['POST', '/api/v1/incidents', 'Admin / SecEng', 'Create security incident linked to advisories'],
    ['PATCH', '/api/v1/incidents/:id', 'Coordinator', 'Transition status (enforces resolution evidence)'],
    ['PATCH', '/api/v1/remediations/:id', 'Coordinator', 'Update remediation owner, due date, evidence'],
    ['GET', '/api/v1/reports/csv', 'Bearer', 'Export classification-labeled CSV posture report'],
  ];

  return (
    <div className="space-y-6">
      {/* Integrations Status Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-[#0F1115] border border-[#222732] rounded-lg p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">Active Live Integrations</h3>
          <div className="divide-y divide-[#222732] text-xs">
            {[
              ['OSV.dev Vulnerability API', 'https://api.osv.dev/v1/querybatch', 'Connected'],
              ['NIST NVD API v2.0', 'https://services.nvd.nist.gov/rest/json/cves/2.0', 'Connected'],
              ['CI/CD SBOM Webhook', 'POST /api/v1/sboms/ingest (X-VYTRON-API-Key)', 'Active'],
              ['Gemini Evidence Analyst', 'Server-side @google/genai (gemini-4-hydrogen)', 'Active'],
            ].map(([name, detail, status]) => (
              <div key={name} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-white">{name}</div>
                  <div className="font-mono text-[11px] text-[#6B7484]">{detail}</div>
                </div>
                <span className="font-mono text-[#4ADE80] whitespace-nowrap">{status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#0F1115] border border-[#222732] rounded-lg p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">
            Planned Enterprise Integrations (Roadmap — Not Connected in MVP)
          </h3>
          <div className="divide-y divide-[#222732] text-xs">
            {[
              ['GitHub App & Dependabot Sync', 'Automated repo SBOM discovery via OAuth App', 'Future Roadmap'],
              ['GitLab Dependency Scanning', 'Pipeline artifact pull & MR blocking checks', 'Future Roadmap'],
              ['SIEM Export (Splunk / Sentinel)', 'CEF/JSON webhook streaming for SOC alert rules', 'Future Roadmap'],
              ['Jira / Linear Issue Sync', 'Bidirectional remediation ticket state mirroring', 'Future Roadmap'],
            ].map(([name, detail, status]) => (
              <div key={name} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <div className="font-medium text-[#E2E8F0]">{name}</div>
                  <div className="text-[11px] text-[#6B7484]">{detail}</div>
                </div>
                <span className="font-mono text-[#A1AAB8] whitespace-nowrap">{status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* API Keys Management */}
      <div className="bg-[#0F1115] border border-[#222732] rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Organization API Keys & Live Probe</h3>
            <p className="text-xs text-[#A1AAB8] mt-0.5">
              Authenticate CI/CD runners via <code className="text-white">X-VYTRON-API-Key</code>. Keys are SHA-256 hashed at rest.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleTestHealth}
              className="px-3 py-1.5 text-xs bg-[#161920] hover:bg-[#1E232E] border border-[#222732] text-white rounded inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Play className="w-3 h-3 text-[#3B82F6]" />
              <span>Probe /health</span>
            </button>
            <button
              type="button"
              onClick={handleTestWorkspace}
              className="px-3 py-1.5 text-xs bg-[#161920] hover:bg-[#1E232E] border border-[#222732] text-white rounded inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Play className="w-3 h-3 text-[#3B82F6]" />
              <span>Probe /workspace</span>
            </button>
          </div>
        </div>

        {probeResp && (
          <pre className="p-3 bg-[#08090B] border border-[#222732] rounded text-[11px] font-mono text-[#4ADE80] overflow-x-auto">
            {probeResp}
          </pre>
        )}

        {canAdminOrEng && (
          <form onSubmit={handleCreateKey} className="flex flex-wrap items-center gap-2.5">
            <input
              type="text"
              required
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="Key label (e.g. GitHub Actions Prod)"
              className="flex-1 min-w-[220px] px-3 py-2 text-xs bg-[#08090B] border border-[#222732] rounded text-white"
            />
            <button
              type="submit"
              disabled={creating}
              className="px-4 py-2 text-xs font-medium bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Generate API Key</span>
            </button>
          </form>
        )}

        {error && (
          <div className="p-3 text-xs text-[#F87171] bg-[#DC2626]/10 border border-[#DC2626]/30 rounded">
            {error}
          </div>
        )}

        {newRawKey && (
          <div className="p-3.5 bg-[#16A34A]/10 border border-[#16A34A]/30 rounded text-xs space-y-1">
            <div className="font-semibold text-[#4ADE80]">
              Copy your API key now — it will not be shown again:
            </div>
            <div className="font-mono text-white break-all select-all">{newRawKey}</div>
          </div>
        )}

        {snapshot.apiKeys.length > 0 && (
          <div className="divide-y divide-[#222732] border-t border-[#222732] text-xs">
            {snapshot.apiKeys.map((k) => (
              <div key={k.id} className="py-2.5 flex items-center justify-between gap-4">
                <div>
                  <span className="font-medium text-white">{k.name}</span>{' '}
                  <span className="font-mono text-[#6B7484]">({k.prefix}...)</span>
                  <div className="text-[11px] text-[#6B7484]">
                    Created by {k.createdBy} · Scopes: {k.scopes.join(', ')}
                  </div>
                </div>
                {canAdminOrEng && (
                  <button
                    type="button"
                    onClick={() => handleRevoke(k.id)}
                    className="p-1.5 text-[#6B7484] hover:text-[#F87171]"
                    title="Revoke API key"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Full Endpoint Reference Table & Curl Example */}
      <div className="bg-[#0F1115] border border-[#222732] rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-[#222732] flex items-center justify-between text-xs">
          <span className="font-semibold text-white">Documented REST API v1 Endpoints</span>
          <span className="font-mono text-[#6B7484]">Rate Limit: 180 req/min (25/min scan)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#222732] text-[#6B7484]">
                <th className="py-2.5 px-4 font-medium">Method</th>
                <th className="py-2.5 px-4 font-medium">Endpoint</th>
                <th className="py-2.5 px-4 font-medium">Auth Scope</th>
                <th className="py-2.5 px-4 font-medium">Behavior</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222732]">
              {apiEndpoints.map(([method, path, auth, desc]) => (
                <tr key={`${method}:${path}`} className="hover:bg-[#161920]/40">
                  <td className="py-2 px-4 font-mono text-[#3B82F6] whitespace-nowrap">{method}</td>
                  <td className="py-2 px-4 font-mono text-white whitespace-nowrap">{path}</td>
                  <td className="py-2 px-4 font-mono text-[#A1AAB8] whitespace-nowrap">{auth}</td>
                  <td className="py-2 px-4 text-[#A1AAB8]">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-5 border-t border-[#222732]">
          <pre className="p-3.5 bg-[#08090B] border border-[#222732] rounded text-[11px] font-mono text-[#A1AAB8] overflow-x-auto">
{`curl -X POST ${window.location.origin}/api/v1/sboms/ingest \\
  -H "Content-Type: application/json" \\
  -H "X-VYTRON-API-Key: <YOUR_API_KEY>" \\
  -d '{"fileName":"service-cdx.json","content":"<CYCLONEDX_OR_SPDX_PAYLOAD>","runScan":true}'`}
          </pre>
        </div>
      </div>
    </div>
  );
};

// --- MODULE 10: SETTINGS, RBAC, AUDIT & ACQUISITION ---
export const SettingsSection: React.FC<{
  snapshot: WorkspaceSnapshot;
  isAdmin: boolean;
  onRefresh: () => Promise<void>;
}> = ({ snapshot, isAdmin, onRefresh }) => {
  const [tab, setTab] = useState<'workspace' | 'audit' | 'acquisition'>('workspace');
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<UserRole>('Security Engineer');
  const [memberPassword, setMemberPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      await vytronApi.addMember({
        fullName: memberName,
        email: memberEmail,
        role: memberRole,
        password: memberPassword,
      });
      setMemberName('');
      setMemberEmail('');
      setMemberPassword('');
      await onRefresh();
      setMsg('Workspace member provisioned.');
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Failed to add member.');
    } finally {
      setBusy(false);
    }
  };

  const handleResetDemo = async () => {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      await vytronApi.resetDemo();
      await onRefresh();
      setMsg('Demonstration workspace restored to clean baseline.');
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : 'Failed to reset demo data.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-[#0F1115] border border-[#222732] rounded-md">
          {(
            [
              ['workspace', 'Workspace & RBAC'],
              ['audit', `Audit Logs (${snapshot.auditLogs.length})`],
              ['acquisition', 'Acquisition Readiness Pack'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                tab === id ? 'bg-[#161920] text-white' : 'text-[#A1AAB8] hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {snapshot.organization.isDemo && (
          <button
            type="button"
            disabled={busy}
            onClick={handleResetDemo}
            className="px-3.5 py-2 text-xs font-medium bg-[#161920] hover:bg-[#1E232E] border border-[#222732] text-[#FBBF24] rounded inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo Data</span>
          </button>
        )}
      </div>

      {err && (
        <div className="p-3 text-xs text-[#F87171] bg-[#DC2626]/10 border border-[#DC2626]/30 rounded">
          {err}
        </div>
      )}
      {msg && (
        <div className="p-3 text-xs text-[#4ADE80] bg-[#16A34A]/10 border border-[#16A34A]/30 rounded">
          {msg}
        </div>
      )}

      {tab === 'workspace' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          <div className="lg:col-span-5 bg-[#0F1115] border border-[#222732] rounded-lg p-5 space-y-3 text-xs">
            <h3 className="text-sm font-semibold text-white">Organization Profile</h3>
            <div className="space-y-2 pt-2 border-t border-[#222732]">
              <div className="flex justify-between">
                <span className="text-[#6B7484]">Organization</span>
                <span className="text-white font-medium">{snapshot.organization.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7484]">Industry</span>
                <span className="text-[#E2E8F0]">{snapshot.organization.industry}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7484]">Plan Tier</span>
                <span className="font-mono text-[#3B82F6]">{snapshot.organization.planTier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6B7484]">Workspace Mode</span>
                <span className="font-mono text-white">
                  {snapshot.organization.isDemo ? 'DEMO DATA' : 'LIVE ISOLATED'}
                </span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7 bg-[#0F1115] border border-[#222732] rounded-lg p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">
              Team Members & RBAC ({snapshot.members.length})
            </h3>
            <div className="divide-y divide-[#222732] text-xs">
              {snapshot.members.map((m) => (
                <div key={m.id} className="py-2.5 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium text-white">{m.fullName}</div>
                    <div className="font-mono text-[#6B7484]">{m.email}</div>
                  </div>
                  <span className="font-mono text-[#A1AAB8]">{m.role}</span>
                </div>
              ))}
            </div>

            {isAdmin && (
              <form
                onSubmit={handleAddMember}
                className="pt-4 border-t border-[#222732] grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs"
              >
                <input
                  type="text"
                  required
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="Full name"
                  className="px-3 py-2 bg-[#08090B] border border-[#222732] rounded text-white"
                />
                <input
                  type="email"
                  required
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="Email address"
                  className="px-3 py-2 bg-[#08090B] border border-[#222732] rounded text-white"
                />
                <select
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value as UserRole)}
                  className="px-3 py-2 bg-[#08090B] border border-[#222732] rounded text-white"
                >
                  <option value="Security Engineer">Security Engineer</option>
                  <option value="Remediation Owner">Remediation Owner</option>
                  <option value="Auditor">Auditor (Read-Only)</option>
                  <option value="Admin">Admin</option>
                </select>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={memberPassword}
                  onChange={(e) => setMemberPassword(e.target.value)}
                  placeholder="Initial password (8+ chars)"
                  className="px-3 py-2 bg-[#08090B] border border-[#222732] rounded text-white"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="sm:col-span-2 py-2 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white font-medium rounded inline-flex items-center justify-center gap-1.5"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Add Organization Member</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {tab === 'audit' && (
        <div className="bg-[#0F1115] border border-[#222732] rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#0F1115]">
                <tr className="border-b border-[#222732] text-xs text-[#6B7484]">
                  <th className="py-2.5 px-4 font-medium">Timestamp</th>
                  <th className="py-2.5 px-4 font-medium">Actor</th>
                  <th className="py-2.5 px-4 font-medium">Action</th>
                  <th className="py-2.5 px-4 font-medium">Resource</th>
                  <th className="py-2.5 px-4 font-medium">Origin</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222732] text-xs font-mono">
                {snapshot.auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#161920]/60">
                    <td className="py-2.5 px-4 text-[#6B7484] whitespace-nowrap">
                      {log.timestamp.slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="py-2.5 px-4 text-[#E2E8F0]">
                      {log.actorEmail} ({log.actorRole})
                    </td>
                    <td className="py-2.5 px-4 text-[#3B82F6]">{log.action}</td>
                    <td className="py-2.5 px-4 text-[#A1AAB8]">
                      {log.resourceType}: {log.resourceId}
                    </td>
                    <td className="py-2.5 px-4 text-[#6B7484]">{log.dataOrigin}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'acquisition' && <AcquisitionChecklistView />}
    </div>
  );
};
