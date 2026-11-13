import crypto from 'crypto';
import { XMLParser } from 'fast-xml-parser';
import type { SbomFormat } from '../types/vytron.ts';

export interface ParsedComponent {
  bomRef: string;
  name: string;
  version: string;
  ecosystem: string;
  purl?: string;
  cpe?: string;
  supplier?: string;
  license?: string;
  isRoot: boolean;
  dependencyDepth: number;
}

export interface ParsedEdge {
  sourceRef: string;
  targetRef: string;
  relationship: 'DEPENDS_ON' | 'CONTAINS';
}

export interface ParsedSbomResult {
  format: SbomFormat;
  specVersion: string;
  applicationName: string;
  applicationVersion: string;
  sha256: string;
  components: ParsedComponent[];
  edges: ParsedEdge[];
  inFileDuplicates: number;
}

const PURL_ECOSYSTEM_MAP: Record<string, string> = {
  npm: 'npm',
  pypi: 'PyPI',
  maven: 'Maven',
  golang: 'Go',
  go: 'Go',
  cargo: 'crates.io',
  gem: 'RubyGems',
  nuget: 'NuGet',
  composer: 'Packagist',
  deb: 'Debian',
  apk: 'Alpine',
  rpm: 'Red Hat',
  oci: 'Docker',
  docker: 'Docker',
  generic: 'Generic',
};

export function inferEcosystemFromPurl(purl?: string, fallback = 'Unknown'): string {
  if (!purl || !purl.startsWith('pkg:')) return fallback;
  const withoutScheme = purl.slice(4);
  const typeEnd = withoutScheme.indexOf('/');
  if (typeEnd === -1) return fallback;
  const rawType = withoutScheme.slice(0, typeEnd).toLowerCase();
  return PURL_ECOSYSTEM_MAP[rawType] ?? rawType;
}

export function inferNameFromPurl(purl?: string): string | undefined {
  if (!purl || !purl.startsWith('pkg:')) return undefined;
  const body = purl.slice(4).split('?')[0].split('#')[0];
  const atIdx = body.lastIndexOf('@');
  const pathPart = atIdx > 0 ? body.slice(0, atIdx) : body;
  const firstSlash = pathPart.indexOf('/');
  if (firstSlash === -1) return undefined;
  const rest = decodeURIComponent(pathPart.slice(firstSlash + 1));
  if (purl.startsWith('pkg:maven/')) {
    return rest.replace('/', ':');
  }
  return rest;
}

function extractCycloneDxLicense(rawLicenses: unknown): string {
  if (!rawLicenses) return 'NOASSERTION';
  const arr = Array.isArray(rawLicenses) ? rawLicenses : [rawLicenses];
  const labels: string[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if (typeof obj.expression === 'string' && obj.expression.trim()) {
      labels.push(obj.expression.trim());
    } else if (obj.license && typeof obj.license === 'object') {
      const lic = obj.license as Record<string, unknown>;
      if (typeof lic.id === 'string' && lic.id.trim()) labels.push(lic.id.trim());
      else if (typeof lic.name === 'string' && lic.name.trim()) labels.push(lic.name.trim());
    } else if (typeof obj.id === 'string' && obj.id.trim()) {
      labels.push(obj.id.trim());
    } else if (typeof obj.name === 'string' && obj.name.trim()) {
      labels.push(obj.name.trim());
    }
  }
  return labels.length > 0 ? labels.join(' OR ') : 'NOASSERTION';
}

function computeDepths(components: ParsedComponent[], edges: ParsedEdge[]): void {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.sourceRef) ?? [];
    list.push(e.targetRef);
    adj.set(e.sourceRef, list);
  }

  const roots = components.filter((c) => c.isRoot).map((c) => c.bomRef);
  const depthMap = new Map<string, number>();
  const queue: Array<{ ref: string; depth: number }> = [];

  for (const r of roots) {
    depthMap.set(r, 0);
    queue.push({ ref: r, depth: 0 });
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adj.get(current.ref) ?? [];
    for (const n of neighbors) {
      if (!depthMap.has(n) || depthMap.get(n)! > current.depth + 1) {
        depthMap.set(n, current.depth + 1);
        queue.push({ ref: n, depth: current.depth + 1 });
      }
    }
  }

  for (const comp of components) {
    if (comp.isRoot) {
      comp.dependencyDepth = 0;
    } else if (depthMap.has(comp.bomRef)) {
      comp.dependencyDepth = depthMap.get(comp.bomRef)!;
    } else {
      comp.dependencyDepth = 1;
    }
  }
}

function parseCycloneDxJson(raw: Record<string, unknown>, sha256: string, fileName: string): ParsedSbomResult {
  const specVersion = String(raw.specVersion ?? '1.4');
  const metadata = (raw.metadata ?? {}) as Record<string, unknown>;
  const rootMetaComp = (metadata.component ?? {}) as Record<string, unknown>;

  const applicationName =
    typeof rootMetaComp.name === 'string' && rootMetaComp.name.trim()
      ? rootMetaComp.name.trim()
      : fileName.replace(/\.[^.]+$/, '');
  const applicationVersion =
    typeof rootMetaComp.version === 'string' && rootMetaComp.version.trim()
      ? rootMetaComp.version.trim()
      : '1.0.0';

  const seenKeys = new Set<string>();
  const components: ParsedComponent[] = [];
  let inFileDuplicates = 0;

  const pushComponent = (comp: Record<string, unknown>, isRoot: boolean) => {
    const purl = typeof comp.purl === 'string' ? comp.purl.trim() : undefined;
    const rawName = typeof comp.name === 'string' ? comp.name.trim() : inferNameFromPurl(purl) ?? '';
    if (!rawName) return;
    const rawVersion = typeof comp.version === 'string' && comp.version.trim() ? comp.version.trim() : 'unspecified';
    const bomRef =
      typeof comp['bom-ref'] === 'string' && comp['bom-ref'].trim()
        ? comp['bom-ref'].trim()
        : purl ?? `${rawName}@${rawVersion}`;

    const dedupeKey = `${rawName.toLowerCase()}@${rawVersion.toLowerCase()}@${inferEcosystemFromPurl(purl)}`;
    if (seenKeys.has(dedupeKey) && !isRoot) {
      inFileDuplicates++;
      return;
    }
    seenKeys.add(dedupeKey);

    let supplier: string | undefined;
    if (comp.supplier && typeof comp.supplier === 'object') {
      const supObj = comp.supplier as Record<string, unknown>;
      if (typeof supObj.name === 'string') supplier = supObj.name.trim();
    } else if (typeof comp.publisher === 'string') {
      supplier = comp.publisher.trim();
    }

    components.push({
      bomRef,
      name: rawName,
      version: rawVersion,
      ecosystem: inferEcosystemFromPurl(purl, 'Unknown'),
      purl,
      cpe: typeof comp.cpe === 'string' ? comp.cpe.trim() : undefined,
      supplier: supplier || 'Unspecified',
      license: extractCycloneDxLicense(comp.licenses),
      isRoot,
      dependencyDepth: isRoot ? 0 : 1,
    });
  };

  if (rootMetaComp && typeof rootMetaComp.name === 'string') {
    pushComponent(rootMetaComp, true);
  }

  const rawComponents = Array.isArray(raw.components) ? raw.components : [];
  for (const item of rawComponents) {
    if (item && typeof item === 'object') {
      pushComponent(item as Record<string, unknown>, false);
    }
  }

  const edges: ParsedEdge[] = [];
  const rawDeps = Array.isArray(raw.dependencies) ? raw.dependencies : [];
  for (const dep of rawDeps) {
    if (!dep || typeof dep !== 'object') continue;
    const dObj = dep as Record<string, unknown>;
    const sourceRef = typeof dObj.ref === 'string' ? dObj.ref.trim() : '';
    const dependsOn = Array.isArray(dObj.dependsOn) ? dObj.dependsOn : [];
    for (const target of dependsOn) {
      if (typeof target === 'string' && target.trim() && sourceRef) {
        edges.push({
          sourceRef,
          targetRef: target.trim(),
          relationship: 'DEPENDS_ON',
        });
      }
    }
  }

  if (components.length === 0) {
    throw new Error('CycloneDX JSON contains zero parseable components.');
  }

  computeDepths(components, edges);

  return {
    format: 'CycloneDX JSON',
    specVersion,
    applicationName,
    applicationVersion,
    sha256,
    components,
    edges,
    inFileDuplicates,
  };
}

function parseCycloneDxXml(xmlContent: string, sha256: string, fileName: string): ParsedSbomResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => ['component', 'dependency', 'license'].includes(name),
  });

  const parsed = parser.parse(xmlContent) as Record<string, unknown>;
  const bom = (parsed.bom ?? parsed.Bom) as Record<string, unknown> | undefined;
  if (!bom || typeof bom !== 'object') {
    throw new Error('Invalid CycloneDX XML: missing <bom> root element.');
  }

  const xmlns = String(bom['@_xmlns'] ?? '');
  const versionMatch = xmlns.match(/(\d+\.\d+)/);
  const specVersion = versionMatch ? versionMatch[1] : '1.4';

  const metadata = (bom.metadata ?? {}) as Record<string, unknown>;
  const metaCompRaw = metadata.component;
  const rootMetaComp = Array.isArray(metaCompRaw)
    ? (metaCompRaw[0] as Record<string, unknown> | undefined)
    : (metaCompRaw as Record<string, unknown> | undefined);

  const applicationName =
    rootMetaComp && typeof rootMetaComp.name === 'string'
      ? rootMetaComp.name.trim()
      : fileName.replace(/\.[^.]+$/, '');
  const applicationVersion =
    rootMetaComp && rootMetaComp.version !== undefined
      ? String(rootMetaComp.version).trim()
      : '1.0.0';

  const seenKeys = new Set<string>();
  const components: ParsedComponent[] = [];
  let inFileDuplicates = 0;

  const pushXmlComp = (comp: Record<string, unknown>, isRoot: boolean) => {
    const purl = typeof comp.purl === 'string' ? comp.purl.trim() : undefined;
    const name =
      typeof comp.name === 'string' && comp.name.trim()
        ? comp.name.trim()
        : inferNameFromPurl(purl) ?? '';
    if (!name) return;

    const version =
      comp.version !== undefined && String(comp.version).trim()
        ? String(comp.version).trim()
        : 'unspecified';

    const bomRef =
      typeof comp['@_bom-ref'] === 'string' && comp['@_bom-ref'].trim()
        ? comp['@_bom-ref'].trim()
        : purl ?? `${name}@${version}`;

    const dedupeKey = `${name.toLowerCase()}@${version.toLowerCase()}@${inferEcosystemFromPurl(purl)}`;
    if (seenKeys.has(dedupeKey) && !isRoot) {
      inFileDuplicates++;
      return;
    }
    seenKeys.add(dedupeKey);

    let supplier = 'Unspecified';
    if (comp.supplier && typeof comp.supplier === 'object') {
      const sObj = comp.supplier as Record<string, unknown>;
      if (typeof sObj.name === 'string' && sObj.name.trim()) supplier = sObj.name.trim();
    }

    let license = 'NOASSERTION';
    if (comp.licenses && typeof comp.licenses === 'object') {
      const licObj = comp.licenses as Record<string, unknown>;
      license = extractCycloneDxLicense(licObj.license ?? licObj);
    }

    components.push({
      bomRef,
      name,
      version,
      ecosystem: inferEcosystemFromPurl(purl, 'Unknown'),
      purl,
      cpe: typeof comp.cpe === 'string' ? comp.cpe.trim() : undefined,
      supplier,
      license,
      isRoot,
      dependencyDepth: isRoot ? 0 : 1,
    });
  };

  if (rootMetaComp) {
    pushXmlComp(rootMetaComp, true);
  }

  const compsContainer = (bom.components ?? {}) as Record<string, unknown>;
  const rawComps = Array.isArray(compsContainer.component) ? compsContainer.component : [];
  for (const item of rawComps) {
    if (item && typeof item === 'object') {
      pushXmlComp(item as Record<string, unknown>, false);
    }
  }

  const edges: ParsedEdge[] = [];
  const depsContainer = (bom.dependencies ?? {}) as Record<string, unknown>;
  const rawDeps = Array.isArray(depsContainer.dependency) ? depsContainer.dependency : [];
  for (const dep of rawDeps) {
    if (!dep || typeof dep !== 'object') continue;
    const dObj = dep as Record<string, unknown>;
    const sourceRef = typeof dObj['@_ref'] === 'string' ? dObj['@_ref'].trim() : '';
    const nested = Array.isArray(dObj.dependency) ? dObj.dependency : [];
    for (const child of nested) {
      if (child && typeof child === 'object') {
        const targetRef = typeof (child as Record<string, unknown>)['@_ref'] === 'string'
          ? String((child as Record<string, unknown>)['@_ref']).trim()
          : '';
        if (sourceRef && targetRef) {
          edges.push({ sourceRef, targetRef, relationship: 'DEPENDS_ON' });
        }
      }
    }
  }

  if (components.length === 0) {
    throw new Error('CycloneDX XML contains zero parseable <component> elements.');
  }

  computeDepths(components, edges);

  return {
    format: 'CycloneDX XML',
    specVersion,
    applicationName,
    applicationVersion,
    sha256,
    components,
    edges,
    inFileDuplicates,
  };
}

function parseSpdxJson(raw: Record<string, unknown>, sha256: string, fileName: string): ParsedSbomResult {
  const specVersion = String(raw.spdxVersion ?? 'SPDX-2.3');
  const rawPackages = Array.isArray(raw.packages) ? raw.packages : [];
  if (rawPackages.length === 0) {
    throw new Error('SPDX JSON document contains no packages.');
  }

  const rawRels = Array.isArray(raw.relationships) ? raw.relationships : [];
  const describedIds = new Set<string>();
  const edges: ParsedEdge[] = [];

  for (const rel of rawRels) {
    if (!rel || typeof rel !== 'object') continue;
    const r = rel as Record<string, unknown>;
    const src = typeof r.spdxElementId === 'string' ? r.spdxElementId.trim() : '';
    const relType = typeof r.relationshipType === 'string' ? r.relationshipType.trim().toUpperCase() : '';
    const dst = typeof r.relatedSpdxElement === 'string' ? r.relatedSpdxElement.trim() : '';
    if (relType === 'DESCRIBES' && dst) {
      describedIds.add(dst);
    } else if ((relType === 'DEPENDS_ON' || relType === 'CONTAINS') && src && dst) {
      edges.push({
        sourceRef: src,
        targetRef: dst,
        relationship: relType === 'CONTAINS' ? 'CONTAINS' : 'DEPENDS_ON',
      });
    }
  }

  const seenKeys = new Set<string>();
  const components: ParsedComponent[] = [];
  let inFileDuplicates = 0;

  for (let i = 0; i < rawPackages.length; i++) {
    const pkg = rawPackages[i] as Record<string, unknown>;
    if (!pkg || typeof pkg !== 'object') continue;
    const spdxId = typeof pkg.SPDXID === 'string' ? pkg.SPDXID.trim() : `SPDXRef-Pkg-${i}`;
    const name = typeof pkg.name === 'string' ? pkg.name.trim() : '';
    if (!name) continue;
    const version =
      typeof pkg.versionInfo === 'string' && pkg.versionInfo.trim()
        ? pkg.versionInfo.trim()
        : 'unspecified';

    let purl: string | undefined;
    let cpe: string | undefined;
    const extRefs = Array.isArray(pkg.externalRefs) ? pkg.externalRefs : [];
    for (const ref of extRefs) {
      if (!ref || typeof ref !== 'object') continue;
      const rObj = ref as Record<string, unknown>;
      const refType = String(rObj.referenceType ?? '').toLowerCase();
      const locator = typeof rObj.referenceLocator === 'string' ? rObj.referenceLocator.trim() : '';
      if (refType === 'purl' && locator) purl = locator;
      if ((refType === 'cpe23type' || refType === 'cpe22type') && locator) cpe = locator;
    }

    const ecosystem = inferEcosystemFromPurl(purl, 'Unknown');
    const isRoot = describedIds.has(spdxId) || (describedIds.size === 0 && i === 0);
    const dedupeKey = `${name.toLowerCase()}@${version.toLowerCase()}@${ecosystem}`;
    if (seenKeys.has(dedupeKey) && !isRoot) {
      inFileDuplicates++;
      continue;
    }
    seenKeys.add(dedupeKey);

    const supplierRaw = typeof pkg.supplier === 'string' ? pkg.supplier.trim() : '';
    const supplier = supplierRaw.replace(/^(Organization|Person):\s*/i, '') || 'Unspecified';
    const license =
      typeof pkg.licenseConcluded === 'string' && pkg.licenseConcluded !== 'NOASSERTION'
        ? pkg.licenseConcluded.trim()
        : typeof pkg.licenseDeclared === 'string'
        ? pkg.licenseDeclared.trim()
        : 'NOASSERTION';

    components.push({
      bomRef: spdxId,
      name,
      version,
      ecosystem,
      purl,
      cpe,
      supplier,
      license,
      isRoot,
      dependencyDepth: isRoot ? 0 : 1,
    });
  }

  const rootComp = components.find((c) => c.isRoot);
  const docName = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : fileName.replace(/\.[^.]+$/, '');
  const applicationName = rootComp?.name ?? docName;
  const applicationVersion = rootComp?.version && rootComp.version !== 'unspecified' ? rootComp.version : '1.0.0';

  computeDepths(components, edges);

  return {
    format: 'SPDX JSON',
    specVersion,
    applicationName,
    applicationVersion,
    sha256,
    components,
    edges,
    inFileDuplicates,
  };
}

function parseSpdxTagValue(content: string, sha256: string, fileName: string): ParsedSbomResult {
  const lines = content.split(/\r?\n/);
  let specVersion = 'SPDX-2.3';
  let documentName = fileName.replace(/\.[^.]+$/, '');

  interface TempPkg {
    bomRef: string;
    name: string;
    version: string;
    supplier: string;
    license: string;
    purl?: string;
    cpe?: string;
  }

  const rawPackages: TempPkg[] = [];
  let current: TempPkg | null = null;
  const describedIds = new Set<string>();
  const edges: ParsedEdge[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();

    if (key === 'SPDXVersion') specVersion = val;
    else if (key === 'DocumentName' && val) documentName = val;
    else if (key === 'PackageName') {
      if (current && current.name) rawPackages.push(current);
      current = {
        bomRef: `SPDXRef-Pkg-${rawPackages.length + 1}`,
        name: val,
        version: 'unspecified',
        supplier: 'Unspecified',
        license: 'NOASSERTION',
      };
    } else if (current) {
      if (key === 'SPDXID') current.bomRef = val;
      else if (key === 'PackageVersion' && val) current.version = val;
      else if (key === 'PackageSupplier' && val) {
        current.supplier = val.replace(/^(Organization|Person):\s*/i, '');
      } else if (key === 'PackageLicenseConcluded' && val && val !== 'NOASSERTION') {
        current.license = val;
      } else if (key === 'PackageLicenseDeclared' && val && current.license === 'NOASSERTION') {
        current.license = val;
      } else if (key === 'ExternalRef') {
        const parts = val.split(/\s+/);
        if (parts.length >= 3 && parts[1].toLowerCase() === 'purl') {
          current.purl = parts[2];
        } else if (parts.length >= 3 && parts[1].toLowerCase().startsWith('cpe')) {
          current.cpe = parts[2];
        }
      }
    }

    if (key === 'Relationship') {
      const parts = val.split(/\s+/);
      if (parts.length >= 3) {
        const [src, relType, dst] = parts;
        if (relType.toUpperCase() === 'DESCRIBES') {
          describedIds.add(dst);
        } else if (relType.toUpperCase() === 'DEPENDS_ON' || relType.toUpperCase() === 'CONTAINS') {
          edges.push({
            sourceRef: src,
            targetRef: dst,
            relationship: relType.toUpperCase() === 'CONTAINS' ? 'CONTAINS' : 'DEPENDS_ON',
          });
        }
      }
    }
  }
  if (current && current.name) rawPackages.push(current);

  if (rawPackages.length === 0) {
    throw new Error('SPDX Tag-Value document contains zero PackageName entries.');
  }

  const seenKeys = new Set<string>();
  const components: ParsedComponent[] = [];
  let inFileDuplicates = 0;

  rawPackages.forEach((pkg, idx) => {
    const ecosystem = inferEcosystemFromPurl(pkg.purl, 'Unknown');
    const isRoot = describedIds.has(pkg.bomRef) || (describedIds.size === 0 && idx === 0);
    const dedupeKey = `${pkg.name.toLowerCase()}@${pkg.version.toLowerCase()}@${ecosystem}`;
    if (seenKeys.has(dedupeKey) && !isRoot) {
      inFileDuplicates++;
      return;
    }
    seenKeys.add(dedupeKey);

    components.push({
      bomRef: pkg.bomRef,
      name: pkg.name,
      version: pkg.version,
      ecosystem,
      purl: pkg.purl,
      cpe: pkg.cpe,
      supplier: pkg.supplier,
      license: pkg.license,
      isRoot,
      dependencyDepth: isRoot ? 0 : 1,
    });
  });

  const rootComp = components.find((c) => c.isRoot);
  computeDepths(components, edges);

  return {
    format: 'SPDX Tag-Value',
    specVersion,
    applicationName: rootComp?.name ?? documentName,
    applicationVersion: rootComp?.version && rootComp.version !== 'unspecified' ? rootComp.version : '1.0.0',
    sha256,
    components,
    edges,
    inFileDuplicates,
  };
}

export function parseSbomDocument(
  content: string,
  fileName: string,
  overrideAppName?: string
): ParsedSbomResult {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error('Uploaded SBOM file is empty.');
  }
  if (Buffer.byteLength(trimmed, 'utf8') > 5 * 1024 * 1024) {
    throw new Error('SBOM file exceeds maximum 5 MB limit.');
  }

  const sha256 = crypto.createHash('sha256').update(trimmed, 'utf8').digest('hex');

  let result: ParsedSbomResult;

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    let json: unknown;
    try {
      json = JSON.parse(trimmed);
    } catch {
      throw new Error('Malformed JSON SBOM payload.');
    }
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      throw new Error('JSON SBOM must be a top-level JSON object.');
    }
    const obj = json as Record<string, unknown>;
    if (obj.bomFormat === 'CycloneDX' || Array.isArray(obj.components)) {
      result = parseCycloneDxJson(obj, sha256, fileName);
    } else if (typeof obj.spdxVersion === 'string' || Array.isArray(obj.packages)) {
      result = parseSpdxJson(obj, sha256, fileName);
    } else {
      throw new Error('Unrecognized JSON SBOM schema. Expected CycloneDX or SPDX JSON.');
    }
  } else if (trimmed.startsWith('<')) {
    result = parseCycloneDxXml(trimmed, sha256, fileName);
  } else if (/^SPDXVersion\s*:/im.test(trimmed) || /^PackageName\s*:/im.test(trimmed)) {
    result = parseSpdxTagValue(trimmed, sha256, fileName);
  } else {
    throw new Error(
      'Unsupported SBOM format. Supported formats: CycloneDX JSON, CycloneDX XML, SPDX JSON, and SPDX Tag-Value.'
    );
  }

  if (overrideAppName && overrideAppName.trim()) {
    result.applicationName = overrideAppName.trim();
  }

  return result;
}
