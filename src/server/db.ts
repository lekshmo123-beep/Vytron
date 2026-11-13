import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  buildDemoSeedData,
  DEMO_ORG_AETHERIS_ID,
  DEMO_ORG_KESTREL_ID,
  hashPassword,
  type StoreSchema,
} from './demoSeed.ts';
import type {
  AuditLogEntry,
  DashboardMetrics,
  Organization,
  SafeUser,
  User,
  UserRole,
} from '../types/vytron.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STORE_PATH = path.join(DATA_DIR, 'vytron-store.json');

const SESSION_SECRET =
  process.env.VYTRON_SESSION_SECRET ||
  crypto.createHash('sha256').update(`vytron-dev-secret-${process.cwd()}`).digest('hex');

let storeCache: StoreSchema | null = null;

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadStore(): StoreSchema {
  if (storeCache) return storeCache;
  ensureDataDir();

  if (fs.existsSync(STORE_PATH)) {
    try {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as StoreSchema;
      if (parsed && Array.isArray(parsed.organizations)) {
        storeCache = parsed;
        return storeCache;
      }
    } catch {
      // Fall through to seed
    }
  }

  const seeded = buildDemoSeedData();
  storeCache = {
    ...seeded,
    enquiries: [],
  };
  persistStore(storeCache);
  return storeCache;
}

export function persistStore(nextStore?: StoreSchema): void {
  const data = nextStore ?? storeCache;
  if (!data) return;
  storeCache = data;
  ensureDataDir();
  const tmpPath = `${STORE_PATH}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpPath, STORE_PATH);
}

export function resetDemoWorkspaces(): void {
  const store = loadStore();
  const demoSeed = buildDemoSeedData();
  const demoOrgIds = new Set([DEMO_ORG_AETHERIS_ID, DEMO_ORG_KESTREL_ID]);

  store.organizations = [
    ...store.organizations.filter((o) => !demoOrgIds.has(o.id)),
    ...demoSeed.organizations,
  ];
  store.users = [...store.users.filter((u) => !demoOrgIds.has(u.orgId)), ...demoSeed.users];
  store.apiKeys = [...store.apiKeys.filter((k) => !demoOrgIds.has(k.orgId)), ...demoSeed.apiKeys];
  store.sboms = [...store.sboms.filter((s) => !demoOrgIds.has(s.orgId)), ...demoSeed.sboms];
  store.components = [
    ...store.components.filter((c) => !demoOrgIds.has(c.orgId)),
    ...demoSeed.components,
  ];
  store.dependencies = [
    ...store.dependencies.filter((d) => !demoOrgIds.has(d.orgId)),
    ...demoSeed.dependencies,
  ];
  store.vulnerabilities = [
    ...store.vulnerabilities.filter((v) => !demoOrgIds.has(v.orgId)),
    ...demoSeed.vulnerabilities,
  ];
  store.exposures = [
    ...store.exposures.filter((e) => !demoOrgIds.has(e.orgId)),
    ...demoSeed.exposures,
  ];
  store.incidents = [
    ...store.incidents.filter((i) => !demoOrgIds.has(i.orgId)),
    ...demoSeed.incidents,
  ];
  store.remediations = [
    ...store.remediations.filter((r) => !demoOrgIds.has(r.orgId)),
    ...demoSeed.remediations,
  ];
  store.auditLogs = [
    ...store.auditLogs.filter((a) => !demoOrgIds.has(a.orgId)),
    ...demoSeed.auditLogs,
  ];

  persistStore(store);
}

export function verifyPassword(password: string, user: User): boolean {
  const candidate = hashPassword(password, user.passwordSalt).hash;
  const a = Buffer.from(candidate, 'hex');
  const b = Buffer.from(user.passwordHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function sanitizeUser(user: User): SafeUser {
  return {
    id: user.id,
    orgId: user.orgId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export interface SessionPayload {
  userId: string;
  orgId: string;
  role: UserRole;
  exp: number;
}

export function signSessionToken(payload: Omit<SessionPayload, 'exp'>): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  const body = Buffer.from(JSON.stringify(fullPayload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey, 'utf8').digest('hex');
}

export function appendAuditLog(
  entry: Omit<AuditLogEntry, 'id' | 'timestamp'>
): AuditLogEntry {
  const store = loadStore();
  const full: AuditLogEntry = {
    ...entry,
    id: `aud_${crypto.randomUUID().slice(0, 12)}`,
    timestamp: new Date().toISOString(),
  };
  store.auditLogs.unshift(full);
  if (store.auditLogs.length > 2000) {
    store.auditLogs = store.auditLogs.slice(0, 2000);
  }
  persistStore(store);
  return full;
}

export function getOrgMetrics(orgId: string): DashboardMetrics {
  const store = loadStore();
  const components = store.components.filter((c) => c.orgId === orgId);
  const uniqueNames = new Set(components.map((c) => `${c.ecosystem}:${c.name}@${c.version}`));
  const vulns = store.vulnerabilities.filter((v) => v.orgId === orgId);
  const exposures = store.exposures.filter((e) => e.orgId === orgId);
  const incidents = store.incidents.filter((i) => i.orgId === orgId);
  const remediations = store.remediations.filter((r) => r.orgId === orgId);
  const sboms = store.sboms.filter((s) => s.orgId === orgId);

  const criticalFindings = vulns.filter((v) => v.severity === 'Critical').length;
  const highFindings = vulns.filter((v) => v.severity === 'High').length;
  const mediumFindings = vulns.filter((v) => v.severity === 'Medium').length;
  const lowFindings = vulns.filter((v) => v.severity === 'Low').length;

  const activeIncidents = incidents.filter((i) => i.status !== 'Resolved').length;
  const resolvedIncidents = incidents.filter((i) => i.status === 'Resolved').length;

  const remediationCompleted = remediations.filter((r) => r.status === 'Completed').length;
  const remediationCompletionPct =
    remediations.length > 0 ? Math.round((remediationCompleted / remediations.length) * 100) : 0;

  return {
    totalComponents: components.length,
    uniqueComponents: uniqueNames.size,
    totalKnownVulnerabilities: vulns.length,
    confirmedVulnerabilities: vulns.filter((v) => v.matchConfidence === 'confirmed_match').length,
    potentiallyAffected: vulns.filter(
      (v) => v.matchConfidence === 'potentially_affected' || v.matchConfidence === 'unverified'
    ).length,
    criticalFindings,
    highFindings,
    mediumFindings,
    lowFindings,
    activeIncidents,
    resolvedIncidents,
    remediationTotal: remediations.length,
    remediationCompleted,
    remediationCompletionPct,
    outdatedDependencies: exposures.filter((e) => e.isOutdated).length,
    noFixAvailableCount: exposures.filter((e) => !e.fixAvailable).length,
    sbomCount: sboms.length,
  };
}

export function getOrgWorkspaceSnapshot(orgId: string) {
  const store = loadStore();
  const organization: Organization | undefined = store.organizations.find((o) => o.id === orgId);
  if (!organization) return null;

  return {
    organization,
    metrics: getOrgMetrics(orgId),
    sboms: store.sboms
      .filter((s) => s.orgId === orgId)
      .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt)),
    components: store.components.filter((c) => c.orgId === orgId),
    dependencies: store.dependencies.filter((d) => d.orgId === orgId),
    vulnerabilities: store.vulnerabilities
      .filter((v) => v.orgId === orgId)
      .sort((a, b) => (b.cvssScore ?? 0) - (a.cvssScore ?? 0)),
    exposures: store.exposures
      .filter((e) => e.orgId === orgId)
      .sort((a, b) => b.priorityScore - a.priorityScore),
    incidents: store.incidents
      .filter((i) => i.orgId === orgId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    remediations: store.remediations
      .filter((r) => r.orgId === orgId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    auditLogs: store.auditLogs
      .filter((a) => a.orgId === orgId)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    members: store.users.filter((u) => u.orgId === orgId).map(sanitizeUser),
    apiKeys: store.apiKeys
      .filter((k) => k.orgId === orgId)
      .map(({ keyHash: _omit, ...rest }) => rest),
  };
}
