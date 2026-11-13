import 'dotenv/config';
import crypto from 'crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  appendAuditLog,
  getOrgMetrics,
  getOrgWorkspaceSnapshot,
  hashApiKey,
  loadStore,
  persistStore,
  resetDemoWorkspaces,
  sanitizeUser,
  signSessionToken,
  verifyPassword,
  verifySessionToken,
} from './src/server/db.ts';
import { DEMO_ORG_AETHERIS_ID, DEMO_ORG_KESTREL_ID, hashPassword } from './src/server/demoSeed.ts';
import {
  answerInventoryQuestionWithAi,
  explainRemediationWithAi,
  explainVulnerabilityWithAi,
  generateManagementReportNarrative,
  summarizeIncidentWithAi,
} from './src/server/geminiService.ts';
import { SAMPLE_SBOMS } from './src/server/sampleSboms.ts';
import { parseSbomDocument } from './src/server/sbomParser.ts';
import { runLiveVulnerabilityScan } from './src/server/vulnEngine.ts';
import type {
  ComponentRecord,
  DataOrigin,
  DependencyEdge,
  Incident,
  IncidentStatus,
  RemediationStatus,
  RemediationTask,
  SbomRecord,
  SeverityLevel,
  UserRole,
} from './src/types/vytron.ts';

interface AuthContext {
  userId: string;
  orgId: string;
  email: string;
  fullName: string;
  role: UserRole;
  authType: 'session' | 'api_key';
}

interface AuthedRequest extends Request {
  auth?: AuthContext;
}

// Sliding-window in-memory rate limiter
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip || 'local'}:${req.baseUrl}`;
    const now = Date.now();
    const entry = rateBuckets.get(key);
    if (!entry || entry.resetAt <= now) {
      rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Limit', String(maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(maxRequests - 1));
      return next();
    }
    entry.count += 1;
    const remaining = Math.max(0, maxRequests - entry.count);
    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));
    if (entry.count > maxRequests) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Retry after window resets.',
        retryAfterSeconds: Math.ceil((entry.resetAt - now) / 1000),
      });
    }
    next();
  };
}

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const store = loadStore();

  // 1. Check X-VYTRON-API-Key for CI/CD & API integrations
  const apiKeyHeader = req.header('x-vytron-api-key');
  if (apiKeyHeader) {
    const hashed = hashApiKey(apiKeyHeader.trim());
    const matchedKey = store.apiKeys.find((k) => k.keyHash === hashed);
    if (!matchedKey) {
      return res.status(401).json({ error: 'Invalid API key.' });
    }
    matchedKey.lastUsedAt = new Date().toISOString();
    persistStore(store);
    req.auth = {
      userId: `apikey:${matchedKey.id}`,
      orgId: matchedKey.orgId,
      email: `api-key:${matchedKey.prefix}@vytron.local`,
      fullName: matchedKey.name,
      role: 'Security Engineer',
      authType: 'api_key',
    };
    return next();
  }

  // 2. Check Bearer session token
  const authHeader = req.header('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Provide a valid Bearer token or API key.' });
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const payload = verifySessionToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Session expired or invalid token.' });
  }

  const user = store.users.find((u) => u.id === payload.userId && u.orgId === payload.orgId);
  if (!user) {
    return res.status(401).json({ error: 'User workspace record not found.' });
  }

  req.auth = {
    userId: user.id,
    orgId: user.orgId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    authType: 'session',
  };
  next();
}

function requireRoles(allowed: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'Unauthenticated' });
    }
    if (!allowed.includes(req.auth.role)) {
      return res.status(403).json({
        error: `Forbidden: Role '${req.auth.role}' lacks permission for this action. Required: ${allowed.join(' or ')}.`,
      });
    }
    next();
  };
}

function csvEscape(val: unknown): string {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

async function startServer() {
  loadStore();

  const app = express();
  app.use(express.json({ limit: '6mb' }));

  const apiRouter = express.Router();
  apiRouter.use(rateLimit(180, 60_000));

  // Health
  apiRouter.get('/health', (_req, res) => {
    res.json({
      status: 'operational',
      service: 'vytron-api',
      version: 'v1',
      timestamp: new Date().toISOString(),
    });
  });

  // Public: Sample SBOM presets
  apiRouter.get('/sboms/samples', (_req, res) => {
    res.json({ samples: SAMPLE_SBOMS });
  });

  // Public: Commercial Enquiry Form
  apiRouter.post('/enquiries', (req, res) => {
    const { fullName, workEmail, company, teamSize, interestTier, message } = req.body ?? {};
    if (
      typeof fullName !== 'string' ||
      fullName.trim().length < 2 ||
      typeof workEmail !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(workEmail.trim()) ||
      typeof company !== 'string' ||
      company.trim().length < 2
    ) {
      return res.status(400).json({ error: 'Please provide a valid full name, work email, and company name.' });
    }

    const store = loadStore();
    const record = {
      id: `enq_${crypto.randomUUID().slice(0, 10)}`,
      fullName: fullName.trim().slice(0, 120),
      workEmail: workEmail.trim().toLowerCase().slice(0, 160),
      company: company.trim().slice(0, 160),
      teamSize: typeof teamSize === 'string' ? teamSize.trim().slice(0, 60) : 'Unspecified',
      interestTier: typeof interestTier === 'string' ? interestTier.trim().slice(0, 60) : 'Enterprise',
      message: typeof message === 'string' ? message.trim().slice(0, 2000) : '',
      createdAt: new Date().toISOString(),
    };
    store.enquiries.unshift(record);
    persistStore(store);

    res.status(201).json({
      id: record.id,
      message: 'Enterprise enquiry recorded. Our infrastructure team will respond via email.',
      createdAt: record.createdAt,
    });
  });

  // Auth: Register new Organization + Admin User
  apiRouter.post('/auth/register', (req, res) => {
    const { organizationName, industry, fullName, email, password, planTier } = req.body ?? {};
    if (
      typeof organizationName !== 'string' ||
      organizationName.trim().length < 2 ||
      typeof fullName !== 'string' ||
      fullName.trim().length < 2 ||
      typeof email !== 'string' ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== 'string' ||
      password.length < 8
    ) {
      return res.status(400).json({
        error: 'Valid organization name, full name, email, and password (minimum 8 characters) are required.',
      });
    }

    const store = loadStore();
    const normalizedEmail = email.trim().toLowerCase();
    if (store.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const now = new Date().toISOString();
    const orgId = `org_${crypto.randomUUID().slice(0, 12)}`;
    const slugBase = organizationName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 32);

    const validTier = ['Developer', 'Professional', 'Enterprise', 'API Usage'].includes(planTier)
      ? planTier
      : 'Developer';

    const org = {
      id: orgId,
      name: organizationName.trim().slice(0, 120),
      slug: `${slugBase || 'org'}-${orgId.slice(-4)}`,
      industry: typeof industry === 'string' && industry.trim() ? industry.trim().slice(0, 80) : 'Software Engineering',
      planTier: validTier as 'Developer' | 'Professional' | 'Enterprise' | 'API Usage',
      isDemo: false,
      createdAt: now,
    };

    const { hash, salt } = hashPassword(password);
    const userId = `usr_${crypto.randomUUID().slice(0, 12)}`;
    const user = {
      id: userId,
      orgId,
      email: normalizedEmail,
      fullName: fullName.trim().slice(0, 100),
      role: 'Admin' as UserRole,
      passwordHash: hash,
      passwordSalt: salt,
      createdAt: now,
      lastLoginAt: now,
    };

    store.organizations.push(org);
    store.users.push(user);
    persistStore(store);

    appendAuditLog({
      orgId,
      actorId: userId,
      actorEmail: normalizedEmail,
      actorRole: 'Admin',
      action: 'WORKSPACE_REGISTERED',
      resourceType: 'Organization',
      resourceId: orgId,
      metadata: { orgName: org.name, planTier: org.planTier },
      dataOrigin: 'LIVE_VERIFIED',
    });

    const token = signSessionToken({ userId, orgId, role: user.role });
    res.status(201).json({
      token,
      user: sanitizeUser(user),
      organization: org,
    });
  });

  // Auth: Login
  apiRouter.post('/auth/login', (req, res) => {
    const { email, password } = req.body ?? {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const store = loadStore();
    const user = store.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || !verifyPassword(password, user)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const org = store.organizations.find((o) => o.id === user.orgId);
    if (!org) {
      return res.status(404).json({ error: 'Associated organization not found.' });
    }

    user.lastLoginAt = new Date().toISOString();
    persistStore(store);

    appendAuditLog({
      orgId: org.id,
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      action: 'USER_LOGIN',
      resourceType: 'Session',
      resourceId: user.id,
      metadata: { method: 'password' },
      dataOrigin: org.isDemo ? 'DEMO_DATA' : 'LIVE_VERIFIED',
    });

    const token = signSessionToken({ userId: user.id, orgId: org.id, role: user.role });
    res.json({
      token,
      user: sanitizeUser(user),
      organization: org,
    });
  });

  // Auth: Instant Demo Access
  apiRouter.post('/auth/demo', (req, res) => {
    const { demoOrg } = req.body ?? {};
    const targetOrgId = demoOrg === 'kestrel' ? DEMO_ORG_KESTREL_ID : DEMO_ORG_AETHERIS_ID;
    const store = loadStore();
    const org = store.organizations.find((o) => o.id === targetOrgId);
    const user = store.users.find((u) => u.orgId === targetOrgId && u.role === 'Admin') ??
      store.users.find((u) => u.orgId === targetOrgId);

    if (!org || !user) {
      resetDemoWorkspaces();
    }
    const freshStore = loadStore();
    const validOrg = freshStore.organizations.find((o) => o.id === targetOrgId)!;
    const validUser = freshStore.users.find((u) => u.orgId === targetOrgId)!;

    const token = signSessionToken({
      userId: validUser.id,
      orgId: validOrg.id,
      role: validUser.role,
    });

    res.json({
      token,
      user: sanitizeUser(validUser),
      organization: validOrg,
    });
  });

  apiRouter.post('/auth/logout', requireAuth, (req: AuthedRequest, res) => {
    const store = loadStore();
    const org = store.organizations.find((o) => o.id === req.auth!.orgId);
    appendAuditLog({
      orgId: req.auth!.orgId,
      actorId: req.auth!.userId,
      actorEmail: req.auth!.email,
      actorRole: req.auth!.role,
      action: 'USER_LOGOUT',
      resourceType: 'Session',
      resourceId: req.auth!.userId,
      metadata: {},
      dataOrigin: org?.isDemo ? 'DEMO_DATA' : 'LIVE_VERIFIED',
    });
    res.json({ ok: true });
  });

  apiRouter.get('/auth/me', requireAuth, (req: AuthedRequest, res) => {
    const store = loadStore();
    const org = store.organizations.find((o) => o.id === req.auth!.orgId);
    const user = store.users.find((u) => u.id === req.auth!.userId);
    if (!org) return res.status(404).json({ error: 'Organization not found.' });
    res.json({
      user: user ? sanitizeUser(user) : null,
      organization: org,
    });
  });

  // Workspace snapshot (org-isolated)
  apiRouter.get('/workspace', requireAuth, (req: AuthedRequest, res) => {
    const snapshot = getOrgWorkspaceSnapshot(req.auth!.orgId);
    if (!snapshot) return res.status(404).json({ error: 'Workspace not found.' });
    res.json(snapshot);
  });

  // Reset Demo Data
  apiRouter.post('/demo/reset', requireAuth, (req: AuthedRequest, res) => {
    const store = loadStore();
    const org = store.organizations.find((o) => o.id === req.auth!.orgId);
    if (!org?.isDemo) {
      return res.status(400).json({ error: 'Reset is only permitted inside a demonstration workspace.' });
    }
    resetDemoWorkspaces();
    const snapshot = getOrgWorkspaceSnapshot(req.auth!.orgId);
    res.json({ ok: true, snapshot });
  });

  // SBOM Ingestion (Module A + optional live OSV/NVD scan)
  apiRouter.post(
    '/sboms/ingest',
    requireAuth,
    requireRoles(['Admin', 'Security Engineer']),
    async (req: AuthedRequest, res) => {
      const { content, fileName, applicationName, runScan } = req.body ?? {};
      if (typeof content !== 'string' || typeof fileName !== 'string' || !fileName.trim()) {
        return res.status(400).json({ error: 'Provide SBOM file content and fileName.' });
      }

      const ext = path.extname(fileName.trim()).toLowerCase();
      if (ext && !['.json', '.xml', '.spdx', '.txt'].includes(ext)) {
        return res.status(400).json({
          error: `Invalid file extension '${ext}'. Allowed: .json, .xml, .spdx, .txt.`,
        });
      }

      let parsed;
      try {
        parsed = parseSbomDocument(content, fileName.trim(), applicationName);
      } catch (err) {
        return res.status(400).json({
          error: err instanceof Error ? err.message : 'Failed to parse SBOM document.',
        });
      }

      const store = loadStore();
      const org = store.organizations.find((o) => o.id === req.auth!.orgId);
      if (!org) return res.status(404).json({ error: 'Organization not found.' });

      const dataOrigin: DataOrigin = org.isDemo ? 'DEMO_DATA' : 'LIVE_VERIFIED';
      const now = new Date().toISOString();
      const sbomId = `sbom_${crypto.randomUUID().slice(0, 12)}`;

      // Detect duplicates against existing components in the organization
      const existingOrgKeys = new Set(
        store.components
          .filter((c) => c.orgId === org.id)
          .map((c) => `${c.ecosystem.toLowerCase()}:${c.name.toLowerCase()}@${c.version.toLowerCase()}`)
      );

      let crossSbomDuplicates = 0;
      const refToCompId = new Map<string, string>();
      const newComponents: ComponentRecord[] = parsed.components.map((pc) => {
        const key = `${pc.ecosystem.toLowerCase()}:${pc.name.toLowerCase()}@${pc.version.toLowerCase()}`;
        if (!pc.isRoot && existingOrgKeys.has(key)) {
          crossSbomDuplicates++;
        }
        const compId = `cmp_${crypto.randomUUID().slice(0, 12)}`;
        refToCompId.set(pc.bomRef, compId);
        return {
          id: compId,
          orgId: org.id,
          sbomId,
          bomRef: pc.bomRef,
          name: pc.name,
          version: pc.version,
          ecosystem: pc.ecosystem,
          purl: pc.purl,
          cpe: pc.cpe,
          supplier: pc.supplier,
          license: pc.license,
          isRoot: pc.isRoot,
          dependencyDepth: pc.dependencyDepth,
          dataOrigin,
          createdAt: now,
        };
      });

      const newEdges: DependencyEdge[] = [];
      for (const pe of parsed.edges) {
        const srcId = refToCompId.get(pe.sourceRef);
        const dstId = refToCompId.get(pe.targetRef);
        if (srcId && dstId && srcId !== dstId) {
          newEdges.push({
            id: `edge_${crypto.randomUUID().slice(0, 12)}`,
            orgId: org.id,
            sbomId,
            sourceComponentId: srcId,
            targetComponentId: dstId,
            sourceRef: pe.sourceRef,
            targetRef: pe.targetRef,
            relationship: pe.relationship,
          });
        }
      }

      const sbomRecord: SbomRecord = {
        id: sbomId,
        orgId: org.id,
        applicationName: parsed.applicationName,
        applicationVersion: parsed.applicationVersion,
        fileName: fileName.trim(),
        format: parsed.format,
        specVersion: parsed.specVersion,
        componentCount: newComponents.length,
        duplicateCount: parsed.inFileDuplicates + crossSbomDuplicates,
        uploadedBy: req.auth!.fullName,
        uploadedAt: now,
        dataOrigin,
        sha256: parsed.sha256,
      };

      store.sboms.unshift(sbomRecord);
      store.components.push(...newComponents);
      store.dependencies.push(...newEdges);

      let scanSummary: {
        vulnerabilitiesFound: number;
        exposuresCreated: number;
        osvReachable: boolean;
        nvdChecksAttempted: number;
        warnings: string[];
      } | null = null;

      if (runScan !== false) {
        const scanResult = await runLiveVulnerabilityScan(
          org.id,
          sbomRecord,
          newComponents,
          newEdges,
          dataOrigin
        );
        sbomRecord.lastScannedAt = new Date().toISOString();
        store.vulnerabilities.push(...scanResult.vulnerabilities);
        store.exposures.push(...scanResult.exposures);
        scanSummary = {
          vulnerabilitiesFound: scanResult.vulnerabilities.length,
          exposuresCreated: scanResult.exposures.length,
          osvReachable: scanResult.osvReachable,
          nvdChecksAttempted: scanResult.nvdChecksAttempted,
          warnings: scanResult.warnings,
        };
      }

      persistStore(store);

      appendAuditLog({
        orgId: org.id,
        actorId: req.auth!.userId,
        actorEmail: req.auth!.email,
        actorRole: req.auth!.role,
        action: 'SBOM_INGESTED',
        resourceType: 'SBOM',
        resourceId: sbomId,
        metadata: {
          fileName: sbomRecord.fileName,
          format: sbomRecord.format,
          components: sbomRecord.componentCount,
          vulnerabilitiesFound: scanSummary?.vulnerabilitiesFound ?? 0,
        },
        dataOrigin,
      });

      res.status(201).json({
        sbom: sbomRecord,
        componentsCount: newComponents.length,
        edgesCount: newEdges.length,
        duplicatesDetected: sbomRecord.duplicateCount,
        scanSummary,
      });
    }
  );

  // Delete SBOM
  apiRouter.delete(
    '/sboms/:id',
    requireAuth,
    requireRoles(['Admin', 'Security Engineer']),
    (req: AuthedRequest, res) => {
      const store = loadStore();
      const sbomId = req.params.id;
      const orgId = req.auth!.orgId;
      const target = store.sboms.find((s) => s.id === sbomId && s.orgId === orgId);
      if (!target) return res.status(404).json({ error: 'SBOM not found in this organization.' });

      store.sboms = store.sboms.filter((s) => !(s.id === sbomId && s.orgId === orgId));
      store.components = store.components.filter((c) => !(c.sbomId === sbomId && c.orgId === orgId));
      store.dependencies = store.dependencies.filter((d) => !(d.sbomId === sbomId && d.orgId === orgId));
      store.vulnerabilities = store.vulnerabilities.filter(
        (v) => !(v.sbomId === sbomId && v.orgId === orgId)
      );
      store.exposures = store.exposures.filter((e) => !(e.sbomId === sbomId && e.orgId === orgId));
      persistStore(store);

      appendAuditLog({
        orgId,
        actorId: req.auth!.userId,
        actorEmail: req.auth!.email,
        actorRole: req.auth!.role,
        action: 'SBOM_DELETED',
        resourceType: 'SBOM',
        resourceId: sbomId,
        metadata: { fileName: target.fileName },
        dataOrigin: target.dataOrigin,
      });

      res.json({ ok: true });
    }
  );

  // Live Vulnerability Scan (OSV + NIST NVD)
  apiRouter.post(
    '/vulnerabilities/scan',
    rateLimit(25, 60_000),
    requireAuth,
    requireRoles(['Admin', 'Security Engineer']),
    async (req: AuthedRequest, res) => {
      const { sbomId } = req.body ?? {};
      const store = loadStore();
      const org = store.organizations.find((o) => o.id === req.auth!.orgId);
      if (!org) return res.status(404).json({ error: 'Organization not found.' });

      const targetSboms = sbomId
        ? store.sboms.filter((s) => s.id === sbomId && s.orgId === org.id)
        : store.sboms.filter((s) => s.orgId === org.id);

      if (targetSboms.length === 0) {
        return res.status(404).json({ error: 'No matching SBOMs found to scan.' });
      }

      const dataOrigin: DataOrigin = org.isDemo ? 'DEMO_DATA' : 'LIVE_VERIFIED';
      const targetSbomIds = new Set(targetSboms.map((s) => s.id));

      // Preserve investigation statuses if advisories recur
      const prevStatusByKey = new Map<string, typeof store.exposures[number]['investigationStatus']>();
      for (const exp of store.exposures) {
        if (exp.orgId === org.id && targetSbomIds.has(exp.sbomId)) {
          prevStatusByKey.set(`${exp.componentId}:${exp.advisoryId}`, exp.investigationStatus);
        }
      }

      let totalVulns = 0;
      let totalExposures = 0;
      let totalScannedComponents = 0;
      let osvReachable = true;
      const warnings: string[] = [];

      const newVulns: typeof store.vulnerabilities = [];
      const newExposures: typeof store.exposures = [];

      for (const sbom of targetSboms) {
        const comps = store.components.filter((c) => c.orgId === org.id && c.sbomId === sbom.id);
        const edges = store.dependencies.filter((d) => d.orgId === org.id && d.sbomId === sbom.id);
        const result = await runLiveVulnerabilityScan(org.id, sbom, comps, edges, dataOrigin);
        if (!result.osvReachable) osvReachable = false;
        warnings.push(...result.warnings);
        totalScannedComponents += result.scannedComponents;

        if (result.osvReachable) {
          sbom.lastScannedAt = new Date().toISOString();
          for (const exp of result.exposures) {
            const prev = prevStatusByKey.get(`${exp.componentId}:${exp.advisoryId}`);
            if (prev) exp.investigationStatus = prev;
          }
          newVulns.push(...result.vulnerabilities);
          newExposures.push(...result.exposures);
          totalVulns += result.vulnerabilities.length;
          totalExposures += result.exposures.length;
        }
      }

      if (osvReachable) {
        store.vulnerabilities = [
          ...store.vulnerabilities.filter(
            (v) => !(v.orgId === org.id && targetSbomIds.has(v.sbomId))
          ),
          ...newVulns,
        ];
        store.exposures = [
          ...store.exposures.filter((e) => !(e.orgId === org.id && targetSbomIds.has(e.sbomId))),
          ...newExposures,
        ];
        persistStore(store);

        appendAuditLog({
          orgId: org.id,
          actorId: req.auth!.userId,
          actorEmail: req.auth!.email,
          actorRole: req.auth!.role,
          action: 'VULNERABILITY_SCAN_COMPLETED',
          resourceType: 'SBOM',
          resourceId: sbomId || 'ALL_ORG_SBOMS',
          metadata: {
            scannedComponents: totalScannedComponents,
            vulnerabilitiesMatched: totalVulns,
          },
          dataOrigin,
        });
      }

      res.json({
        osvReachable,
        scannedComponents: totalScannedComponents,
        vulnerabilitiesMatched: totalVulns,
        exposuresUpdated: totalExposures,
        warnings: Array.from(new Set(warnings)),
      });
    }
  );

  // Update Exposure Investigation Status
  apiRouter.patch(
    '/exposures/:id',
    requireAuth,
    requireRoles(['Admin', 'Security Engineer']),
    (req: AuthedRequest, res) => {
      const { investigationStatus } = req.body ?? {};
      const validStatuses = ['New', 'Triaged', 'Confirmed', 'False Positive', 'Accepted Risk'];
      if (!validStatuses.includes(investigationStatus)) {
        return res.status(400).json({ error: 'Invalid investigation status.' });
      }
      const store = loadStore();
      const exp = store.exposures.find(
        (e) => e.id === req.params.id && e.orgId === req.auth!.orgId
      );
      if (!exp) return res.status(404).json({ error: 'Exposure finding not found.' });

      exp.investigationStatus = investigationStatus;
      exp.updatedAt = new Date().toISOString();
      persistStore(store);

      appendAuditLog({
        orgId: req.auth!.orgId,
        actorId: req.auth!.userId,
        actorEmail: req.auth!.email,
        actorRole: req.auth!.role,
        action: 'EXPOSURE_TRIAGED',
        resourceType: 'Exposure',
        resourceId: exp.id,
        metadata: { advisoryId: exp.advisoryId, status: investigationStatus },
        dataOrigin: exp.dataOrigin,
      });

      res.json({ exposure: exp });
    }
  );

  // Create Incident (Module D)
  apiRouter.post(
    '/incidents',
    requireAuth,
    requireRoles(['Admin', 'Security Engineer']),
    (req: AuthedRequest, res) => {
      const {
        title,
        description,
        severity,
        ownerId,
        ownerName,
        linkedVulnerabilityIds,
        linkedComponentIds,
        linkedAdvisoryIds,
      } = req.body ?? {};

      if (typeof title !== 'string' || title.trim().length < 3) {
        return res.status(400).json({ error: 'Incident title must be at least 3 characters.' });
      }
      const validSev: SeverityLevel[] = ['Critical', 'High', 'Medium', 'Low', 'Unknown'];
      const sev: SeverityLevel = validSev.includes(severity) ? severity : 'High';

      const store = loadStore();
      const org = store.organizations.find((o) => o.id === req.auth!.orgId);
      const dataOrigin: DataOrigin = org?.isDemo ? 'DEMO_DATA' : 'LIVE_VERIFIED';
      const now = new Date().toISOString();

      const resolvedOwner =
        store.users.find((u) => u.id === ownerId && u.orgId === req.auth!.orgId) ?? null;

      const incident: Incident = {
        id: `inc_${crypto.randomUUID().slice(0, 12)}`,
        orgId: req.auth!.orgId,
        title: title.trim().slice(0, 200),
        description: typeof description === 'string' ? description.trim().slice(0, 3000) : '',
        severity: sev,
        status: 'Open',
        ownerId: resolvedOwner?.id ?? req.auth!.userId,
        ownerName:
          resolvedOwner?.fullName ??
          (typeof ownerName === 'string' && ownerName.trim() ? ownerName.trim() : req.auth!.fullName),
        linkedVulnerabilityIds: Array.isArray(linkedVulnerabilityIds) ? linkedVulnerabilityIds : [],
        linkedComponentIds: Array.isArray(linkedComponentIds) ? linkedComponentIds : [],
        linkedAdvisoryIds: Array.isArray(linkedAdvisoryIds) ? linkedAdvisoryIds : [],
        notes: [],
        verificationEvidence: '',
        auditHistory: [
          {
            id: `aud_i_${crypto.randomUUID().slice(0, 8)}`,
            actorName: req.auth!.fullName,
            action: 'Incident opened',
            toStatus: 'Open',
            timestamp: now,
          },
        ],
        createdAt: now,
        updatedAt: now,
        dataOrigin,
      };

      store.incidents.unshift(incident);
      persistStore(store);

      appendAuditLog({
        orgId: req.auth!.orgId,
        actorId: req.auth!.userId,
        actorEmail: req.auth!.email,
        actorRole: req.auth!.role,
        action: 'INCIDENT_CREATED',
        resourceType: 'Incident',
        resourceId: incident.id,
        metadata: { title: incident.title, severity: incident.severity },
        dataOrigin,
      });

      res.status(201).json({ incident });
    }
  );

  // Update Incident (Enforces Verification Evidence before Resolved)
  apiRouter.patch(
    '/incidents/:id',
    requireAuth,
    requireRoles(['Admin', 'Security Engineer', 'Remediation Owner']),
    (req: AuthedRequest, res) => {
      const { status, ownerName, verificationEvidence, severity } = req.body ?? {};
      const store = loadStore();
      const incident = store.incidents.find(
        (i) => i.id === req.params.id && i.orgId === req.auth!.orgId
      );
      if (!incident) return res.status(404).json({ error: 'Incident not found.' });

      const validStatuses: IncidentStatus[] = [
        'Open',
        'Investigating',
        'Remediation in progress',
        'Awaiting verification',
        'Resolved',
      ];

      const nextEvidence =
        typeof verificationEvidence === 'string'
          ? verificationEvidence.trim()
          : incident.verificationEvidence;

      if (status === 'Resolved' && (!nextEvidence || nextEvidence.length < 6)) {
        return res.status(400).json({
          error:
            'Resolution requires explicit verification evidence (e.g., CI scan digest, SBOM re-scan ID, or patch verification record).',
        });
      }

      const now = new Date().toISOString();
      const prevStatus = incident.status;

      if (status && validStatuses.includes(status) && status !== prevStatus) {
        incident.status = status;
        if (status === 'Resolved') {
          incident.resolvedAt = now;
        }
        incident.auditHistory.push({
          id: `aud_i_${crypto.randomUUID().slice(0, 8)}`,
          actorName: req.auth!.fullName,
          action: `Status updated from ${prevStatus} to ${status}`,
          fromStatus: prevStatus,
          toStatus: status,
          timestamp: now,
        });
      }

      if (typeof ownerName === 'string' && ownerName.trim()) {
        incident.ownerName = ownerName.trim();
      }
      if (typeof verificationEvidence === 'string') {
        incident.verificationEvidence = verificationEvidence.trim().slice(0, 2000);
      }
      if (severity && ['Critical', 'High', 'Medium', 'Low', 'Unknown'].includes(severity)) {
        incident.severity = severity;
      }

      incident.updatedAt = now;
      persistStore(store);

      appendAuditLog({
        orgId: req.auth!.orgId,
        actorId: req.auth!.userId,
        actorEmail: req.auth!.email,
        actorRole: req.auth!.role,
        action: 'INCIDENT_UPDATED',
        resourceType: 'Incident',
        resourceId: incident.id,
        metadata: { status: incident.status, hasEvidence: Boolean(incident.verificationEvidence) },
        dataOrigin: incident.dataOrigin,
      });

      res.json({ incident });
    }
  );

  // Add Incident Investigation Note
  apiRouter.post(
    '/incidents/:id/notes',
    requireAuth,
    requireRoles(['Admin', 'Security Engineer', 'Remediation Owner']),
    (req: AuthedRequest, res) => {
      const { content } = req.body ?? {};
      if (typeof content !== 'string' || content.trim().length < 2) {
        return res.status(400).json({ error: 'Investigation note content is required.' });
      }
      const store = loadStore();
      const incident = store.incidents.find(
        (i) => i.id === req.params.id && i.orgId === req.auth!.orgId
      );
      if (!incident) return res.status(404).json({ error: 'Incident not found.' });

      const now = new Date().toISOString();
      const note = {
        id: `note_${crypto.randomUUID().slice(0, 10)}`,
        authorId: req.auth!.userId,
        authorName: req.auth!.fullName,
        content: content.trim().slice(0, 2000),
        createdAt: now,
      };
      incident.notes.push(note);
      incident.auditHistory.push({
        id: `aud_i_${crypto.randomUUID().slice(0, 8)}`,
        actorName: req.auth!.fullName,
        action: 'Added investigation note',
        timestamp: now,
      });
      incident.updatedAt = now;
      persistStore(store);

      res.status(201).json({ note, incident });
    }
  );

  // Create Remediation Task (Module E)
  apiRouter.post(
    '/remediations',
    requireAuth,
    requireRoles(['Admin', 'Security Engineer']),
    (req: AuthedRequest, res) => {
      const {
        exposureId,
        incidentId,
        advisoryId,
        componentId,
        componentName,
        componentVersion,
        applicationName,
        severity,
        recommendedAction,
        responsibleOwner,
        dueDate,
      } = req.body ?? {};

      if (typeof recommendedAction !== 'string' || recommendedAction.trim().length < 3) {
        return res.status(400).json({ error: 'Recommended remediation action is required.' });
      }

      const store = loadStore();
      const org = store.organizations.find((o) => o.id === req.auth!.orgId);
      const dataOrigin: DataOrigin = org?.isDemo ? 'DEMO_DATA' : 'LIVE_VERIFIED';
      const now = new Date().toISOString();

      const task: RemediationTask = {
        id: `rem_${crypto.randomUUID().slice(0, 12)}`,
        orgId: req.auth!.orgId,
        exposureId: typeof exposureId === 'string' ? exposureId : undefined,
        incidentId: typeof incidentId === 'string' ? incidentId : undefined,
        advisoryId: typeof advisoryId === 'string' && advisoryId ? advisoryId : 'MANUAL-TASK',
        componentId: typeof componentId === 'string' ? componentId : 'unspecified',
        componentName: typeof componentName === 'string' && componentName ? componentName : 'Unspecified',
        componentVersion: typeof componentVersion === 'string' ? componentVersion : 'unspecified',
        applicationName: typeof applicationName === 'string' && applicationName ? applicationName : 'Workspace Application',
        severity: ['Critical', 'High', 'Medium', 'Low', 'Unknown'].includes(severity)
          ? severity
          : 'High',
        recommendedAction: recommendedAction.trim().slice(0, 1000),
        responsibleOwner:
          typeof responsibleOwner === 'string' && responsibleOwner.trim()
            ? responsibleOwner.trim()
            : req.auth!.fullName,
        dueDate:
          typeof dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)
            ? dueDate
            : new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10),
        status: 'Pending',
        resolutionEvidence: '',
        updatedBy: req.auth!.fullName,
        createdAt: now,
        updatedAt: now,
        dataOrigin,
      };

      store.remediations.unshift(task);
      persistStore(store);

      appendAuditLog({
        orgId: req.auth!.orgId,
        actorId: req.auth!.userId,
        actorEmail: req.auth!.email,
        actorRole: req.auth!.role,
        action: 'REMEDIATION_CREATED',
        resourceType: 'Remediation',
        resourceId: task.id,
        metadata: { component: `${task.componentName}@${task.componentVersion}`, advisory: task.advisoryId },
        dataOrigin,
      });

      res.status(201).json({ remediation: task });
    }
  );

  // Update Remediation Task
  apiRouter.patch(
    '/remediations/:id',
    requireAuth,
    requireRoles(['Admin', 'Security Engineer', 'Remediation Owner']),
    (req: AuthedRequest, res) => {
      const { status, responsibleOwner, dueDate, resolutionEvidence } = req.body ?? {};
      const store = loadStore();
      const task = store.remediations.find(
        (r) => r.id === req.params.id && r.orgId === req.auth!.orgId
      );
      if (!task) return res.status(404).json({ error: 'Remediation task not found.' });

      const validStatuses: RemediationStatus[] = [
        'Pending',
        'In Progress',
        'Blocked',
        'Awaiting Verification',
        'Completed',
      ];

      const nextEvidence =
        typeof resolutionEvidence === 'string'
          ? resolutionEvidence.trim()
          : task.resolutionEvidence;

      if (status === 'Completed' && (!nextEvidence || nextEvidence.length < 5)) {
        return res.status(400).json({
          error: 'Completing a remediation task requires resolution evidence (PR link, SBOM digest, or verification reference).',
        });
      }

      const now = new Date().toISOString();
      if (status && validStatuses.includes(status)) {
        task.status = status;
        if (status === 'Completed') task.completedAt = now;
      }
      if (typeof responsibleOwner === 'string' && responsibleOwner.trim()) {
        task.responsibleOwner = responsibleOwner.trim();
      }
      if (typeof dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
        task.dueDate = dueDate;
      }
      if (typeof resolutionEvidence === 'string') {
        task.resolutionEvidence = resolutionEvidence.trim().slice(0, 2000);
      }

      task.updatedBy = req.auth!.fullName;
      task.updatedAt = now;
      persistStore(store);

      appendAuditLog({
        orgId: req.auth!.orgId,
        actorId: req.auth!.userId,
        actorEmail: req.auth!.email,
        actorRole: req.auth!.role,
        action: status === 'Completed' ? 'REMEDIATION_COMPLETED' : 'REMEDIATION_UPDATED',
        resourceType: 'Remediation',
        resourceId: task.id,
        metadata: { status: task.status, component: `${task.componentName}@${task.componentVersion}` },
        dataOrigin: task.dataOrigin,
      });

      res.json({ remediation: task });
    }
  );

  // Download CSV Report (Module F)
  apiRouter.get('/reports/csv', requireAuth, (req: AuthedRequest, res) => {
    const snapshot = getOrgWorkspaceSnapshot(req.auth!.orgId);
    if (!snapshot) return res.status(404).json({ error: 'Workspace not found.' });

    const classification = snapshot.organization.isDemo
      ? 'DEMO_DATA (SIMULATED DEMONSTRATION ENVIRONMENT)'
      : 'LIVE_VERIFIED (PRODUCTION INVENTORY)';

    const lines: string[] = [
      `# VYTRON Security Intelligence Report`,
      `# Organization,${csvEscape(snapshot.organization.name)}`,
      `# Data Classification,${csvEscape(classification)}`,
      `# Generated At,${csvEscape(new Date().toISOString())}`,
      '',
      [
        'RecordType',
        'DataOrigin',
        'Application',
        'Component',
        'Version',
        'Ecosystem',
        'AdvisoryID',
        'Severity',
        'CVSS',
        'MatchConfidence',
        'FixedVersion',
        'Status',
        'EvidenceOrAction',
        'Timestamp',
      ].join(','),
    ];

    for (const exp of snapshot.exposures) {
      lines.push(
        [
          'EXPOSURE',
          exp.dataOrigin,
          exp.applicationName,
          exp.componentName,
          exp.componentVersion,
          exp.ecosystem,
          exp.advisoryId,
          exp.severity,
          exp.cvssScore ?? '',
          exp.matchConfidence,
          exp.fixedVersion ?? 'No fix published',
          exp.investigationStatus,
          exp.recommendedAction,
          exp.updatedAt,
        ]
          .map(csvEscape)
          .join(',')
      );
    }

    for (const rem of snapshot.remediations) {
      lines.push(
        [
          'REMEDIATION',
          rem.dataOrigin,
          rem.applicationName,
          rem.componentName,
          rem.componentVersion,
          '',
          rem.advisoryId,
          rem.severity,
          '',
          '',
          '',
          rem.status,
          rem.resolutionEvidence || rem.recommendedAction,
          rem.updatedAt,
        ]
          .map(csvEscape)
          .join(',')
      );
    }

    for (const inc of snapshot.incidents) {
      lines.push(
        [
          'INCIDENT',
          inc.dataOrigin,
          snapshot.organization.name,
          '',
          '',
          '',
          inc.linkedAdvisoryIds.join(' | '),
          inc.severity,
          '',
          '',
          '',
          inc.status,
          inc.verificationEvidence || inc.title,
          inc.updatedAt,
        ]
          .map(csvEscape)
          .join(',')
      );
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="vytron-report-${snapshot.organization.slug}.csv"`
    );
    res.send(lines.join('\n'));
  });

  // Team Member Management (Admin only)
  apiRouter.post(
    '/team/members',
    requireAuth,
    requireRoles(['Admin']),
    (req: AuthedRequest, res) => {
      const { fullName, email, role, password } = req.body ?? {};
      const validRoles: UserRole[] = ['Admin', 'Security Engineer', 'Remediation Owner', 'Auditor'];
      if (
        typeof fullName !== 'string' ||
        fullName.trim().length < 2 ||
        typeof email !== 'string' ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        !validRoles.includes(role) ||
        typeof password !== 'string' ||
        password.length < 8
      ) {
        return res.status(400).json({ error: 'Valid name, email, role, and 8+ character password required.' });
      }

      const store = loadStore();
      const normEmail = email.trim().toLowerCase();
      if (store.users.some((u) => u.email.toLowerCase() === normEmail)) {
        return res.status(409).json({ error: 'User with this email already exists.' });
      }
      const org = store.organizations.find((o) => o.id === req.auth!.orgId);
      const { hash, salt } = hashPassword(password);
      const newUser = {
        id: `usr_${crypto.randomUUID().slice(0, 12)}`,
        orgId: req.auth!.orgId,
        email: normEmail,
        fullName: fullName.trim(),
        role: role as UserRole,
        passwordHash: hash,
        passwordSalt: salt,
        createdAt: new Date().toISOString(),
      };
      store.users.push(newUser);
      persistStore(store);

      appendAuditLog({
        orgId: req.auth!.orgId,
        actorId: req.auth!.userId,
        actorEmail: req.auth!.email,
        actorRole: req.auth!.role,
        action: 'MEMBER_ADDED',
        resourceType: 'User',
        resourceId: newUser.id,
        metadata: { email: newUser.email, role: newUser.role },
        dataOrigin: org?.isDemo ? 'DEMO_DATA' : 'LIVE_VERIFIED',
      });

      res.status(201).json({ member: sanitizeUser(newUser) });
    }
  );

  // API Key Management (Module G)
  apiRouter.post(
    '/api-keys',
    requireAuth,
    requireRoles(['Admin', 'Security Engineer']),
    (req: AuthedRequest, res) => {
      const { name, scopes } = req.body ?? {};
      if (typeof name !== 'string' || name.trim().length < 2) {
        return res.status(400).json({ error: 'API key name is required.' });
      }
      const rawSecret = `vytron_live_${crypto.randomBytes(24).toString('hex')}`;
      const prefix = rawSecret.slice(0, 18);
      const keyHash = hashApiKey(rawSecret);

      const store = loadStore();
      const org = store.organizations.find((o) => o.id === req.auth!.orgId);
      const record = {
        id: `key_${crypto.randomUUID().slice(0, 10)}`,
        orgId: req.auth!.orgId,
        name: name.trim().slice(0, 80),
        prefix,
        keyHash,
        createdBy: req.auth!.fullName,
        createdAt: new Date().toISOString(),
        scopes: Array.isArray(scopes) && scopes.length > 0 ? scopes : ['sbom:ingest', 'vuln:scan', 'reports:read'],
      };
      store.apiKeys.unshift(record);
      persistStore(store);

      appendAuditLog({
        orgId: req.auth!.orgId,
        actorId: req.auth!.userId,
        actorEmail: req.auth!.email,
        actorRole: req.auth!.role,
        action: 'API_KEY_CREATED',
        resourceType: 'ApiKey',
        resourceId: record.id,
        metadata: { name: record.name, prefix },
        dataOrigin: org?.isDemo ? 'DEMO_DATA' : 'LIVE_VERIFIED',
      });

      res.status(201).json({
        apiKey: {
          id: record.id,
          orgId: record.orgId,
          name: record.name,
          prefix: record.prefix,
          createdBy: record.createdBy,
          createdAt: record.createdAt,
          scopes: record.scopes,
        },
        rawKey: rawSecret,
      });
    }
  );

  apiRouter.delete(
    '/api-keys/:id',
    requireAuth,
    requireRoles(['Admin', 'Security Engineer']),
    (req: AuthedRequest, res) => {
      const store = loadStore();
      const target = store.apiKeys.find(
        (k) => k.id === req.params.id && k.orgId === req.auth!.orgId
      );
      if (!target) return res.status(404).json({ error: 'API key not found.' });
      store.apiKeys = store.apiKeys.filter((k) => k.id !== target.id);
      persistStore(store);
      res.json({ ok: true });
    }
  );

  // AI Endpoints (Strictly Evidence-Grounded via Server-Side @google/genai)
  apiRouter.post('/ai/explain-vulnerability', rateLimit(30, 60_000), requireAuth, async (req: AuthedRequest, res) => {
    const { vulnerabilityId } = req.body ?? {};
    const store = loadStore();
    const vuln = store.vulnerabilities.find(
      (v) => v.id === vulnerabilityId && v.orgId === req.auth!.orgId
    );
    if (!vuln) return res.status(404).json({ error: 'Vulnerability record not found.' });
    const exposure = store.exposures.find(
      (e) => e.vulnerabilityId === vuln.id && e.orgId === req.auth!.orgId
    );
    try {
      const analysis = await explainVulnerabilityWithAi(vuln, exposure);
      res.json({ analysis });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'AI explanation failed.',
      });
    }
  });

  apiRouter.post('/ai/summarize-incident', rateLimit(30, 60_000), requireAuth, async (req: AuthedRequest, res) => {
    const { incidentId } = req.body ?? {};
    const store = loadStore();
    const incident = store.incidents.find(
      (i) => i.id === incidentId && i.orgId === req.auth!.orgId
    );
    if (!incident) return res.status(404).json({ error: 'Incident not found.' });
    const linkedVulns = store.vulnerabilities.filter(
      (v) => v.orgId === req.auth!.orgId && incident.linkedVulnerabilityIds.includes(v.id)
    );
    try {
      const summary = await summarizeIncidentWithAi(incident, linkedVulns);
      res.json({ summary });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'AI incident summarization failed.',
      });
    }
  });

  apiRouter.post('/ai/explain-remediation', rateLimit(30, 60_000), requireAuth, async (req: AuthedRequest, res) => {
    const { remediationId } = req.body ?? {};
    const store = loadStore();
    const task = store.remediations.find(
      (r) => r.id === remediationId && r.orgId === req.auth!.orgId
    );
    if (!task) return res.status(404).json({ error: 'Remediation task not found.' });
    const vuln = store.vulnerabilities.find(
      (v) =>
        v.orgId === req.auth!.orgId &&
        (v.cveIds.includes(task.advisoryId) || v.osvId === task.advisoryId)
    );
    try {
      const guidance = await explainRemediationWithAi(task, vuln);
      res.json({ guidance });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'AI remediation guidance failed.',
      });
    }
  });

  apiRouter.post('/ai/management-report', rateLimit(20, 60_000), requireAuth, async (req: AuthedRequest, res) => {
    const snapshot = getOrgWorkspaceSnapshot(req.auth!.orgId);
    if (!snapshot) return res.status(404).json({ error: 'Workspace not found.' });
    try {
      const narrative = await generateManagementReportNarrative(
        snapshot.organization.name,
        snapshot.organization.isDemo,
        snapshot.metrics,
        snapshot.exposures,
        snapshot.incidents
      );
      res.json({ narrative });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'AI management brief failed.',
      });
    }
  });

  apiRouter.post('/ai/ask-inventory', rateLimit(30, 60_000), requireAuth, async (req: AuthedRequest, res) => {
    const { question } = req.body ?? {};
    if (typeof question !== 'string' || question.trim().length < 2) {
      return res.status(400).json({ error: 'Provide a clear question about your inventory.' });
    }
    const snapshot = getOrgWorkspaceSnapshot(req.auth!.orgId);
    if (!snapshot) return res.status(404).json({ error: 'Workspace not found.' });
    try {
      const answer = await answerInventoryQuestionWithAi(
        question.trim().slice(0, 800),
        snapshot.organization.name,
        snapshot.organization.isDemo,
        snapshot.components,
        snapshot.vulnerabilities,
        snapshot.exposures,
        snapshot.incidents
      );
      res.json({ answer });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : 'Inventory query failed.',
      });
    }
  });

  app.use('/api/v1', apiRouter);

  // Vite middleware in dev; static dist in production
  const distDir = path.resolve(process.cwd(), 'dist');
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(distDir);

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`VYTRON server listening on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start VYTRON server:', err);
  process.exit(1);
});
