# VYTRON — Enterprise Software Supply-Chain Intelligence Infrastructure

## 1. Architecture Overview
VYTRON separates deterministic security verification from AI-assisted explanation:
- **Frontend**: React 19 + TypeScript + Tailwind CSS v4 (`src/components/`, `src/lib/`).
- **Backend**: Modular Express TypeScript REST API (`server.ts`, `src/server/`) serving `/api/v1/*`.
- **SBOM Parser (`src/server/sbomParser.ts`)**: Deterministic ingestion for CycloneDX JSON, CycloneDX XML (`fast-xml-parser`), SPDX 2.3 JSON, and SPDX Tag-Value.
- **Vulnerability & Exposure Engine (`src/server/vulnEngine.ts`)**: Live batch queries against `https://api.osv.dev/v1/querybatch` and advisory enrichment against `https://services.nvd.nist.gov/rest/json/cves/2.0`, evaluated with `semver` range matching.
- **AI Analyst (`src/server/geminiService.ts`)**: Server-side `@google/genai` (`gemini-4-hydrogen`) strictly constrained to retrieved advisory/inventory records.
- **Persistence (`src/server/db.ts`)**: Atomic file-backed relational store (`data/vytron-store.json`) with production PostgreSQL migration schema at `docs/postgres_schema.sql`.

## 2. Deployment Instructions
1. Install dependencies: `npm install`
2. Configure environment variables (`GEMINI_API_KEY`, `VYTRON_SESSION_SECRET`, optional `NVD_API_KEY`).
3. Build frontend assets: `npm run build`
4. Start production server: `NODE_ENV=production npm start` (listens on port 3000).
5. When migrating to managed PostgreSQL, execute `docs/postgres_schema.sql` and replace `src/server/db.ts` store reads/writes with `pg` pool queries.

## 3. Transparent Limitations & Unfinished Roadmap Items
- **Runtime Stack**: Active sandbox runs Node.js Express (`server.ts`) rather than Python FastAPI.
- **Database**: Active MVP persists to a single-instance relational JSON store (`data/vytron-store.json`) rather than managed PostgreSQL/Firestore.
- **Future Integrations**: GitHub Dependabot/Actions app sync, GitLab pipeline scanning, Jira bidirectional sync, and Splunk/Sentinel SIEM streaming are documented in the API & Integrations hub as planned roadmap connectors and are intentionally not mocked.
