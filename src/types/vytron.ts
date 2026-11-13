export type UserRole = 'Admin' | 'Security Engineer' | 'Remediation Owner' | 'Auditor';

export type DataOrigin = 'DEMO_DATA' | 'LIVE_VERIFIED';

export type SbomFormat = 'CycloneDX JSON' | 'CycloneDX XML' | 'SPDX JSON' | 'SPDX Tag-Value';

export type SeverityLevel = 'Critical' | 'High' | 'Medium' | 'Low' | 'Unknown';

export type MatchConfidence =
  | 'confirmed_match'
  | 'potentially_affected'
  | 'unverified'
  | 'no_known_vulnerability';

export type InvestigationStatus =
  | 'New'
  | 'Triaged'
  | 'Confirmed'
  | 'False Positive'
  | 'Accepted Risk';

export type IncidentStatus =
  | 'Open'
  | 'Investigating'
  | 'Remediation in progress'
  | 'Awaiting verification'
  | 'Resolved';

export type RemediationStatus =
  | 'Pending'
  | 'In Progress'
  | 'Blocked'
  | 'Awaiting Verification'
  | 'Completed';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  industry: string;
  planTier: 'Developer' | 'Professional' | 'Enterprise' | 'API Usage';
  isDemo: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  orgId: string;
  email: string;
  fullName: string;
  role: UserRole;
  passwordHash: string;
  passwordSalt: string;
  createdAt: string;
  lastLoginAt?: string;
}

export interface SafeUser {
  id: string;
  orgId: string;
  email: string;
  fullName: string;
  role: UserRole;
  createdAt: string;
  lastLoginAt?: string;
}

export interface SbomRecord {
  id: string;
  orgId: string;
  applicationName: string;
  applicationVersion: string;
  fileName: string;
  format: SbomFormat;
  specVersion: string;
  componentCount: number;
  duplicateCount: number;
  uploadedBy: string;
  uploadedAt: string;
  lastScannedAt?: string;
  dataOrigin: DataOrigin;
  sha256: string;
}

export interface ComponentRecord {
  id: string;
  orgId: string;
  sbomId: string;
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
  dataOrigin: DataOrigin;
  createdAt: string;
}

export interface DependencyEdge {
  id: string;
  orgId: string;
  sbomId: string;
  sourceComponentId: string;
  targetComponentId: string;
  sourceRef: string;
  targetRef: string;
  relationship: 'DEPENDS_ON' | 'CONTAINS';
}

export interface VulnerabilityMatch {
  id: string;
  orgId: string;
  sbomId: string;
  componentId: string;
  componentName: string;
  componentVersion: string;
  ecosystem: string;
  osvId: string;
  cveIds: string[];
  aliases: string[];
  summary: string;
  details: string;
  severity: SeverityLevel;
  cvssScore: number | null;
  cvssVector: string | null;
  affectedRanges: string[];
  fixedVersions: string[];
  references: { type: string; url: string }[];
  matchConfidence: MatchConfidence;
  matchReason: string;
  source: 'OSV' | 'OSV + NIST NVD' | 'DEMO_CATALOG';
  nvdStatus: 'verified' | 'rate_limited' | 'unavailable' | 'not_queried';
  checkedAt: string;
  dataOrigin: DataOrigin;
}

export interface ExposureFinding {
  id: string;
  orgId: string;
  sbomId: string;
  applicationName: string;
  componentId: string;
  componentName: string;
  componentVersion: string;
  ecosystem: string;
  vulnerabilityId: string;
  advisoryId: string;
  cveIds: string[];
  severity: SeverityLevel;
  cvssScore: number | null;
  matchConfidence: MatchConfidence;
  isDirectDependency: boolean;
  dependencyPath: string[];
  isOutdated: boolean;
  fixAvailable: boolean;
  fixedVersion: string | null;
  recommendedAction: string;
  priorityScore: number;
  investigationStatus: InvestigationStatus;
  dataOrigin: DataOrigin;
  updatedAt: string;
}

export interface IncidentNote {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface IncidentAuditEntry {
  id: string;
  actorName: string;
  action: string;
  fromStatus?: string;
  toStatus?: string;
  timestamp: string;
}

export interface Incident {
  id: string;
  orgId: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  status: IncidentStatus;
  ownerId: string;
  ownerName: string;
  linkedVulnerabilityIds: string[];
  linkedComponentIds: string[];
  linkedAdvisoryIds: string[];
  notes: IncidentNote[];
  verificationEvidence: string;
  auditHistory: IncidentAuditEntry[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  dataOrigin: DataOrigin;
}

export interface RemediationTask {
  id: string;
  orgId: string;
  exposureId?: string;
  incidentId?: string;
  advisoryId: string;
  componentId: string;
  componentName: string;
  componentVersion: string;
  applicationName: string;
  severity: SeverityLevel;
  recommendedAction: string;
  responsibleOwner: string;
  dueDate: string;
  status: RemediationStatus;
  resolutionEvidence: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  dataOrigin: DataOrigin;
}

export interface AuditLogEntry {
  id: string;
  orgId: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  metadata: Record<string, string | number | boolean>;
  timestamp: string;
  dataOrigin: DataOrigin;
}

export interface ApiKeyRecord {
  id: string;
  orgId: string;
  name: string;
  prefix: string;
  keyHash: string;
  createdBy: string;
  createdAt: string;
  lastUsedAt?: string;
  scopes: string[];
}

export interface CommercialEnquiry {
  id: string;
  fullName: string;
  workEmail: string;
  company: string;
  teamSize: string;
  interestTier: string;
  message: string;
  createdAt: string;
}

export interface DashboardMetrics {
  totalComponents: number;
  uniqueComponents: number;
  totalKnownVulnerabilities: number;
  confirmedVulnerabilities: number;
  potentiallyAffected: number;
  criticalFindings: number;
  highFindings: number;
  mediumFindings: number;
  lowFindings: number;
  activeIncidents: number;
  resolvedIncidents: number;
  remediationTotal: number;
  remediationCompleted: number;
  remediationCompletionPct: number;
  outdatedDependencies: number;
  noFixAvailableCount: number;
  sbomCount: number;
}
