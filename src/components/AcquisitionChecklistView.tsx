import React, { useState } from 'react';
import { CheckCircle2, AlertTriangle, FileText } from 'lucide-react';

export const AcquisitionChecklistView: React.FC = () => {
  const [subTab, setSubTab] = useState<'checklist' | 'onepager' | 'demo_script' | 'deployment'>(
    'checklist'
  );

  const checklistItems = [
    {
      area: 'Source-Code Ownership & IP',
      status: 'Documented',
      detail:
        '100% original TypeScript/React/Express codebase authored under clean repository structure with zero third-party GPL contamination.',
    },
    {
      area: 'Third-Party License Inventory',
      status: 'Verified',
      detail:
        'Runtime packages: React (MIT), Express (MIT), @google/genai (Apache-2.0), jsPDF (MIT), fast-xml-parser (MIT), semver (ISC), Lucide (ISC), Tailwind CSS (MIT).',
    },
    {
      area: 'Architecture & REST API v1 Documentation',
      status: 'Verified',
      detail:
        'Modular API-first /api/v1/* endpoints with sliding-window rate limiting, HMAC-SHA256 sessions, SHA-256 API keys, and org-scoped isolation.',
    },
    {
      area: 'Database Schema & PostgreSQL Path',
      status: 'Ready',
      detail:
        'Production PostgreSQL 16+ DDL provided in docs/postgres_schema.sql; MVP runs persistent atomic relational store in data/vytron-store.json.',
    },
    {
      area: 'Environment Variable Hygiene',
      status: 'Verified',
      detail:
        'Secrets strictly server-side (GEMINI_API_KEY, NVD_API_KEY optional, VYTRON_SESSION_SECRET); zero keys bundled in Vite client output.',
    },
    {
      area: 'Security Limitations (Transparent Disclosure)',
      status: 'Disclosed',
      detail:
        'MVP uses file-backed persistence and in-memory rate limiting (single-instance). Multi-node HA requires PostgreSQL + Redis rate-limiter deployment.',
    },
    {
      area: 'Known Runtime Boundaries',
      status: 'Disclosed',
      detail:
        'Python FastAPI is specified in target architecture; active sandbox runs Node.js Express TypeScript server. GitHub/GitLab/SIEM connectors are architecture-ready stubs clearly labeled as roadmap.',
    },
    {
      area: 'Verification & QA Coverage',
      status: 'Tested',
      detail:
        'TypeScript strict check (tsc --noEmit), Vite production bundle, live OSV.dev batch parsing, CycloneDX JSON/XML & SPDX JSON/Tag-Value parsers, PDF/CSV exports verified.',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#222732] pb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">
            Acquisition Readiness & Technical Due Diligence Pack
          </h2>
          <p className="text-xs text-[#A1AAB8] mt-1">
            Factual engineering inventory, IP posture, deployment runbook, and product brief for technical acquirers.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#08090B] border border-[#222732] rounded-md">
          {(
            [
              ['checklist', 'Due Diligence Checklist'],
              ['onepager', 'Product One-Pager'],
              ['demo_script', 'Acquirer Demo Script'],
              ['deployment', 'Deployment & Env'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSubTab(id)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                subTab === id ? 'bg-[#161920] text-white' : 'text-[#A1AAB8] hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {subTab === 'checklist' && (
        <div className="bg-[#0F1115] border border-[#222732] rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#222732] text-xs text-[#6B7484]">
                <th className="py-3 px-4 font-medium">Audit Domain</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Verification Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#222732] text-xs">
              {checklistItems.map((item) => (
                <tr key={item.area} className="hover:bg-[#161920]/50">
                  <td className="py-3.5 px-4 font-medium text-white whitespace-nowrap">
                    {item.area}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[#E2E8F0]">
                      {item.status === 'Disclosed' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-[#FBBF24]" />
                      ) : (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#4ADE80]" />
                      )}
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-[#A1AAB8] leading-relaxed">{item.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {subTab === 'onepager' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-[#0F1115] border border-[#222732] rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs font-mono text-[#3B82F6]">
              <FileText className="w-4 h-4" />
              <span>EXECUTIVE PRODUCT BRIEF</span>
            </div>
            <h3 className="text-base font-semibold text-white">
              VYTRON — Vendor-Neutral Supply-Chain Coordination Infrastructure
            </h3>
            <p className="text-xs text-[#A1AAB8] leading-relaxed">
              Modern enterprises ship hundreds of transitive open-source dependencies across polyglot microservices. Existing scanners generate noisy CVE lists without dependency path context, deterministic match verification, or auditable incident-to-remediation governance.
            </p>
            <p className="text-xs text-[#A1AAB8] leading-relaxed">
              VYTRON separates deterministic verification from AI explanation: SBOMs are parsed into relational dependency graphs, checked against live OSV.dev and NIST NVD advisories using semver range evaluation, escalated into evidence-gated incidents, and exported as audit-ready PDF/CSV artifacts.
            </p>
            <div className="border-t border-[#222732] pt-4 space-y-2 text-xs">
              <div className="font-semibold text-white">Target Market Segments</div>
              <p className="text-[#A1AAB8]">
                Financial Infrastructure · Healthcare Technology · Cloud Service Providers · Managed Security Service Providers (MSSPs) · Enterprise Application Security Teams
              </p>
            </div>
          </div>

          <div className="bg-[#0F1115] border border-[#222732] rounded-lg p-6 space-y-4">
            <h3 className="text-base font-semibold text-white">
              Feature Matrix & Technical Roadmap
            </h3>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-2 border-b border-[#222732]">
                <span className="text-[#E2E8F0]">CycloneDX JSON/XML & SPDX JSON/Tag-Value</span>
                <span className="font-mono text-[#4ADE80]">Implemented</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#222732]">
                <span className="text-[#E2E8F0]">Live OSV.dev + NIST NVD Deterministic Matching</span>
                <span className="font-mono text-[#4ADE80]">Implemented</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#222732]">
                <span className="text-[#E2E8F0]">Evidence-Gated Incident & Remediation Lifecycle</span>
                <span className="font-mono text-[#4ADE80]">Implemented</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#222732]">
                <span className="text-[#E2E8F0]">PDF & CSV Reports + Gemini Evidence Analyst</span>
                <span className="font-mono text-[#4ADE80]">Implemented</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#222732]">
                <span className="text-[#E2E8F0]">Managed PostgreSQL / Python FastAPI Cutover</span>
                <span className="font-mono text-[#FBBF24]">Schema Ready</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-[#E2E8F0]">GitHub/GitLab Bidirectional & SIEM Connectors</span>
                <span className="font-mono text-[#A1AAB8]">Roadmap Phase 2</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {subTab === 'demo_script' && (
        <div className="bg-[#0F1115] border border-[#222732] rounded-lg p-6 space-y-4 text-xs leading-relaxed">
          <h3 className="text-base font-semibold text-white">
            5-Minute Technical Acquirer Walkthrough Script
          </h3>
          <ol className="space-y-3 text-[#A1AAB8] list-decimal list-inside">
            <li>
              <strong className="text-white">Enter Demo Workspace (Aetheris Financial Systems):</strong> Point out explicit DEMO DATA separation and Executive KPIs across npm and PyPI manifests.
            </li>
            <li>
              <strong className="text-white">Real SBOM Ingestion & Live OSV Scan:</strong> Navigate to Software Inventory, load the Node.js Microservice CycloneDX JSON or Settlement Core XML sample, click Ingest & Scan Live OSV/NVD, and observe real-time CVE/GHSA matching against api.osv.dev.
            </li>
            <li>
              <strong className="text-white">Deterministic Exposure & Dependency Graph:</strong> Open Exposure Analysis to view transitive dependency paths and outdated flags, then switch to Dependency Graph to inspect node blast radius.
            </li>
            <li>
              <strong className="text-white">Evidence-Gated Incident Resolution:</strong> Open Incidents, attempt to set an open incident to Resolved without verification evidence (server rejects), then supply CI digest evidence and resolve.
            </li>
            <li>
              <strong className="text-white">AI Analyst & Board Report:</strong> Trigger Gemini technical explanation on a matched CVE, then generate a downloadable PDF security posture report in Reports.
            </li>
          </ol>
        </div>
      )}

      {subTab === 'deployment' && (
        <div className="bg-[#0F1115] border border-[#222732] rounded-lg p-6 space-y-4 text-xs">
          <h3 className="text-base font-semibold text-white">
            Deployment Architecture & Environment Variables
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-[#08090B] border border-[#222732] rounded space-y-2">
              <div className="font-mono text-[#3B82F6]">Required Environment Variables</div>
              <div className="font-mono text-[#E2E8F0]">GEMINI_API_KEY=&lt;server_side_secret&gt;</div>
              <div className="font-mono text-[#E2E8F0]">VYTRON_SESSION_SECRET=&lt;64_char_hex&gt;</div>
              <div className="font-mono text-[#A1AAB8]">NVD_API_KEY=&lt;optional_nist_nvd_key&gt;</div>
              <div className="font-mono text-[#A1AAB8]">PORT=3000</div>
            </div>
            <div className="p-4 bg-[#08090B] border border-[#222732] rounded space-y-2">
              <div className="font-mono text-[#3B82F6]">Production Cutover Commands</div>
              <div className="font-mono text-[#E2E8F0]">npm install</div>
              <div className="font-mono text-[#E2E8F0]">npm run build</div>
              <div className="font-mono text-[#E2E8F0]">NODE_ENV=production npm start</div>
              <div className="text-[#6B7484] mt-1">
                Apply docs/postgres_schema.sql when migrating to managed PostgreSQL.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
