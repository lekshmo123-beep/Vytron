import React, { useState } from 'react';
import { ArrowRight, Check, Loader2, ShieldAlert } from 'lucide-react';
import { vytronApi } from '../lib/api.ts';
import { AcquisitionChecklistView } from './AcquisitionChecklistView.tsx';
import { VytronLogo } from './VytronLogo.tsx';
import heroInfrastructureImg from '../assets/images/hero_vytron_infrastructure_1794548115227.jpg';

interface CommercialPortalProps {
  onLaunchDemo: (orgKey?: 'aetheris' | 'kestrel') => Promise<void>;
  onOpenAuth: (mode: 'login' | 'register' | 'demo') => void;
  onReturnToWorkspace?: () => void;
  hasActiveSession?: boolean;
  demoLoading: boolean;
}

export const CommercialPortal: React.FC<CommercialPortalProps> = ({
  onLaunchDemo,
  onOpenAuth,
  onReturnToWorkspace,
  hasActiveSession = false,
  demoLoading,
}) => {
  const [imgError, setImgError] = useState(false);
  const [activePage, setActivePage] = useState<'overview' | 'acquisition'>('overview');

  // Enquiry Form State
  const [fullName, setFullName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [company, setCompany] = useState('');
  const [teamSize, setTeamSize] = useState('50–250 engineers');
  const [interestTier, setInterestTier] = useState('Enterprise');
  const [message, setMessage] = useState('');
  const [submittingEnquiry, setSubmittingEnquiry] = useState(false);
  const [enquirySuccess, setEnquirySuccess] = useState<string | null>(null);
  const [enquiryError, setEnquiryError] = useState<string | null>(null);

  const handleEnquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnquiryError(null);
    setEnquirySuccess(null);
    setSubmittingEnquiry(true);
    try {
      const res = await vytronApi.submitEnquiry({
        fullName,
        workEmail,
        company,
        teamSize,
        interestTier,
        message,
      });
      setEnquirySuccess(`${res.message} Reference ID: ${res.id}`);
      setFullName('');
      setWorkEmail('');
      setCompany('');
      setMessage('');
    } catch (err) {
      setEnquiryError(err instanceof Error ? err.message : 'Unable to submit enquiry.');
    } finally {
      setSubmittingEnquiry(false);
    }
  };

  const scrollToSection = (sectionId: string) => {
    const needsSwitch = activePage !== 'overview';
    setActivePage('overview');
    window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
    }, needsSwitch ? 60 : 0);
  };

  return (
    <div className="min-h-screen bg-[#08090B] text-[#F4F6FA]">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-40 bg-[#08090B]/95 backdrop-blur-sm border-b border-[#222732]">
        <div className="max-w-[1280px] mx-auto px-6 py-4 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => {
              setActivePage('overview');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            <VytronLogo size={22} className="text-[#F4F6FA]" />
            <span>VYTRON</span>
          </button>

          {/* Zone 2: 4 concise single-line text links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#A1AAB8]">
            <button
              type="button"
              onClick={() => scrollToSection('platform')}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Platform
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('architecture')}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Architecture
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('pricing')}
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Pricing
            </button>
            <button
              type="button"
              onClick={() =>
                setActivePage(activePage === 'acquisition' ? 'overview' : 'acquisition')
              }
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                activePage === 'acquisition' ? 'text-white underline underline-offset-4' : ''
              }`}
            >
              Acquisition Pack
            </button>
          </nav>

          {/* Zone 3: 1 primary CTA */}
          <div className="shrink-0">
            <button
              type="button"
              disabled={demoLoading}
              onClick={() =>
                hasActiveSession && onReturnToWorkspace
                  ? onReturnToWorkspace()
                  : onLaunchDemo('aetheris')
              }
              className="px-4 py-2 text-xs font-medium bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 disabled:opacity-60"
            >
              {demoLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{hasActiveSession ? 'Open Workspace' : 'Launch Demo'}</span>
            </button>
          </div>
        </div>
      </header>

      {activePage === 'acquisition' ? (
        <main className="max-w-[1280px] mx-auto px-6 py-12 space-y-8">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setActivePage('overview')}
              className="text-xs font-medium text-[#3B82F6] hover:underline"
            >
              ← Return to Platform Overview
            </button>
          </div>
          <AcquisitionChecklistView />
        </main>
      ) : (
        <main>
          {/* Hero Split Section */}
          <section className="max-w-[1280px] mx-auto px-6 pt-16 pb-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
              <div className="lg:col-span-6 flex flex-col justify-between space-y-8">
                <div className="space-y-5">
                  <div className="text-xs font-mono text-[#3B82F6] tracking-wide">
                    Enterprise Supply-Chain Intelligence Infrastructure
                  </div>
                  <h1
                    className="font-bold tracking-tight text-white leading-[1.08]"
                    style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', textWrap: 'balance' }}
                  >
                    Know what connects. Know what is at risk.
                  </h1>
                  <p className="text-base text-[#A1AAB8] leading-relaxed max-w-xl">
                    VYTRON ingests CycloneDX and SPDX software bills of materials, evaluates live OSV and NIST NVD advisories deterministically, maps transitive exposure across applications, and coordinates evidence-verified remediation.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={demoLoading}
                      onClick={() => onLaunchDemo('aetheris')}
                      className="px-5 py-3 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-medium rounded transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0"
                    >
                      <span>Enter Interactive Demo</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenAuth('login')}
                      className="px-5 py-3 bg-[#0F1115] hover:bg-[#161920] border border-[#222732] text-[#E2E8F0] text-sm font-medium rounded transition-colors whitespace-nowrap shrink-0"
                    >
                      Sign In / Create Workspace
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-[#6B7484]">
                    <span>CycloneDX JSON & XML</span>
                    <span aria-hidden="true">·</span>
                    <span>SPDX 2.3 JSON & Tag-Value</span>
                    <span aria-hidden="true">·</span>
                    <span>Live OSV.dev & NIST NVD</span>
                    <span aria-hidden="true">·</span>
                    <span>Organization Isolation</span>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="h-full min-h-[320px] bg-[#0F1115] border border-[#222732] rounded-lg overflow-hidden relative">
                  {!imgError ? (
                    <img
                      src={heroInfrastructureImg}
                      alt="VYTRON deterministic dependency node infrastructure visualization"
                      referrerPolicy="no-referrer"
                      onError={() => setImgError(true)}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-[#0F1115]">
                      <VytronLogo size={56} className="text-[#3B82F6] mb-4" />
                      <div className="text-sm font-medium text-[#A1AAB8]">
                        Deterministic Dependency Topology Engine
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Full-width 4-Column Capability Strip Below Hero */}
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-[#222732] bg-[#0F1115] rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-[#222732]">
              <div className="p-5">
                <div className="text-xs text-[#6B7484]">01. Ingestion Engine</div>
                <div className="text-sm font-semibold text-white mt-1.5">
                  Multi-Format SBOM Parser
                </div>
                <p className="text-xs text-[#A1AAB8] mt-1.5 leading-relaxed">
                  Extracts PURLs, licenses, suppliers, duplicates, and dependency edges without fabrication.
                </p>
              </div>
              <div className="p-5">
                <div className="text-xs text-[#6B7484]">02. Deterministic Matching</div>
                <div className="text-sm font-semibold text-white mt-1.5">
                  OSV & NIST NVD Verification
                </div>
                <p className="text-xs text-[#A1AAB8] mt-1.5 leading-relaxed">
                  Semver range checks separate confirmed matches from unverified advisories.
                </p>
              </div>
              <div className="p-5">
                <div className="text-xs text-[#6B7484]">03. Exposure Routing</div>
                <div className="text-sm font-semibold text-white mt-1.5">
                  Transitive Blast Radius
                </div>
                <p className="text-xs text-[#A1AAB8] mt-1.5 leading-relaxed">
                  Traces vulnerable packages back to root applications and flags unpatched dependencies.
                </p>
              </div>
              <div className="p-5">
                <div className="text-xs text-[#6B7484]">04. Audit Governance</div>
                <div className="text-sm font-semibold text-white mt-1.5">
                  Evidence-Gated Resolution
                </div>
                <p className="text-xs text-[#A1AAB8] mt-1.5 leading-relaxed">
                  Incidents and remediations enforce verification evidence and export PDF/CSV trails.
                </p>
              </div>
            </div>
          </section>

          {/* Platform Capabilities Asymmetric Bento */}
          <section id="platform" className="max-w-[1280px] mx-auto px-6 py-16 border-t border-[#222732]">
            <div className="max-w-2xl mb-10">
              <div className="text-xs font-mono text-[#3B82F6] mb-2">Core Platform Modules</div>
              <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
                Engineered for verifiable software supply-chain coordination
              </h2>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              <div className="lg:col-span-7 bg-[#0F1115] border border-[#222732] rounded-lg p-7 space-y-4">
                <div className="text-xs text-[#6B7484]">Deterministic Intelligence · Zero Hallucination</div>
                <h3 className="text-lg font-semibold text-white">
                  Software logic verifies risk. Gemini explains the evidence.
                </h3>
                <p className="text-sm text-[#A1AAB8] leading-relaxed">
                  VYTRON never asks a language model to guess whether a package is vulnerable. Package matching runs strictly through PURL normalization, OSV.dev batch queries, NIST NVD CVSS lookup, and semver interval math. Gemini operates solely on retrieved advisory records to accelerate engineer triage and executive reporting.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-[#222732] text-xs">
                  <div>
                    <div className="font-mono text-white">Confirmed Match</div>
                    <div className="text-[#6B7484] mt-1">Exact version in OSV affected range</div>
                  </div>
                  <div>
                    <div className="font-mono text-white">Potentially Affected</div>
                    <div className="text-[#6B7484] mt-1">Ecosystem match requiring range check</div>
                  </div>
                  <div>
                    <div className="font-mono text-white">Verified Clean</div>
                    <div className="text-[#6B7484] mt-1">Timestamped zero-hit OSV check</div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 bg-[#0F1115] border border-[#222732] rounded-lg p-7 space-y-4">
                <div className="text-xs text-[#6B7484]">Coordinated Response</div>
                <h3 className="text-lg font-semibold text-white">
                  End-to-end incident & remediation accountability
                </h3>
                <p className="text-sm text-[#A1AAB8] leading-relaxed">
                  Escalate exposed components directly into owned security incidents. Track due dates, investigation notes, and immutable audit history. Incidents cannot be marked Resolved until verification evidence is recorded.
                </p>
                <div className="pt-3 border-t border-[#222732] flex items-center justify-between text-xs">
                  <span className="text-[#A1AAB8]">RBAC Roles Supported</span>
                  <span className="font-mono text-white">Admin · Engineer · Owner · Auditor</span>
                </div>
              </div>
            </div>

            {/* Target Enterprise Sectors */}
            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-[#0F1115] border border-[#222732] rounded-lg p-5 space-y-1.5">
                <div className="text-xs font-medium text-white">Financial & Healthcare Engineering</div>
                <p className="text-xs text-[#A1AAB8] leading-relaxed">
                  Maintain verifiable SBOM history, license inventories, and evidence-backed remediation trails per business unit.
                </p>
              </div>
              <div className="bg-[#0F1115] border border-[#222732] rounded-lg p-5 space-y-1.5">
                <div className="text-xs font-medium text-white">Cloud & SaaS Product Teams</div>
                <p className="text-xs text-[#A1AAB8] leading-relaxed">
                  Integrate automated CycloneDX and SPDX uploads directly from CI/CD pipelines via scoped organization API keys.
                </p>
              </div>
              <div className="bg-[#0F1115] border border-[#222732] rounded-lg p-5 space-y-1.5">
                <div className="text-xs font-medium text-white">Managed Security Providers (MSSPs)</div>
                <p className="text-xs text-[#A1AAB8] leading-relaxed">
                  Coordinate client exposure across isolated workspaces and generate board-ready PDF and CSV deliverables.
                </p>
              </div>
            </div>
          </section>

          {/* Technical Architecture & API Overview */}
          <section id="architecture" className="max-w-[1280px] mx-auto px-6 py-16 border-t border-[#222732]">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-5 space-y-4">
                <div className="text-xs font-mono text-[#3B82F6]">API-First Architecture</div>
                <h2 className="text-2xl font-semibold text-white tracking-tight">
                  Versioned REST API for CI/CD pipelines & security teams
                </h2>
                <p className="text-sm text-[#A1AAB8] leading-relaxed">
                  Every dashboard workflow is backed by versioned /api/v1 endpoints protected by HMAC-SHA256 sessions or scoped X-VYTRON-API-Key credentials, sliding-window rate limiting, and strict organization-level tenant isolation.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => onOpenAuth('register')}
                    className="text-xs font-medium text-[#3B82F6] hover:underline"
                  >
                    Create an organization to generate API keys →
                  </button>
                </div>
              </div>

              <div className="lg:col-span-7 bg-[#0F1115] border border-[#222732] rounded-lg overflow-hidden">
                <div className="px-5 py-3 border-b border-[#222732] flex items-center justify-between text-xs font-mono text-[#A1AAB8]">
                  <span>Core /api/v1 Surface</span>
                  <span>JSON · Rate-Limited · Org-Isolated</span>
                </div>
                <div className="divide-y divide-[#222732] text-xs font-mono">
                  {[
                    ['POST', '/api/v1/sboms/ingest', 'Validate, parse & store CycloneDX / SPDX manifests'],
                    ['POST', '/api/v1/vulnerabilities/scan', 'Execute deterministic OSV.dev + NIST NVD matching'],
                    ['GET', '/api/v1/workspace', 'Retrieve org-isolated inventory, exposures & incidents'],
                    ['POST', '/api/v1/incidents', 'Open security incident linked to vulnerability IDs'],
                    ['PATCH', '/api/v1/remediations/:id', 'Update remediation status with verification evidence'],
                    ['GET', '/api/v1/reports/csv', 'Export classification-tagged audit CSV report'],
                  ].map(([method, endpoint, desc]) => (
                    <div
                      key={endpoint}
                      className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-[#3B82F6] w-12 shrink-0">{method}</span>
                        <span className="text-white">{endpoint}</span>
                      </div>
                      <span className="text-[#6B7484] font-sans">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Commercial Pricing Architecture */}
          <section id="pricing" className="max-w-[1280px] mx-auto px-6 py-16 border-t border-[#222732]">
            <div className="max-w-2xl mb-10">
              <div className="text-xs font-mono text-[#3B82F6] mb-2">Commercial Model</div>
              <h2 className="text-2xl sm:text-3xl font-semibold text-white tracking-tight">
                Structured licensing from developer teams to regulated enterprises
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                {
                  tier: 'Developer',
                  audience: 'For individual engineers & OSS maintainers',
                  price: '$0 / month',
                  limits: [
                    'Up to 5 tracked SBOM applications',
                    'CycloneDX & SPDX ingestion',
                    'Live OSV.dev deterministic matching',
                    'CSV & PDF report export',
                  ],
                  cta: 'Start Developer Workspace',
                  action: () => onOpenAuth('register'),
                },
                {
                  tier: 'Professional',
                  audience: 'For scaling product & AppSec teams',
                  price: '$490 / month',
                  limits: [
                    'Up to 50 applications & CI/CD webhooks',
                    'OSV + NIST NVD enrichment',
                    'Incident & remediation workflows',
                    'Role-based access (up to 15 seats)',
                  ],
                  cta: 'Provision Professional',
                  action: () => onOpenAuth('register'),
                },
                {
                  tier: 'Enterprise',
                  audience: 'For financial, healthcare & regulated orgs',
                  price: 'Custom annual',
                  limits: [
                    'Unlimited applications & org workspaces',
                    'Dedicated PostgreSQL & VPC deployment',
                    'Full immutable audit log retention',
                    'Custom SLA & security architecture review',
                  ],
                  cta: 'Contact Enterprise Team',
                  action: () => scrollToSection('contact'),
                },
                {
                  tier: 'API Usage-Based',
                  audience: 'For MSSPs & platform infrastructure vendors',
                  price: 'Metered per 1K scans',
                  limits: [
                    'Headless /api/v1/sboms/ingest ingestion',
                    'Multi-tenant client workspace isolation',
                    'Programmatic PDF/CSV report hooks',
                    'Volume-tiered API rate allocations',
                  ],
                  cta: 'Request API Allocation',
                  action: () => scrollToSection('contact'),
                },
              ].map((plan) => (
                <div
                  key={plan.tier}
                  className="bg-[#0F1115] border border-[#222732] hover:border-[#323A4A] rounded-lg p-6 flex flex-col justify-between space-y-6 transition-colors"
                >
                  <div className="space-y-3">
                    <div className="text-xs text-[#6B7484]">{plan.audience}</div>
                    <h3 className="text-lg font-semibold text-white">{plan.tier}</h3>
                    <div className="text-xl font-mono font-semibold text-white tabular-nums">
                      {plan.price}
                    </div>
                    <ul className="space-y-2 pt-3 border-t border-[#222732] text-xs text-[#A1AAB8]">
                      {plan.limits.map((lim) => (
                        <li key={lim} className="flex items-start gap-2">
                          <Check className="w-3.5 h-3.5 text-[#3B82F6] shrink-0 mt-0.5" />
                          <span>{lim}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    type="button"
                    onClick={plan.action}
                    className="w-full py-2 px-3 text-xs font-medium bg-[#161920] hover:bg-[#1E232E] border border-[#222732] text-white rounded transition-colors whitespace-nowrap"
                  >
                    {plan.cta}
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Enterprise Enquiry Form & Acquisition Link */}
          <section id="contact" className="max-w-[1280px] mx-auto px-6 py-16 border-t border-[#222732]">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-5 space-y-5">
                <div className="text-xs font-mono text-[#3B82F6]">Enterprise & Acquisition Enquiries</div>
                <h2 className="text-2xl font-semibold text-white tracking-tight">
                  Deploy VYTRON or review technical due diligence
                </h2>
                <p className="text-sm text-[#A1AAB8] leading-relaxed">
                  Request dedicated single-tenant deployment guidance, MSSP API licensing, or inspect VYTRON’s complete acquisition-readiness architecture checklist.
                </p>

                <div className="p-4 bg-[#0F1115] border border-[#222732] rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-white">
                    <ShieldAlert className="w-4 h-4 text-[#3B82F6]" />
                    <span>Transparency Commitment</span>
                  </div>
                  <p className="text-xs text-[#A1AAB8] leading-relaxed">
                    VYTRON publishes exact runtime boundaries without fabricated customer counts, unverified compliance badges, or synthetic vulnerability results.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setActivePage('acquisition');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="text-xs font-medium text-[#3B82F6] hover:underline pt-1"
                  >
                    Open Acquisition Readiness Pack →
                  </button>
                </div>
              </div>

              <div className="lg:col-span-7 bg-[#0F1115] border border-[#222732] rounded-lg p-6">
                <form onSubmit={handleEnquirySubmit} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#A1AAB8] mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Alex Mercer"
                        className="w-full px-3 py-2 text-sm bg-[#08090B] border border-[#222732] rounded text-white focus:outline-none focus:border-[#3B82F6]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#A1AAB8] mb-1">
                        Work Email
                      </label>
                      <input
                        type="email"
                        required
                        value={workEmail}
                        onChange={(e) => setWorkEmail(e.target.value)}
                        placeholder="alex@enterprise.io"
                        className="w-full px-3 py-2 text-sm bg-[#08090B] border border-[#222732] rounded text-white focus:outline-none focus:border-[#3B82F6]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-[#A1AAB8] mb-1">
                        Organization
                      </label>
                      <input
                        type="text"
                        required
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="Organization Name"
                        className="w-full px-3 py-2 text-sm bg-[#08090B] border border-[#222732] rounded text-white focus:outline-none focus:border-[#3B82F6]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#A1AAB8] mb-1">
                        Engineering Size
                      </label>
                      <select
                        value={teamSize}
                        onChange={(e) => setTeamSize(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-[#08090B] border border-[#222732] rounded text-white focus:outline-none focus:border-[#3B82F6]"
                      >
                        <option>10–50 engineers</option>
                        <option>50–250 engineers</option>
                        <option>250–1,000 engineers</option>
                        <option>1,000+ engineers</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[#A1AAB8] mb-1">
                        Target Tier
                      </label>
                      <select
                        value={interestTier}
                        onChange={(e) => setInterestTier(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-[#08090B] border border-[#222732] rounded text-white focus:outline-none focus:border-[#3B82F6]"
                      >
                        <option>Professional</option>
                        <option>Enterprise</option>
                        <option>API Usage-Based</option>
                        <option>Strategic Acquisition</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#A1AAB8] mb-1">
                      Infrastructure Requirements
                    </label>
                    <textarea
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Describe SBOM volume, CI/CD pipelines, or deployment requirements..."
                      className="w-full px-3 py-2 text-sm bg-[#08090B] border border-[#222732] rounded text-white focus:outline-none focus:border-[#3B82F6]"
                    />
                  </div>

                  {enquiryError && (
                    <div className="p-3 text-xs text-[#F87171] bg-[#DC2626]/10 border border-[#DC2626]/30 rounded">
                      {enquiryError}
                    </div>
                  )}
                  {enquirySuccess && (
                    <div className="p-3 text-xs text-[#4ADE80] bg-[#16A34A]/10 border border-[#16A34A]/30 rounded">
                      {enquirySuccess}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submittingEnquiry}
                    className="px-5 py-2.5 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-medium rounded transition-colors inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    {submittingEnquiry && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Submit Enterprise Enquiry</span>
                  </button>
                </form>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* Quiet Footer */}
      <footer className="border-t border-[#222732] py-8">
        <div className="max-w-[1280px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6B7484]">
          <div className="flex items-center gap-2.5">
            <VytronLogo size={16} className="text-[#A1AAB8]" />
            <span>VYTRON Infrastructure · Know what connects. Know what is at risk.</span>
          </div>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => onLaunchDemo('aetheris')}
              className="hover:text-white transition-colors"
            >
              Demo Workspace
            </button>
            <button
              type="button"
              onClick={() => {
                setActivePage('acquisition');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="hover:text-white transition-colors"
            >
              Acquisition Checklist
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="hover:text-white transition-colors"
            >
              Workspace Login
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
