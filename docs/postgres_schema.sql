-- VYTRON Enterprise Supply-Chain Intelligence
-- Target Production PostgreSQL 16+ Relational Schema
-- Use for migrating from the embedded MVP store to managed PostgreSQL / Cloud SQL.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  industry TEXT NOT NULL,
  plan_tier TEXT NOT NULL CHECK (plan_tier IN ('Developer', 'Professional', 'Enterprise', 'API Usage')),
  is_demo BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Security Engineer', 'Remediation Owner', 'Auditor')),
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES users(id),
  scopes TEXT[] NOT NULL DEFAULT ARRAY['sbom:write', 'vuln:read'],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE TABLE sboms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  application_name TEXT NOT NULL,
  application_version TEXT NOT NULL,
  file_name TEXT NOT NULL,
  format TEXT NOT NULL,
  spec_version TEXT NOT NULL,
  component_count INTEGER NOT NULL,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  sha256 TEXT NOT NULL,
  data_origin TEXT NOT NULL CHECK (data_origin IN ('DEMO_DATA', 'LIVE_VERIFIED')),
  uploaded_by TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_scanned_at TIMESTAMPTZ
);

CREATE TABLE components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sbom_id UUID NOT NULL REFERENCES sboms(id) ON DELETE CASCADE,
  bom_ref TEXT NOT NULL,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  ecosystem TEXT NOT NULL,
  purl TEXT,
  cpe TEXT,
  supplier TEXT,
  license TEXT,
  is_root BOOLEAN NOT NULL DEFAULT FALSE,
  dependency_depth INTEGER NOT NULL DEFAULT 1,
  data_origin TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE dependency_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sbom_id UUID NOT NULL REFERENCES sboms(id) ON DELETE CASCADE,
  source_component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  target_component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  relationship TEXT NOT NULL CHECK (relationship IN ('DEPENDS_ON', 'CONTAINS'))
);

CREATE TABLE vulnerability_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sbom_id UUID NOT NULL REFERENCES sboms(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  osv_id TEXT NOT NULL,
  cve_ids TEXT[] NOT NULL DEFAULT '{}',
  summary TEXT NOT NULL,
  details TEXT NOT NULL,
  severity TEXT NOT NULL,
  cvss_score NUMERIC(4,1),
  cvss_vector TEXT,
  affected_ranges TEXT[] NOT NULL DEFAULT '{}',
  fixed_versions TEXT[] NOT NULL DEFAULT '{}',
  match_confidence TEXT NOT NULL CHECK (match_confidence IN ('confirmed_match', 'potentially_affected', 'unverified', 'no_known_vulnerability')),
  match_reason TEXT NOT NULL,
  source TEXT NOT NULL,
  nvd_status TEXT NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_origin TEXT NOT NULL
);

CREATE TABLE exposure_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sbom_id UUID NOT NULL REFERENCES sboms(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  vulnerability_id UUID NOT NULL REFERENCES vulnerability_matches(id) ON DELETE CASCADE,
  advisory_id TEXT NOT NULL,
  priority_score INTEGER NOT NULL,
  is_direct_dependency BOOLEAN NOT NULL,
  dependency_path TEXT[] NOT NULL,
  fix_available BOOLEAN NOT NULL,
  fixed_version TEXT,
  recommended_action TEXT NOT NULL,
  investigation_status TEXT NOT NULL,
  data_origin TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Open', 'Investigating', 'Remediation in progress', 'Awaiting verification', 'Resolved')),
  owner_id UUID REFERENCES users(id),
  owner_name TEXT NOT NULL,
  verification_evidence TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  data_origin TEXT NOT NULL
);

CREATE TABLE remediations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  exposure_id UUID REFERENCES exposure_findings(id) ON DELETE SET NULL,
  incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,
  component_id UUID NOT NULL REFERENCES components(id) ON DELETE CASCADE,
  advisory_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  recommended_action TEXT NOT NULL,
  responsible_owner TEXT NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pending', 'In Progress', 'Blocked', 'Awaiting Verification', 'Completed')),
  resolution_evidence TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  data_origin TEXT NOT NULL
);

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data_origin TEXT NOT NULL
);

CREATE INDEX idx_components_org ON components(org_id, ecosystem, name);
CREATE INDEX idx_vulns_org_sev ON vulnerability_matches(org_id, severity);
CREATE INDEX idx_audit_org_ts ON audit_logs(org_id, timestamp DESC);
