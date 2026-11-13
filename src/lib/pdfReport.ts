import { jsPDF } from 'jspdf';
import type { WorkspaceSnapshot } from './api.ts';

export function generateSecurityPdfReport(
  snapshot: WorkspaceSnapshot,
  aiNarrative?: string
): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 44;
  const maxWidth = pageWidth - margin * 2;
  let y = 48;

  const isDemo = snapshot.organization.isDemo;
  const generatedAt = new Date().toISOString();

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 54) {
      doc.addPage();
      y = 48;
      if (isDemo) {
        doc.setFontSize(8);
        doc.setTextColor(180, 83, 9);
        doc.text('DEMO DATA — SIMULATED ENVIRONMENT RECORD', margin, 26);
      }
    }
  };

  // Header Banner
  doc.setFillColor(12, 14, 18);
  doc.rect(0, 0, pageWidth, 88, 'F');
  doc.setTextColor(244, 246, 250);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('VYTRON', margin, 36);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(161, 170, 184);
  doc.text('Software Supply-Chain Security & Exposure Report', margin, 54);
  doc.text(`Generated: ${generatedAt}`, margin, 70);

  if (isDemo) {
    doc.setFillColor(180, 83, 9);
    doc.rect(pageWidth - margin - 138, 24, 138, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('DEMO DATA ONLY', pageWidth - margin - 122, 39);
  } else {
    doc.setFillColor(22, 163, 74);
    doc.rect(pageWidth - margin - 138, 24, 138, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('LIVE VERIFIED DATA', pageWidth - margin - 124, 39);
  }

  y = 114;

  // Organization & Data Classification
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`Workspace: ${snapshot.organization.name}`, margin, y);
  y += 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Classification: ${
      isDemo
        ? 'SIMULATED DEMONSTRATION WORKSPACE (Not live production telemetry)'
        : 'VERIFIED PRODUCTION INVENTORY (OSV.dev / NIST NVD deterministic analysis)'
    }`,
    margin,
    y
  );
  y += 24;

  // Executive Metrics Row
  const m = snapshot.metrics;
  const kpis = [
    ['SBOMs Ingested', String(m.sbomCount)],
    ['Total Components', String(m.totalComponents)],
    ['Known Vulns', String(m.totalKnownVulnerabilities)],
    ['Critical / High', `${m.criticalFindings} / ${m.highFindings}`],
    ['Active Incidents', String(m.activeIncidents)],
    ['Remediation %', `${m.remediationCompletionPct}%`],
  ];

  const colW = maxWidth / 3;
  for (let i = 0; i < kpis.length; i++) {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const x = margin + col * colW;
    const boxY = y + row * 42;
    doc.setDrawColor(226, 232, 240);
    doc.rect(x, boxY, colW - 8, 34);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(kpis[i][0], x + 8, boxY + 13);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(kpis[i][1], x + 8, boxY + 28);
  }
  y += 98;

  // Optional AI Management Narrative
  if (aiNarrative && aiNarrative.trim()) {
    ensureSpace(80);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Executive Summary (Evidence-Grounded Narrative)', margin, y);
    y += 16;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(51, 65, 85);
    const wrapped = doc.splitTextToSize(aiNarrative.replace(/[#*]/g, ''), maxWidth);
    for (const line of wrapped) {
      ensureSpace(14);
      doc.text(line, margin, y);
      y += 13;
    }
    y += 14;
  }

  // Exposure & Vulnerability Findings
  ensureSpace(60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`Prioritized Exposure Findings (${snapshot.exposures.length})`, margin, y);
  y += 16;

  if (snapshot.exposures.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text('No vulnerability exposures recorded in this workspace.', margin, y);
    y += 20;
  } else {
    for (const exp of snapshot.exposures.slice(0, 25)) {
      ensureSpace(46);
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y, pageWidth - margin, y);
      y += 13;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(
        `[${exp.severity.toUpperCase()}] ${exp.advisoryId} — ${exp.componentName}@${exp.componentVersion} (${exp.applicationName})`,
        margin,
        y
      );
      y += 12;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Origin: ${exp.dataOrigin} | Match: ${exp.matchConfidence} | Fix: ${
          exp.fixedVersion ?? 'No upstream fix'
        } | Status: ${exp.investigationStatus}`,
        margin,
        y
      );
      y += 12;
      const actionLines = doc.splitTextToSize(`Action: ${exp.recommendedAction}`, maxWidth);
      doc.text(actionLines[0], margin, y);
      y += 14;
    }
  }

  // Incidents & Evidence
  ensureSpace(60);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`Security Incidents & Verification Records (${snapshot.incidents.length})`, margin, y);
  y += 16;

  if (snapshot.incidents.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text('No security incidents recorded.', margin, y);
    y += 20;
  } else {
    for (const inc of snapshot.incidents.slice(0, 15)) {
      ensureSpace(44);
      doc.setDrawColor(226, 232, 240);
      doc.line(margin, y, pageWidth - margin, y);
      y += 13;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text(`[${inc.severity}] ${inc.title} (${inc.status})`, margin, y);
      y += 12;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      doc.text(
        `Owner: ${inc.ownerName} | Origin: ${inc.dataOrigin} | Evidence: ${
          inc.verificationEvidence || 'Pending verification'
        }`,
        margin,
        y
      );
      y += 16;
    }
  }

  // Remediation Summary
  ensureSpace(60);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(`Remediation Tasks (${snapshot.remediations.length})`, margin, y);
  y += 16;

  for (const rem of snapshot.remediations.slice(0, 20)) {
    ensureSpace(36);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(30, 41, 59);
    doc.text(
      `• [${rem.status}] ${rem.componentName}@${rem.componentVersion} (${rem.advisoryId}) — Owner: ${rem.responsibleOwner} | Due: ${rem.dueDate}`,
      margin,
      y
    );
    y += 13;
    if (rem.resolutionEvidence) {
      doc.setTextColor(22, 101, 52);
      doc.text(`  Evidence: ${rem.resolutionEvidence.slice(0, 110)}`, margin, y);
      y += 13;
    }
  }

  doc.save(`vytron-security-report-${snapshot.organization.slug}.pdf`);
}
