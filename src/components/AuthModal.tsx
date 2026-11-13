import React, { useState } from 'react';
import { X, ArrowRight, Loader2 } from 'lucide-react';
import { vytronApi, setStoredToken } from '../lib/api.ts';
import type { Organization, SafeUser } from '../types/vytron.ts';
import { VytronLogo } from './VytronLogo.tsx';

interface AuthModalProps {
  initialMode?: 'login' | 'register' | 'demo';
  onClose: () => void;
  onAuthenticated: (user: SafeUser, organization: Organization) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  initialMode = 'login',
  onClose,
  onAuthenticated,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'demo'>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [orgName, setOrgName] = useState('');
  const [industry, setIndustry] = useState('Software Engineering');
  const [planTier, setPlanTier] = useState('Professional');
  const [fullName, setFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await vytronApi.login({ email: loginEmail, password: loginPassword });
      setStoredToken(res.token);
      onAuthenticated(res.user, res.organization);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await vytronApi.register({
        organizationName: orgName,
        industry,
        planTier,
        fullName,
        email: regEmail,
        password: regPassword,
      });
      setStoredToken(res.token);
      onAuthenticated(res.user, res.organization);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Workspace registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleEnterDemo = async (orgKey: 'aetheris' | 'kestrel') => {
    setError(null);
    setLoading(true);
    try {
      const res = await vytronApi.enterDemo(orgKey);
      setStoredToken(res.token);
      onAuthenticated(res.user, res.organization);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize demo session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="w-full max-w-lg bg-[#0F1115] border border-[#222732] rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#222732]">
          <div className="flex items-center gap-3">
            <VytronLogo size={20} className="text-[#F4F6FA]" />
            <h2 id="auth-modal-title" className="text-base font-semibold text-[#F4F6FA]">
              VYTRON Workspace Access
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#A1AAB8] hover:text-white transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Segmented Tabs */}
        <div className="px-6 pt-5">
          <div className="grid grid-cols-3 gap-1 p-1 bg-[#08090B] border border-[#222732] rounded-md">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-2 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-[#161920] text-white'
                  : 'text-[#A1AAB8] hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`py-2 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                mode === 'register'
                  ? 'bg-[#161920] text-white'
                  : 'text-[#A1AAB8] hover:text-white'
              }`}
            >
              Create Workspace
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('demo');
                setError(null);
              }}
              className={`py-2 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                mode === 'demo'
                  ? 'bg-[#161920] text-white'
                  : 'text-[#A1AAB8] hover:text-white'
              }`}
            >
              Demo Environments
            </button>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 px-3.5 py-2.5 text-xs text-[#F87171] bg-[#DC2626]/10 border border-[#DC2626]/30 rounded">
              {error}
            </div>
          )}

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#A1AAB8] mb-1.5">
                  Work Email
                </label>
                <input
                  type="email"
                  required
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="secops@company.com"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#08090B] border border-[#222732] rounded text-white focus:outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A1AAB8] mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#08090B] border border-[#222732] rounded text-white focus:outline-none focus:border-[#3B82F6]"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Sign In to Workspace</span>
              </button>
              <p className="text-xs text-[#6B7484]">
                Need an isolated production workspace? Switch to Create Workspace, or inspect Demo Environments.
              </p>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-[#A1AAB8] mb-1">
                    Organization Name
                  </label>
                  <input
                    type="text"
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Meridian Cloud Corp"
                    className="w-full px-3 py-2 text-sm bg-[#08090B] border border-[#222732] rounded text-white focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A1AAB8] mb-1">
                    Industry
                  </label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#08090B] border border-[#222732] rounded text-white focus:outline-none focus:border-[#3B82F6]"
                  >
                    <option value="Software Engineering">Software Engineering</option>
                    <option value="Financial Infrastructure">Financial Infrastructure</option>
                    <option value="Healthcare Technology">Healthcare Technology</option>
                    <option value="Cloud & Managed Security">Cloud & Managed Security</option>
                    <option value="Enterprise IT">Enterprise IT</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-[#A1AAB8] mb-1">
                    Your Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jordan Alvarez"
                    className="w-full px-3 py-2 text-sm bg-[#08090B] border border-[#222732] rounded text-white focus:outline-none focus:border-[#3B82F6]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#A1AAB8] mb-1">
                    Workspace Tier
                  </label>
                  <select
                    value={planTier}
                    onChange={(e) => setPlanTier(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-[#08090B] border border-[#222732] rounded text-white focus:outline-none focus:border-[#3B82F6]"
                  >
                    <option value="Developer">Developer</option>
                    <option value="Professional">Professional</option>
                    <option value="Enterprise">Enterprise</option>
                    <option value="API Usage">API Usage-Based</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A1AAB8] mb-1">
                  Admin Email
                </label>
                <input
                  type="email"
                  required
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="jordan@meridiancloud.io"
                  className="w-full px-3 py-2 text-sm bg-[#08090B] border border-[#222732] rounded text-white focus:outline-none focus:border-[#3B82F6]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#A1AAB8] mb-1">
                  Password (8+ characters)
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="Strong passphrase"
                  className="w-full px-3 py-2 text-sm bg-[#08090B] border border-[#222732] rounded text-white focus:outline-none focus:border-[#3B82F6]"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-medium rounded transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Provision Isolated Workspace</span>
              </button>
              <p className="text-xs text-[#6B7484]">
                New workspaces start empty with live OSV.dev and NIST NVD verification enabled.
              </p>
            </form>
          )}

          {mode === 'demo' && (
            <div className="space-y-3.5">
              <p className="text-xs text-[#A1AAB8] leading-relaxed">
                Select a pre-populated demonstration organization. All simulated findings are explicitly labeled DEMO DATA and isolated from live production workspaces.
              </p>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleEnterDemo('aetheris')}
                className="w-full text-left p-4 bg-[#161920] hover:bg-[#1B2029] border border-[#222732] rounded-md transition-colors flex items-center justify-between gap-4"
              >
                <div>
                  <div className="text-sm font-semibold text-white">
                    Aetheris Financial Systems (DEMO)
                  </div>
                  <div className="text-xs text-[#A1AAB8] mt-1">
                    Financial Infrastructure · Node.js & PyPI SBOMs · 6 Exposure Findings
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#3B82F6] shrink-0" />
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => handleEnterDemo('kestrel')}
                className="w-full text-left p-4 bg-[#161920] hover:bg-[#1B2029] border border-[#222732] rounded-md transition-colors flex items-center justify-between gap-4"
              >
                <div>
                  <div className="text-sm font-semibold text-white">
                    Kestrel MedTech Cloud (DEMO)
                  </div>
                  <div className="text-xs text-[#A1AAB8] mt-1">
                    Healthcare Technology · Maven CycloneDX XML · Active Critical Incident
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-[#3B82F6] shrink-0" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
