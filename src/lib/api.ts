import type {
  CommercialEnquiry,
  DashboardMetrics,
  ExposureFinding,
  Incident,
  Organization,
  RemediationTask,
  SafeUser,
  SbomRecord,
  UserRole,
  VulnerabilityMatch,
  ComponentRecord,
  DependencyEdge,
  AuditLogEntry,
} from '../types/vytron.ts';

export interface WorkspaceSnapshot {
  organization: Organization;
  metrics: DashboardMetrics;
  sboms: SbomRecord[];
  components: ComponentRecord[];
  dependencies: DependencyEdge[];
  vulnerabilities: VulnerabilityMatch[];
  exposures: ExposureFinding[];
  incidents: Incident[];
  remediations: RemediationTask[];
  auditLogs: AuditLogEntry[];
  members: SafeUser[];
  apiKeys: Array<{
    id: string;
    orgId: string;
    name: string;
    prefix: string;
    createdBy: string;
    createdAt: string;
    lastUsedAt?: string;
    scopes: string[];
  }>;
}

export interface SampleSbom {
  id: string;
  label: string;
  fileName: string;
  format: string;
  applicationName: string;
  description: string;
  content: string;
}

const TOKEN_STORAGE_KEY = 'vytron_session_token';

let memoryToken: string | null = null;

export function getStoredToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    const val = sessionStorage.getItem(TOKEN_STORAGE_KEY);
    memoryToken = val;
    return val;
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  memoryToken = token;
  try {
    if (token) sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    else sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // ignore storage restrictions
  }
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const resp = await fetch(`/api/v1${path}`, {
    ...options,
    headers,
  });

  const text = await resp.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
  }

  if (!resp.ok) {
    const msg =
      (data as { error?: string })?.error || `Request failed with HTTP ${resp.status}`;
    throw new Error(msg);
  }

  return data as T;
}

export const vytronApi = {
  health: () => apiFetch<{ status: string; service: string; version: string; timestamp: string }>('/health'),

  getSampleSboms: () => apiFetch<{ samples: SampleSbom[] }>('/sboms/samples'),

  submitEnquiry: (payload: {
    fullName: string;
    workEmail: string;
    company: string;
    teamSize: string;
    interestTier: string;
    message: string;
  }) =>
    apiFetch<{ id: string; message: string; createdAt: string; enquiry?: CommercialEnquiry }>(
      '/enquiries',
      { method: 'POST', body: JSON.stringify(payload) }
    ),

  register: (payload: {
    organizationName: string;
    industry: string;
    fullName: string;
    email: string;
    password: string;
    planTier: string;
  }) =>
    apiFetch<{ token: string; user: SafeUser; organization: Organization }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (payload: { email: string; password: string }) =>
    apiFetch<{ token: string; user: SafeUser; organization: Organization }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  enterDemo: (demoOrg: 'aetheris' | 'kestrel' = 'aetheris') =>
    apiFetch<{ token: string; user: SafeUser; organization: Organization }>('/auth/demo', {
      method: 'POST',
      body: JSON.stringify({ demoOrg }),
    }),

  logout: () => apiFetch<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  me: () => apiFetch<{ user: SafeUser | null; organization: Organization }>('/auth/me'),

  getWorkspace: () => apiFetch<WorkspaceSnapshot>('/workspace'),

  resetDemo: () => apiFetch<{ ok: boolean; snapshot: WorkspaceSnapshot }>('/demo/reset', { method: 'POST' }),

  ingestSbom: (payload: {
    content: string;
    fileName: string;
    applicationName?: string;
    runScan?: boolean;
  }) =>
    apiFetch<{
      sbom: SbomRecord;
      componentsCount: number;
      edgesCount: number;
      duplicatesDetected: number;
      scanSummary: {
        vulnerabilitiesFound: number;
        exposuresCreated: number;
        osvReachable: boolean;
        nvdChecksAttempted: number;
        warnings: string[];
      } | null;
    }>('/sboms/ingest', { method: 'POST', body: JSON.stringify(payload) }),

  deleteSbom: (sbomId: string) =>
    apiFetch<{ ok: boolean }>(`/sboms/${encodeURIComponent(sbomId)}`, { method: 'DELETE' }),

  scanVulnerabilities: (sbomId?: string) =>
    apiFetch<{
      osvReachable: boolean;
      scannedComponents: number;
      vulnerabilitiesMatched: number;
      exposuresUpdated: number;
      warnings: string[];
    }>('/vulnerabilities/scan', {
      method: 'POST',
      body: JSON.stringify({ sbomId }),
    }),

  updateExposureStatus: (id: string, investigationStatus: string) =>
    apiFetch<{ exposure: ExposureFinding }>(`/exposures/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ investigationStatus }),
    }),

  createIncident: (payload: {
    title: string;
    description: string;
    severity: string;
    ownerId?: string;
    ownerName?: string;
    linkedVulnerabilityIds?: string[];
    linkedComponentIds?: string[];
    linkedAdvisoryIds?: string[];
  }) =>
    apiFetch<{ incident: Incident }>('/incidents', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateIncident: (
    id: string,
    payload: {
      status?: string;
      ownerName?: string;
      verificationEvidence?: string;
      severity?: string;
    }
  ) =>
    apiFetch<{ incident: Incident }>(`/incidents/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  addIncidentNote: (id: string, content: string) =>
    apiFetch<{ incident: Incident }>(`/incidents/${encodeURIComponent(id)}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  createRemediation: (payload: {
    exposureId?: string;
    incidentId?: string;
    advisoryId: string;
    componentId?: string;
    componentName: string;
    componentVersion: string;
    applicationName: string;
    severity: string;
    recommendedAction: string;
    responsibleOwner?: string;
    dueDate?: string;
  }) =>
    apiFetch<{ remediation: RemediationTask }>('/remediations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateRemediation: (
    id: string,
    payload: {
      status?: string;
      responsibleOwner?: string;
      dueDate?: string;
      resolutionEvidence?: string;
    }
  ) =>
    apiFetch<{ remediation: RemediationTask }>(`/remediations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  addMember: (payload: {
    fullName: string;
    email: string;
    role: UserRole;
    password: string;
  }) =>
    apiFetch<{ member: SafeUser }>('/team/members', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  createApiKey: (payload: { name: string; scopes: string[] }) =>
    apiFetch<{
      apiKey: WorkspaceSnapshot['apiKeys'][number];
      rawKey: string;
    }>('/api-keys', { method: 'POST', body: JSON.stringify(payload) }),

  revokeApiKey: (id: string) =>
    apiFetch<{ ok: boolean }>(`/api-keys/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  explainVulnerability: (vulnerabilityId: string) =>
    apiFetch<{ analysis: string }>('/ai/explain-vulnerability', {
      method: 'POST',
      body: JSON.stringify({ vulnerabilityId }),
    }),

  summarizeIncident: (incidentId: string) =>
    apiFetch<{ summary: string }>('/ai/summarize-incident', {
      method: 'POST',
      body: JSON.stringify({ incidentId }),
    }),

  explainRemediation: (remediationId: string) =>
    apiFetch<{ guidance: string }>('/ai/explain-remediation', {
      method: 'POST',
      body: JSON.stringify({ remediationId }),
    }),

  generateManagementReport: () =>
    apiFetch<{ narrative: string }>('/ai/management-report', {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  askInventory: (question: string) =>
    apiFetch<{ answer: string }>('/ai/ask-inventory', {
      method: 'POST',
      body: JSON.stringify({ question }),
    }),

  downloadCsvUrl: async () => {
    const token = getStoredToken();
    const resp = await fetch('/api/v1/reports/csv', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!resp.ok) throw new Error('Failed to export CSV report.');
    return resp.blob();
  },
};
