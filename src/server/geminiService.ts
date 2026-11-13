import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type {
  ComponentRecord,
  DashboardMetrics,
  ExposureFinding,
  Incident,
  RemediationTask,
  VulnerabilityMatch,
} from '../types/vytron.ts';

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in the server environment.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

const EVIDENCE_SYSTEM_INSTRUCTION = `You are the VYTRON Security Intelligence Analyst.
CRITICAL CONSTRAINTS:
1. You MUST ONLY explain, summarize, and reason about the exact retrieved evidence JSON provided in the prompt.
2. NEVER invent CVE IDs, OSV IDs, CVSS scores, package versions, or claim that an unlisted package is vulnerable.
3. If dataOrigin is "DEMO_DATA", explicitly note that the analysis covers simulated demonstration data.
4. Use crisp, technical, enterprise-grade prose suitable for security engineers and CISOs. Avoid hype or speculation.`;

export async function explainVulnerabilityWithAi(
  vuln: VulnerabilityMatch,
  exposure?: ExposureFinding
): Promise<string> {
  const ai = getClient();
  const evidence = {
    dataOrigin: vuln.dataOrigin,
    advisoryId: vuln.osvId,
    cveIds: vuln.cveIds,
    component: `${vuln.componentName}@${vuln.componentVersion}`,
    ecosystem: vuln.ecosystem,
    severity: vuln.severity,
    cvssScore: vuln.cvssScore,
    cvssVector: vuln.cvssVector,
    matchConfidence: vuln.matchConfidence,
    matchReason: vuln.matchReason,
    affectedRanges: vuln.affectedRanges,
    fixedVersions: vuln.fixedVersions,
    summary: vuln.summary,
    details: vuln.details.slice(0, 1800),
    dependencyPath: exposure?.dependencyPath ?? [],
    applicationName: exposure?.applicationName ?? 'Unknown',
  };

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Provide a concise technical briefing on this deterministic vulnerability match:\n\n${JSON.stringify(evidence, null, 2)}\n\nCover: (1) Technical Mechanism, (2) Deterministic Match Assessment & Blast Radius in the dependency path, (3) Concrete Remediation Verification Steps.`,
    config: {
      systemInstruction: EVIDENCE_SYSTEM_INSTRUCTION,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  return response.text?.trim() || 'No explanation generated.';
}

export async function summarizeIncidentWithAi(
  incident: Incident,
  linkedVulns: VulnerabilityMatch[]
): Promise<string> {
  const ai = getClient();
  const payload = {
    dataOrigin: incident.dataOrigin,
    incidentId: incident.id,
    title: incident.title,
    severity: incident.severity,
    status: incident.status,
    owner: incident.ownerName,
    description: incident.description,
    notes: incident.notes,
    verificationEvidence: incident.verificationEvidence || 'Pending verification evidence',
    linkedAdvisories: linkedVulns.map((v) => ({
      osvId: v.osvId,
      cveIds: v.cveIds,
      component: `${v.componentName}@${v.componentVersion}`,
      severity: v.severity,
      fixedVersions: v.fixedVersions,
    })),
  };

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Summarize this security incident for an engineering & executive handoff based strictly on the recorded evidence:\n\n${JSON.stringify(payload, null, 2)}`,
    config: {
      systemInstruction: EVIDENCE_SYSTEM_INSTRUCTION,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  return response.text?.trim() || 'No incident summary generated.';
}

export async function explainRemediationWithAi(
  task: RemediationTask,
  vuln?: VulnerabilityMatch
): Promise<string> {
  const ai = getClient();
  const payload = {
    dataOrigin: task.dataOrigin,
    application: task.applicationName,
    component: `${task.componentName}@${task.componentVersion}`,
    advisoryId: task.advisoryId,
    severity: task.severity,
    status: task.status,
    dueDate: task.dueDate,
    recommendedAction: task.recommendedAction,
    fixedVersions: vuln?.fixedVersions ?? [],
    affectedRanges: vuln?.affectedRanges ?? [],
    resolutionEvidence: task.resolutionEvidence || 'None submitted yet',
  };

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Explain the exact remediation execution plan, potential upgrade compatibility checks, and verification evidence required to close this remediation task:\n\n${JSON.stringify(payload, null, 2)}`,
    config: {
      systemInstruction: EVIDENCE_SYSTEM_INSTRUCTION,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  return response.text?.trim() || 'No remediation guidance generated.';
}

export async function generateManagementReportNarrative(
  orgName: string,
  isDemo: boolean,
  metrics: DashboardMetrics,
  topExposures: ExposureFinding[],
  incidents: Incident[]
): Promise<string> {
  const ai = getClient();
  const payload = {
    organization: orgName,
    environmentClassification: isDemo ? 'DEMO_DATA (Simulated Demonstration Workspace)' : 'LIVE_VERIFIED',
    metrics,
    topExposures: topExposures.slice(0, 8).map((e) => ({
      application: e.applicationName,
      component: `${e.componentName}@${e.componentVersion}`,
      advisoryId: e.advisoryId,
      severity: e.severity,
      cvssScore: e.cvssScore,
      matchConfidence: e.matchConfidence,
      fixAvailable: e.fixAvailable,
      fixedVersion: e.fixedVersion,
      investigationStatus: e.investigationStatus,
    })),
    incidentsSummary: incidents.slice(0, 6).map((i) => ({
      title: i.title,
      severity: i.severity,
      status: i.status,
      hasEvidence: Boolean(i.verificationEvidence),
    })),
  };

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `Draft a board-ready executive security posture brief (3 concise sections: Executive Summary, Priority Supply-Chain Exposure, Remediation & Governance Status) strictly from these verified metrics:\n\n${JSON.stringify(payload, null, 2)}`,
    config: {
      systemInstruction: EVIDENCE_SYSTEM_INSTRUCTION,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  return response.text?.trim() || 'No executive narrative generated.';
}

export async function answerInventoryQuestionWithAi(
  question: string,
  orgName: string,
  isDemo: boolean,
  components: ComponentRecord[],
  vulnerabilities: VulnerabilityMatch[],
  exposures: ExposureFinding[],
  incidents: Incident[]
): Promise<string> {
  const ai = getClient();
  const context = {
    organization: orgName,
    dataOrigin: isDemo ? 'DEMO_DATA' : 'LIVE_VERIFIED',
    totalComponents: components.length,
    components: components.slice(0, 60).map((c) => ({
      name: c.name,
      version: c.version,
      ecosystem: c.ecosystem,
      license: c.license,
      depth: c.dependencyDepth,
      supplier: c.supplier,
    })),
    vulnerabilities: vulnerabilities.slice(0, 40).map((v) => ({
      osvId: v.osvId,
      cveIds: v.cveIds,
      component: `${v.componentName}@${v.componentVersion}`,
      severity: v.severity,
      cvssScore: v.cvssScore,
      confidence: v.matchConfidence,
      fixedVersions: v.fixedVersions,
    })),
    exposures: exposures.slice(0, 30).map((e) => ({
      app: e.applicationName,
      component: `${e.componentName}@${e.componentVersion}`,
      advisory: e.advisoryId,
      severity: e.severity,
      path: e.dependencyPath.join(' -> '),
      status: e.investigationStatus,
    })),
    incidents: incidents.slice(0, 15).map((i) => ({
      title: i.title,
      status: i.status,
      severity: i.severity,
      owner: i.ownerName,
    })),
  };

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: `User Question: ${question}\n\nRetrieved Organization Inventory & Intelligence Context:\n${JSON.stringify(context, null, 2)}`,
    config: {
      systemInstruction: EVIDENCE_SYSTEM_INSTRUCTION,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  return response.text?.trim() || 'Unable to answer based on current inventory context.';
}
