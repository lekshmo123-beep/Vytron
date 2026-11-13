import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  getStoredToken,
  setStoredToken,
  vytronApi,
  type WorkspaceSnapshot,
} from './lib/api.ts';
import type { Organization, SafeUser } from './types/vytron.ts';
import { CommercialPortal } from './components/CommercialPortal.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { WorkspaceShell } from './components/WorkspaceShell.tsx';

export default function App() {
  const [initializing, setInitializing] = useState(true);
  const [user, setUser] = useState<SafeUser | null>(null);
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [viewMode, setViewMode] = useState<'commercial' | 'workspace'>('commercial');

  const [authModalMode, setAuthModalMode] = useState<'login' | 'register' | 'demo' | null>(null);
  const [demoLoading, setDemoLoading] = useState(false);

  const loadWorkspace = useCallback(async () => {
    const [me, ws] = await Promise.all([vytronApi.me(), vytronApi.getWorkspace()]);
    setUser(me.user);
    setSnapshot(ws);
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setInitializing(false);
      return;
    }
    loadWorkspace()
      .then(() => setViewMode('workspace'))
      .catch(() => {
        setStoredToken(null);
      })
      .finally(() => setInitializing(false));
  }, [loadWorkspace]);

  const handleLaunchDemo = async (orgKey: 'aetheris' | 'kestrel' = 'aetheris') => {
    setDemoLoading(true);
    try {
      const res = await vytronApi.enterDemo(orgKey);
      setStoredToken(res.token);
      setUser(res.user);
      const ws = await vytronApi.getWorkspace();
      setSnapshot(ws);
      setViewMode('workspace');
      setAuthModalMode(null);
    } finally {
      setDemoLoading(false);
    }
  };

  const handleAuthenticated = async (authedUser: SafeUser, _org: Organization) => {
    setUser(authedUser);
    const ws = await vytronApi.getWorkspace();
    setSnapshot(ws);
    setAuthModalMode(null);
    setViewMode('workspace');
  };

  const handleLogout = async () => {
    try {
      await vytronApi.logout();
    } catch {
      // ignore if token already expired
    }
    setStoredToken(null);
    setUser(null);
    setSnapshot(null);
    setViewMode('commercial');
  };

  if (initializing) {
    return (
      <div className="min-h-screen bg-[#08090B] flex items-center justify-center text-[#A1AAB8] text-xs gap-2.5">
        <Loader2 className="w-4 h-4 animate-spin text-[#3B82F6]" />
        <span>Initializing VYTRON workspace...</span>
      </div>
    );
  }

  return (
    <>
      {viewMode === 'workspace' && snapshot ? (
        <WorkspaceShell
          user={user}
          snapshot={snapshot}
          onRefresh={loadWorkspace}
          onSwitchDemo={handleLaunchDemo}
          onLogout={handleLogout}
          onViewCommercial={() => setViewMode('commercial')}
        />
      ) : (
        <CommercialPortal
          onLaunchDemo={handleLaunchDemo}
          onOpenAuth={(mode) => setAuthModalMode(mode)}
          onReturnToWorkspace={() => setViewMode('workspace')}
          hasActiveSession={Boolean(snapshot)}
          demoLoading={demoLoading}
        />
      )}

      {authModalMode && (
        <AuthModal
          initialMode={authModalMode}
          onClose={() => setAuthModalMode(null)}
          onAuthenticated={handleAuthenticated}
        />
      )}
    </>
  );
}
