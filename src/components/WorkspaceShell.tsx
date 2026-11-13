import React, { useState } from 'react';
import {
  LayoutDashboard,
  Boxes,
  ShieldAlert,
  Activity,
  GitFork,
  Flame,
  Wrench,
  FileBarChart2,
  Webhook,
  Settings,
  Menu,
  X,
  LogOut,
  Bot,
  Globe,
  RotateCcw,
} from 'lucide-react';
import { vytronApi, type WorkspaceSnapshot } from '../lib/api.ts';
import type { SafeUser } from '../types/vytron.ts';
import { VytronLogo } from './VytronLogo.tsx';
import { AiAssistantDrawer } from './AiAssistantDrawer.tsx';
import { DependencyGraphView } from './DependencyGraphView.tsx';
import { OverviewSection, type NavSectionId } from './workspace/OverviewSection.tsx';
import { InventorySection } from './workspace/InventorySection.tsx';
import { VulnerabilitiesSection } from './workspace/VulnerabilitiesSection.tsx';
import { ExposureSection } from './workspace/ExposureSection.tsx';
import { IncidentsSection } from './workspace/IncidentsSection.tsx';
import { RemediationSection } from './workspace/RemediationSection.tsx';
import {
  ApiIntegrationsSection,
  ReportsSection,
  SettingsSection,
} from './workspace/ReportsApiSettings.tsx';

interface WorkspaceShellProps {
  user: SafeUser | null;
  snapshot: WorkspaceSnapshot;
  onRefresh: () => Promise<void>;
  onSwitchDemo: (orgKey: 'aetheris' | 'kestrel') => Promise<void>;
  onLogout: () => Promise<void>;
  onViewCommercial: () => void;
}

const NAV_ITEMS: Array<{
  id: NavSectionId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'inventory', label: 'Software Inventory', icon: Boxes },
  { id: 'vulnerabilities', label: 'Vulnerability Intelligence', icon: ShieldAlert },
  { id: 'exposure', label: 'Exposure Analysis', icon: Activity },
  { id: 'graph', label: 'Dependency Graph', icon: GitFork },
  { id: 'incidents', label: 'Incidents', icon: Flame },
  { id: 'remediation', label: 'Remediation', icon: Wrench },
  { id: 'reports', label: 'Reports', icon: FileBarChart2 },
  { id: 'api', label: 'API & Integrations', icon: Webhook },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const WorkspaceShell: React.FC<WorkspaceShellProps> = ({
  user,
  snapshot,
  onRefresh,
  onSwitchDemo,
  onLogout,
  onViewCommercial,
}) => {
  const [activeNav, setActiveNav] = useState<NavSectionId>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [scanningAll, setScanningAll] = useState(false);
  const [globalNotice, setGlobalNotice] = useState<string | null>(null);

  const role = user?.role ?? 'Auditor';
  const canWrite = role === 'Admin' || role === 'Security Engineer';
  const canCoordinate =
    role === 'Admin' || role === 'Security Engineer' || role === 'Remediation Owner';
  const isAdmin = role === 'Admin';

  const handleScanAll = async () => {
    setScanningAll(true);
    setGlobalNotice(null);
    try {
      const res = await vytronApi.scanVulnerabilities();
      await onRefresh();
      setGlobalNotice(
        `OSV/NVD scan checked ${res.scannedComponents} components and matched ${res.vulnerabilitiesMatched} advisories.`
      );
    } catch (err) {
      setGlobalNotice(err instanceof Error ? err.message : 'Scan failed.');
    } finally {
      setScanningAll(false);
    }
  };

  const handleQuickResetDemo = async () => {
    await vytronApi.resetDemo();
    await onRefresh();
    setGlobalNotice('Demonstration workspace reset to baseline.');
  };

  const activeNavLabel = NAV_ITEMS.find((n) => n.id === activeNav)?.label ?? 'Overview';

  const SidebarContent = () => (
    <div className="flex flex-col h-full justify-between">
      <div>
        <div className="px-5 py-4 border-b border-[#222732] flex items-center justify-between">
          <button
            type="button"
            onClick={onViewCommercial}
            className="flex items-center gap-2.5 text-base font-bold tracking-tight text-white whitespace-nowrap"
          >
            <VytronLogo size={20} className="text-[#F4F6FA]" />
            <span>VYTRON</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 text-[#A1AAB8] hover:text-white"
            aria-label="Close navigation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-[#222732]">
          <div className="text-[11px] text-[#6B7484]">Organization Workspace</div>
          <div className="text-xs font-semibold text-white truncate mt-0.5">
            {snapshot.organization.name}
          </div>
          <div className="text-[11px] font-mono text-[#A1AAB8] mt-0.5">
            {snapshot.organization.planTier} · {role}
          </div>
        </div>

        <nav className="p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.id;
            const countBadge =
              item.id === 'incidents' && snapshot.metrics.activeIncidents > 0
                ? snapshot.metrics.activeIncidents
                : item.id === 'vulnerabilities' && snapshot.metrics.criticalFindings > 0
                ? snapshot.metrics.criticalFindings
                : null;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveNav(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[#161920] text-white border border-[#272D3A]'
                    : 'text-[#A1AAB8] hover:text-white hover:bg-[#12151B] border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#3B82F6]' : 'text-[#6B7484]'}`} />
                  <span className="truncate">{item.label}</span>
                </span>
                {countBadge !== null && (
                  <span className="font-mono text-[11px] tabular-nums text-[#A1AAB8]">
                    {countBadge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-[#222732] space-y-2 text-xs">
        {user && (
          <div className="px-3 pb-2 border-b border-[#222732]">
            <div className="font-medium text-white truncate">{user.fullName}</div>
            <div className="font-mono text-[11px] text-[#6B7484] truncate">{user.email}</div>
          </div>
        )}
        <button
          type="button"
          onClick={onViewCommercial}
          className="w-full flex items-center gap-2 px-3 py-2 text-[#A1AAB8] hover:text-white hover:bg-[#12151B] rounded transition-colors"
        >
          <Globe className="w-3.5 h-3.5" />
          <span>Commercial Overview</span>
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-[#A1AAB8] hover:text-[#F87171] hover:bg-[#12151B] rounded transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#08090B] text-[#F4F6FA] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 bg-[#0B0D11] border-r border-[#222732] sticky top-0 h-screen overflow-y-auto">
        <SidebarContent />
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-64 bg-[#0B0D11] border-r border-[#222732] h-full overflow-y-auto">
            <SidebarContent />
          </div>
          <div
            className="flex-1 bg-black/70"
            onClick={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Context Header */}
        <header className="sticky top-0 z-30 bg-[#08090B]/95 backdrop-blur-sm border-b border-[#222732] px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 text-[#A1AAB8] hover:text-white border border-[#222732] rounded"
              aria-label="Open navigation menu"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="text-sm font-semibold text-white truncate">
              {snapshot.organization.name} <span className="text-[#6B7484] mx-1">/</span>{' '}
              <span className="text-[#A1AAB8] font-normal">{activeNavLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setAiDrawerOpen(true)}
              className="px-3.5 py-1.5 text-xs font-medium bg-[#161920] hover:bg-[#1E232E] border border-[#222732] text-white rounded inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <Bot className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span>Ask Inventory AI</span>
            </button>
          </div>
        </header>

        {/* Explicit DEMO DATA Isolation Notice */}
        {snapshot.organization.isDemo && (
          <div className="bg-[#D97706]/10 border-b border-[#D97706]/30 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-[#FBBF24]">
              <strong>DEMO DATA:</strong> You are viewing a simulated enterprise workspace. Simulated findings are clearly marked DEMO_DATA; live SBOM uploads execute real OSV.dev queries.
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  onSwitchDemo(
                    snapshot.organization.id.includes('aetheris') ? 'kestrel' : 'aetheris'
                  )
                }
                className="text-white hover:underline whitespace-nowrap"
              >
                Switch Demo Org (
                {snapshot.organization.id.includes('aetheris')
                  ? 'Kestrel MedTech'
                  : 'Aetheris Financial'}
                )
              </button>
              <button
                type="button"
                onClick={handleQuickResetDemo}
                className="px-2.5 py-1 bg-[#0F1115] border border-[#D97706]/40 text-[#FBBF24] rounded inline-flex items-center gap-1 whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Demo</span>
              </button>
            </div>
          </div>
        )}

        {globalNotice && (
          <div className="mx-6 mt-4 p-3 text-xs text-[#E2E8F0] bg-[#161920] border border-[#222732] rounded flex items-center justify-between">
            <span>{globalNotice}</span>
            <button
              type="button"
              onClick={() => setGlobalNotice(null)}
              className="text-[#6B7484] hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <main className="flex-1 p-6 max-w-[1440px] w-full mx-auto">
          {activeNav === 'overview' && (
            <OverviewSection
              snapshot={snapshot}
              onNavigate={setActiveNav}
              onScanAll={handleScanAll}
              scanning={scanningAll}
            />
          )}
          {activeNav === 'inventory' && (
            <InventorySection snapshot={snapshot} canWrite={canWrite} onRefresh={onRefresh} />
          )}
          {activeNav === 'vulnerabilities' && (
            <VulnerabilitiesSection
              snapshot={snapshot}
              canWrite={canWrite}
              onRefresh={onRefresh}
            />
          )}
          {activeNav === 'exposure' && (
            <ExposureSection
              snapshot={snapshot}
              canWrite={canWrite}
              onRefresh={onRefresh}
              onNavigateSection={(sec) => setActiveNav(sec)}
            />
          )}
          {activeNav === 'graph' && (
            <DependencyGraphView
              sboms={snapshot.sboms}
              components={snapshot.components}
              dependencies={snapshot.dependencies}
              vulnerabilities={snapshot.vulnerabilities}
            />
          )}
          {activeNav === 'incidents' && (
            <IncidentsSection
              snapshot={snapshot}
              canWrite={canWrite}
              canCoordinate={canCoordinate}
              onRefresh={onRefresh}
            />
          )}
          {activeNav === 'remediation' && (
            <RemediationSection
              snapshot={snapshot}
              canCoordinate={canCoordinate}
              onRefresh={onRefresh}
            />
          )}
          {activeNav === 'reports' && <ReportsSection snapshot={snapshot} />}
          {activeNav === 'api' && (
            <ApiIntegrationsSection
              snapshot={snapshot}
              canAdminOrEng={canWrite}
              onRefresh={onRefresh}
            />
          )}
          {activeNav === 'settings' && (
            <SettingsSection snapshot={snapshot} isAdmin={isAdmin} onRefresh={onRefresh} />
          )}
        </main>
      </div>

      <AiAssistantDrawer
        open={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
        orgName={snapshot.organization.name}
        isDemo={snapshot.organization.isDemo}
      />
    </div>
  );
};
