import crypto from 'crypto';
import semver from 'semver';
import type {
  ComponentRecord,
  DataOrigin,
  DependencyEdge,
  ExposureFinding,
  MatchConfidence,
  SbomRecord,
  SeverityLevel,
  VulnerabilityMatch,
} from '../types/vytron.ts';

interface OsvSeverity {
  type?: string;
  score?: string;
}

interface OsvRangeEvent {
  introduced?: string;
  fixed?: string;
  last_affected?: string;
  limit?: string;
}

interface OsvRange {
  type?: string;
  events?: OsvRangeEvent[];
}

interface OsvAffected {
  package?: {
    name?: string;
    ecosystem?: string;
    purl?: string;
  };
  ranges?: OsvRange[];
  versions?: string[];
}

interface OsvVuln {
  id: string;
  aliases?: string[];
  summary?: string;
  details?: string;
  severity?: OsvSeverity[];
  affected?: OsvAffected[];
  references?: { type?: string; url?: string }[];
  database_specific?: {
    severity?: string;
  };
}

const osvVulnCache = new Map<string, OsvVuln>();
const nvdCveCache = new Map<
  string,
  { cvssScore: number | null; cvssVector: string | null; severity: SeverityLevel; description?: string }
>();

function normalizeEcosystemForOsv(eco: string): string {
  const lower = eco.toLowerCase();
  if (lower === 'npm') return 'npm';
  if (lower === 'pypi') return 'PyPI';
  if (lower === 'maven') return 'Maven';
  if (lower === 'go' || lower === 'golang') return 'Go';
  if (lower === 'crates.io' || lower === 'cargo') return 'crates.io';
  if (lower === 'rubygems' || lower === 'gem') return 'RubyGems';
  if (lower === 'nuget') return 'NuGet';
  if (lower === 'packagist' || lower === 'composer') return 'Packagist';
  if (lower === 'debian' || lower === 'deb') return 'Debian';
  if (lower === 'alpine' || lower === 'apk') return 'Alpine';
  return eco;
}

function parseCvssBaseScoreFromVector(vector: string | undefined): number | null {
  if (!vector) return null;
  // Direct numeric string fallback
  if (/^\d+(\.\d+)?$/.test(vector.trim())) {
    return parseFloat(vector.trim());
  }
  return null;
}

function mapScoreToSeverity(score: number | null, textSeverity?: string): SeverityLevel {
  if (typeof score === 'number' && !Number.isNaN(score)) {
    if (score >= 9.0) return 'Critical';
    if (score >= 7.0) return 'High';
    if (score >= 4.0) return 'Medium';
    if (score > 0) return 'Low';
  }
  if (textSeverity) {
    const s = textSeverity.toUpperCase();
    if (s.includes('CRITICAL')) return 'Critical';
    if (s.includes('HIGH')) return 'High';
    if (s.includes('MODERATE') || s.includes('MEDIUM')) return 'Medium';
    if (s.includes('LOW')) return 'Low';
  }
  return 'Unknown';
}

function cleanSemver(ver: string): string | null {
  const trimmed = ver.trim().replace(/^v/i, '');
  const coerced = semver.valid(trimmed) ?? semver.coerce(trimmed)?.version ?? null;
  return coerced;
}

function evaluateDeterministicMatch(
  component: ComponentRecord,
  vuln: OsvVuln
): {
  confidence: MatchConfidence;
  reason: string;
  affectedRanges: string[];
  fixedVersions: string[];
} {
  const compVerClean = cleanSemver(component.version);
  const affectedRanges: string[] = [];
  const fixedVersions: string[] = [];
  let exactListMatch = false;
  let rangeMatchConfirmed = false;
  let hasStructuredRange = false;

  const targetEco = normalizeEcosystemForOsv(component.ecosystem).toLowerCase();
  const targetName = component.name.toLowerCase();

  for (const aff of vuln.affected ?? []) {
    const affName = aff.package?.name?.toLowerCase();
    const affEco = aff.package?.ecosystem?.toLowerCase();

    const packageMatches =
      !affName ||
      affName === targetName ||
      targetName.endsWith(`/${affName}`) ||
      affName.endsWith(`:${targetName}`) ||
      targetName.endsWith(`:${affName}`);

    const ecoMatches = !affEco || targetEco === 'unknown' || affEco === targetEco;

    if (!packageMatches || !ecoMatches) continue;

    if (Array.isArray(aff.versions) && aff.versions.includes(component.version)) {
      exactListMatch = true;
    }

    for (const range of aff.ranges ?? []) {
      const events = range.events ?? [];
      let introduced: string | undefined;
      let fixed: string | undefined;
      let lastAffected: string | undefined;

      for (const ev of events) {
        if (ev.introduced !== undefined) introduced = ev.introduced;
        if (ev.fixed !== undefined) {
          fixed = ev.fixed;
          if (!fixedVersions.includes(fixed)) fixedVersions.push(fixed);
        }
        if (ev.last_affected !== undefined) lastAffected = ev.last_affected;
      }

      if (introduced !== undefined || fixed !== undefined || lastAffected !== undefined) {
        hasStructuredRange = true;
        const rangeLabel = `${introduced ? `>=${introduced}` : '>=0'}${
          fixed ? ` <${fixed}` : lastAffected ? ` <=${lastAffected}` : ''
        }`;
        if (!affectedRanges.includes(rangeLabel)) affectedRanges.push(rangeLabel);

        if (compVerClean && (range.type === 'SEMVER' || range.type === 'ECOSYSTEM')) {
          const introClean = introduced === '0' ? '0.0.0' : introduced ? cleanSemver(introduced) : '0.0.0';
          const fixedClean = fixed ? cleanSemver(fixed) : null;
          const lastClean = lastAffected ? cleanSemver(lastAffected) : null;

          if (introClean && semver.gte(compVerClean, introClean)) {
            if (fixedClean && semver.lt(compVerClean, fixedClean)) {
              rangeMatchConfirmed = true;
            } else if (lastClean && semver.lte(compVerClean, lastClean)) {
              rangeMatchConfirmed = true;
            } else if (!fixedClean && !lastClean && !fixed && !lastAffected) {
              rangeMatchConfirmed = true;
            }
          }
        }
      }
    }
  }

  if (exactListMatch) {
    return {
      confidence: 'confirmed_match',
      reason: `Exact version ${component.version} is explicitly listed in OSV affected.versions.`,
      affectedRanges,
      fixedVersions,
    };
  }

  if (rangeMatchConfirmed) {
    return {
      confidence: 'confirmed_match',
      reason: `Installed version ${component.version} falls deterministically within affected semver range (${affectedRanges.join('; ')}).`,
      affectedRanges,
      fixedVersions,
    };
  }

  if (component.version === 'unspecified') {
    return {
      confidence: 'potentially_affected',
      reason: 'Component version is unspecified in SBOM; package matches OSV advisory.',
      affectedRanges,
      fixedVersions,
    };
  }

  if (hasStructuredRange) {
    return {
      confidence: 'potentially_affected',
      reason: `Returned by OSV query for ${component.name}@${component.version}; verify non-semver/backport range (${affectedRanges.join('; ')}).`,
      affectedRanges,
      fixedVersions,
    };
  }

  return {
    confidence: 'unverified',
    reason: 'Advisory lacks structured version range metadata; manual verification required.',
    affectedRanges,
    fixedVersions,
  };
}

async function fetchNvdEnrichment(
  cveId: string
): Promise<{
  status: 'verified' | 'rate_limited' | 'unavailable';
  cvssScore: number | null;
  cvssVector: string | null;
  severity: SeverityLevel;
}> {
  if (nvdCveCache.has(cveId)) {
    const cached = nvdCveCache.get(cveId)!;
    return {
      status: 'verified',
      cvssScore: cached.cvssScore,
      cvssVector: cached.cvssVector,
      severity: cached.severity,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': 'VYTRON-SupplyChain-Scanner/1.0',
    };
    if (process.env.NVD_API_KEY) {
      headers.apiKey = process.env.NVD_API_KEY;
    }
    const resp = await fetch(
      `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(cveId)}`,
      { headers, signal: controller.signal }
    );
    if (resp.status === 403 || resp.status === 429) {
      return { status: 'rate_limited', cvssScore: null, cvssVector: null, severity: 'Unknown' };
    }
    if (!resp.ok) {
      return { status: 'unavailable', cvssScore: null, cvssVector: null, severity: 'Unknown' };
    }

    const data = (await resp.json()) as {
      vulnerabilities?: Array<{
        cve?: {
          metrics?: {
            cvssMetricV31?: Array<{ cvssData?: { baseScore?: number; vectorString?: string; baseSeverity?: string } }>;
            cvssMetricV30?: Array<{ cvssData?: { baseScore?: number; vectorString?: string; baseSeverity?: string } }>;
          };
        };
      }>;
    };

    const metric =
      data.vulnerabilities?.[0]?.cve?.metrics?.cvssMetricV31?.[0]?.cvssData ??
      data.vulnerabilities?.[0]?.cve?.metrics?.cvssMetricV30?.[0]?.cvssData;

    const cvssScore = typeof metric?.baseScore === 'number' ? metric.baseScore : null;
    const cvssVector = typeof metric?.vectorString === 'string' ? metric.vectorString : null;
    const severity = mapScoreToSeverity(cvssScore, metric?.baseSeverity);

    nvdCveCache.set(cveId, { cvssScore, cvssVector, severity });
    return { status: 'verified', cvssScore, cvssVector, severity };
  } catch {
    return { status: 'unavailable', cvssScore: null, cvssVector: null, severity: 'Unknown' };
  } finally {
    clearTimeout(timeout);
  }
}

export async function runLiveVulnerabilityScan(
  orgId: string,
  sbom: SbomRecord,
  components: ComponentRecord[],
  edges: DependencyEdge[],
  dataOrigin: DataOrigin
): Promise<{
  vulnerabilities: VulnerabilityMatch[];
  exposures: ExposureFinding[];
  scannedComponents: number;
  osvReachable: boolean;
  nvdChecksAttempted: number;
  warnings: string[];
}> {
  const checkedAt = new Date().toISOString();
  const warnings: string[] = [];

  // Filter scannable library components (skip root app if version is internal or ecosystem unknown without purl)
  const scannable = components.filter((c) => c.name && c.version !== 'unspecified');
  const queryItems = scannable.map((comp) => {
    if (comp.purl && !comp.isRoot) {
      return { package: { purl: comp.purl } };
    }
    return {
      version: comp.version,
      package: {
        name: comp.name,
        ecosystem: normalizeEcosystemForOsv(comp.ecosystem),
      },
    };
  });

  if (queryItems.length === 0) {
    return {
      vulnerabilities: [],
      exposures: [],
      scannedComponents: 0,
      osvReachable: true,
      nvdChecksAttempted: 0,
      warnings: ['No components with explicit versions found to query against OSV.'],
    };
  }

  let batchResults: Array<{ vulns?: Array<{ id: string; modified?: string }> }> = [];
  let osvReachable = true;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const resp = await fetch('https://api.osv.dev/v1/querybatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries: queryItems }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) {
      osvReachable = false;
      warnings.push(`OSV API returned HTTP ${resp.status}. Scan could not complete.`);
      return {
        vulnerabilities: [],
        exposures: [],
        scannedComponents: 0,
        osvReachable: false,
        nvdChecksAttempted: 0,
        warnings,
      };
    }

    const payload = (await resp.json()) as {
      results?: Array<{ vulns?: Array<{ id: string; modified?: string }> }>;
    };
    batchResults = payload.results ?? [];
  } catch (err) {
    osvReachable = false;
    warnings.push(
      `OSV API unreachable (${err instanceof Error ? err.message : 'network timeout'}). No synthetic findings generated.`
    );
    return {
      vulnerabilities: [],
      exposures: [],
      scannedComponents: 0,
      osvReachable: false,
      nvdChecksAttempted: 0,
      warnings,
    };
  }

  // Gather unique OSV vulnerability IDs across all components
  const uniqueOsvIds = new Set<string>();
  for (const res of batchResults) {
    for (const v of res.vulns ?? []) {
      if (v.id && !osvVulnCache.has(v.id)) {
        uniqueOsvIds.add(v.id);
      }
    }
  }

  // Fetch full OSV advisory details in bounded parallel batches
  const idsToFetch = Array.from(uniqueOsvIds);
  const concurrency = 8;
  for (let i = 0; i < idsToFetch.length; i += concurrency) {
    const slice = idsToFetch.slice(i, i + concurrency);
    await Promise.all(
      slice.map(async (osvId) => {
        try {
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 8000);
          const r = await fetch(`https://api.osv.dev/v1/vulns/${encodeURIComponent(osvId)}`, {
            signal: controller.signal,
          });
          clearTimeout(t);
          if (r.ok) {
            const full = (await r.json()) as OsvVuln;
            osvVulnCache.set(osvId, full);
          }
        } catch {
          // Leave uncached if single fetch fails
        }
      })
    );
  }

  const vulnerabilities: VulnerabilityMatch[] = [];
  let nvdChecksAttempted = 0;
  let nvdRateLimitedNotified = false;

  for (let i = 0; i < scannable.length; i++) {
    const comp = scannable[i];
    const hits = batchResults[i]?.vulns ?? [];

    if (hits.length === 0) {
      // Explicitly record verified clean components? We only store matches in VulnerabilityMatch
      // and compute clean count deterministically from components without matches.
      continue;
    }

    for (const hit of hits) {
      const fullVuln = osvVulnCache.get(hit.id) ?? { id: hit.id };
      const aliases = Array.isArray(fullVuln.aliases) ? fullVuln.aliases : [];
      const cveIds = [
        ...(hit.id.startsWith('CVE-') ? [hit.id] : []),
        ...aliases.filter((a) => a.startsWith('CVE-')),
      ];

      const matchEval = evaluateDeterministicMatch(comp, fullVuln);

      // Extract CVSS from OSV severity field
      let cvssVector: string | null = null;
      let cvssScore: number | null = null;
      for (const sev of fullVuln.severity ?? []) {
        if (sev.score) {
          cvssVector = sev.score;
          cvssScore = parseCvssBaseScoreFromVector(sev.score);
        }
      }
      let severity = mapScoreToSeverity(cvssScore, fullVuln.database_specific?.severity);
      let nvdStatus: VulnerabilityMatch['nvdStatus'] = 'not_queried';
      let source: VulnerabilityMatch['source'] = 'OSV';

      // Enrich top CVEs with live NIST NVD API v2.0 (capped at 6 per scan to respect public NVD rate limits)
      if (cveIds.length > 0 && nvdChecksAttempted < 6 && !nvdRateLimitedNotified) {
        nvdChecksAttempted++;
        const nvdRes = await fetchNvdEnrichment(cveIds[0]);
        nvdStatus = nvdRes.status;
        if (nvdRes.status === 'verified') {
          source = 'OSV + NIST NVD';
          if (nvdRes.cvssScore !== null) cvssScore = nvdRes.cvssScore;
          if (nvdRes.cvssVector) cvssVector = nvdRes.cvssVector;
          if (nvdRes.severity !== 'Unknown') severity = nvdRes.severity;
        } else if (nvdRes.status === 'rate_limited') {
          nvdRateLimitedNotified = true;
          warnings.push(
            'NIST NVD public API rate limit reached during enrichment; OSV advisory data remains complete.'
          );
        }
      }

      // Deterministic severity heuristic fallback ONLY if OSV summary indicates GHSA severity in database_specific
      if (severity === 'Unknown' && fullVuln.database_specific?.severity) {
        severity = mapScoreToSeverity(null, fullVuln.database_specific.severity);
      }

      const refs = (fullVuln.references ?? [])
        .filter((r) => typeof r.url === 'string' && r.url.startsWith('http'))
        .slice(0, 5)
        .map((r) => ({ type: r.type ?? 'ADVISORY', url: r.url! }));

      vulnerabilities.push({
        id: `vuln_${crypto.randomUUID().slice(0, 12)}`,
        orgId,
        sbomId: sbom.id,
        componentId: comp.id,
        componentName: comp.name,
        componentVersion: comp.version,
        ecosystem: comp.ecosystem,
        osvId: hit.id,
        cveIds: Array.from(new Set(cveIds)),
        aliases,
        summary: fullVuln.summary || `Advisory ${hit.id} affecting ${comp.name}`,
        details: fullVuln.details || fullVuln.summary || 'Refer to upstream OSV/NVD advisory links.',
        severity,
        cvssScore,
        cvssVector,
        affectedRanges: matchEval.affectedRanges,
        fixedVersions: matchEval.fixedVersions,
        references: refs,
        matchConfidence: matchEval.confidence,
        matchReason: matchEval.reason,
        source,
        nvdStatus,
        checkedAt,
        dataOrigin,
      });
    }
  }

  const exposures = buildExposureFindings(orgId, sbom, components, edges, vulnerabilities, dataOrigin);

  return {
    vulnerabilities,
    exposures,
    scannedComponents: scannable.length,
    osvReachable,
    nvdChecksAttempted,
    warnings,
  };
}

export function buildExposureFindings(
  orgId: string,
  sbom: SbomRecord,
  components: ComponentRecord[],
  edges: DependencyEdge[],
  vulnerabilities: VulnerabilityMatch[],
  dataOrigin: DataOrigin
): ExposureFinding[] {
  const compById = new Map(components.map((c) => [c.id, c]));
  const parentMap = new Map<string, string[]>();
  for (const edge of edges) {
    const parents = parentMap.get(edge.targetComponentId) ?? [];
    parents.push(edge.sourceComponentId);
    parentMap.set(edge.targetComponentId, parents);
  }

  const tracePath = (componentId: string): string[] => {
    const path: string[] = [];
    let current: string | undefined = componentId;
    const visited = new Set<string>();
    while (current && !visited.has(current)) {
      visited.add(current);
      const comp = compById.get(current);
      if (comp) path.unshift(`${comp.name}@${comp.version}`);
      const parents = parentMap.get(current);
      current = parents && parents.length > 0 ? parents[0] : undefined;
    }
    if (path.length === 1 && sbom.applicationName) {
      path.unshift(`${sbom.applicationName}@${sbom.applicationVersion}`);
    }
    return path;
  };

  const severityWeight: Record<SeverityLevel, number> = {
    Critical: 95,
    High: 75,
    Medium: 50,
    Low: 25,
    Unknown: 35,
  };

  const findings: ExposureFinding[] = vulnerabilities.map((v) => {
    const comp = compById.get(v.componentId);
    const isDirectDependency = comp ? comp.dependencyDepth <= 1 : true;
    const fixAvailable = v.fixedVersions.length > 0;
    const fixedVersion = fixAvailable ? v.fixedVersions[v.fixedVersions.length - 1] : null;
    const isOutdated = fixAvailable;

    let score = v.cvssScore ? Math.round(v.cvssScore * 10) : severityWeight[v.severity];
    if (v.matchConfidence === 'confirmed_match') score += 10;
    if (isDirectDependency) score += 8;
    if (!fixAvailable) score += 5;
    score = Math.min(100, score);

    const recommendedAction = fixAvailable
      ? `Upgrade ${v.componentName} from ${v.componentVersion} to fixed version ${fixedVersion} (or latest patched release).`
      : `No upstream fix version published for ${v.osvId}. Restrict exposure, apply runtime WAF/sandboxing controls, or evaluate alternative packages.`;

    return {
      id: `exp_${crypto.randomUUID().slice(0, 12)}`,
      orgId,
      sbomId: sbom.id,
      applicationName: sbom.applicationName,
      componentId: v.componentId,
      componentName: v.componentName,
      componentVersion: v.componentVersion,
      ecosystem: v.ecosystem,
      vulnerabilityId: v.id,
      advisoryId: v.cveIds[0] ?? v.osvId,
      cveIds: v.cveIds,
      severity: v.severity,
      cvssScore: v.cvssScore,
      matchConfidence: v.matchConfidence,
      isDirectDependency,
      dependencyPath: tracePath(v.componentId),
      isOutdated,
      fixAvailable,
      fixedVersion,
      recommendedAction,
      priorityScore: score,
      investigationStatus: 'New',
      dataOrigin,
      updatedAt: v.checkedAt,
    };
  });

  return findings.sort((a, b) => b.priorityScore - a.priorityScore);
}
