import React, { useEffect, useState } from 'react';
import { Plus, Sparkles, Loader2, CheckCircle2, MessageSquarePlus, Wrench } from 'lucide-react';
import { vytronApi, type WorkspaceSnapshot } from '../../lib/api.ts';
import type { Incident, IncidentStatus, SeverityLevel } from '../../types/vytron.ts';
import { SeverityLabel } from '../StatusText.tsx';

interface IncidentsSectionProps {
  snapshot: WorkspaceSnapshot;
  canWrite: boolean;
  canCoordinate: boolean;
  onRefresh: () => Promise<void>;
}

const INCIDENT_STATUSES: IncidentStatus[] = [
  'Open',
  'Investigating',
  'Remediation in progress',
  'Awaiting verification',
  'Resolved',
];

export const IncidentsSection: React.FC<IncidentsSectionProps> = ({
  snapshot,
  canWrite,
  canCoordinate,
  onRefresh,
}) => {
  const [selectedId, setSelectedId] = useState<string>(snapshot.incidents[0]?.id ?? '');
  const [showCreate, setShowCreate] = useState(false);

  // Create form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<SeverityLevel>('High');
  const [ownerName, setOwnerName] = useState(snapshot.members[0]?.fullName ?? '');
  const [linkedVulnId, setLinkedVulnId] = useState('');

  // Edit / Notes state
  const [noteInput, setNoteInput] = useState('');
  const [evidenceInput, setEvidenceInput] = useState('');
  const [nextStatus, setNextStatus] = useState<IncidentStatus>('Open');
  const [editOwner, setEditOwner] = useState('');
  const [editSeverity, setEditSeverity] = useState<SeverityLevel>('High');

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // AI Summary state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  const selected: Incident | null =
    snapshot.incidents.find((i) => i.id === selectedId) ?? snapshot.incidents[0] ?? null;

  // Keep form fields synchronized whenever the active incident changes
  useEffect(() => {
    if (selected) {
      setNextStatus(selected.status);
      setEvidenceInput(selected.verificationEvidence || '');
      setEditOwner(selected.ownerName || '');
      setEditSeverity(selected.severity);
    }
  }, [selected?.id, selected?.status, selected?.verificationEvidence, selected?.ownerName, selected?.severity]);

  const handleSelectIncident = (inc: Incident) => {
    setSelectedId(inc.id);
    setEvidenceInput(inc.verificationEvidence);
    setNextStatus(inc.status);
    setEditOwner(inc.ownerName);
    setEditSeverity(inc.severity);
    setAiSummary(null);
    setError(null);
    setNotice(null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const linkedVuln = snapshot.vulnerabilities.find((v) => v.id === linkedVulnId);
      const res = await vytronApi.createIncident({
        title,
        description,
        severity,
        ownerName,
        linkedVulnerabilityIds: linkedVuln ? [linkedVuln.id] : [],
        linkedComponentIds: linkedVuln ? [linkedVuln.componentId] : [],
        linkedAdvisoryIds: linkedVuln
          ? [linkedVuln.cveIds[0] ?? linkedVuln.osvId]
          : [],
      });
      await onRefresh();
      setSelectedId(res.incident.id);
      setNextStatus(res.incident.status);
      setEvidenceInput('');
      setTitle('');
      setDescription('');
      setShowCreate(false);
      setNotice('Security incident opened and recorded in audit log.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create incident.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpdateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await vytronApi.updateIncident(selected.id, {
        status: nextStatus,
        ownerName: editOwner,
        severity: editSeverity,
        verificationEvidence: evidenceInput,
      });
      await onRefresh();
      setNotice(`Incident updated (${nextStatus}).`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update incident.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !noteInput.trim()) return;
    setError(null);
    setBusy(true);
    try {
      await vytronApi.addIncidentNote(selected.id, noteInput);
      setNoteInput('');
      await onRefresh();
      setNotice('Investigation note appended.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to append note.');
    } finally {
      setBusy(false);
    }
  };

  const handleSpawnRemediation = async () => {
    if (!selected) return;
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      const linkedComp = snapshot.components.find((c) =>
        selected.linkedComponentIds.includes(c.id)
      );
      const linkedSbom = linkedComp
        ? snapshot.sboms.find((s) => s.id === linkedComp.sbomId)
        : undefined;
      await vytronApi.createRemediation({
        incidentId: selected.id,
        advisoryId: selected.linkedAdvisoryIds[0] ?? 'INCIDENT-TASK',
        componentId: linkedComp?.id ?? 'unspecified',
        componentName: linkedComp?.name ?? selected.title.slice(0, 40),
        componentVersion: linkedComp?.version ?? 'unspecified',
        applicationName: linkedSbom?.applicationName ?? snapshot.organization.name,
        severity: selected.severity,
        recommendedAction: `Remediate incident: ${selected.title}`,
        responsibleOwner: selected.ownerName,
      });
      await onRefresh();
      setNotice('Remediation task created and linked to this incident.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create remediation task.');
    } finally {
      setBusy(false);
    }
  };

  const handleAiSummarize = async () => {
    if (!selected) return;
    setAiLoading(true);
    setAiSummary(null);
    setError(null);
    try {
      const res = await vytronApi.summarizeIncident(selected.id);
      setAiSummary(res.summary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI summary failed.');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-[#A1AAB8]">
          Active: <span className="font-mono text-white tabular-nums">{snapshot.metrics.activeIncidents}</span> ·
          Resolved with Evidence:{' '}
          <span className="font-mono text-[#4ADE80] tabular-nums">{snapshot.metrics.resolvedIncidents}</span>
        </div>

        {canWrite && (
          <button
            type="button"
            onClick={() => setShowCreate((v) => !v)}
            className="px-4 py-2 text-xs font-medium bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showCreate ? 'Cancel' : 'New Security Incident'}</span>
          </button>
        )}
      </div>

      {/* Create Form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="bg-[#0F1115] border border-[#222732] rounded-lg p-5 space-y-4"
        >
          <h3 className="text-sm font-semibold text-white">Open Security Incident</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs text-[#A1AAB8] mb-1">Incident Title</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Critical Remote Code Execution in Settlement Gateway"
                className="w-full px-3 py-2 text-xs bg-[#08090B] border border-[#222732] rounded text-white focus:outline-none focus:border-[#3B82F6]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#A1AAB8] mb-1">Severity</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as SeverityLevel)}
                className="w-full px-3 py-2 text-xs bg-[#08090B] border border-[#222732] rounded text-white"
              >
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-[#A1AAB8] mb-1">Assigned Owner</label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Owner name"
                className="w-full px-3 py-2 text-xs bg-[#08090B] border border-[#222732] rounded text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-[#A1AAB8] mb-1">
                Link Vulnerability Match (Optional)
              </label>
              <select
                value={linkedVulnId}
                onChange={(e) => setLinkedVulnId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-[#08090B] border border-[#222732] rounded text-white"
              >
                <option value="">No linked advisory</option>
                {snapshot.vulnerabilities.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.cveIds[0] ?? v.osvId} — {v.componentName}@{v.componentVersion}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#A1AAB8] mb-1">Technical Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Affected systems, exposure path, and initial containment steps..."
              className="w-full px-3 py-2 text-xs bg-[#08090B] border border-[#222732] rounded text-white"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 text-xs font-medium bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded inline-flex items-center gap-2"
          >
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Create Incident</span>
          </button>
        </form>
      )}

      {error && (
        <div className="p-3 text-xs text-[#F87171] bg-[#DC2626]/10 border border-[#DC2626]/30 rounded">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3 text-xs text-[#4ADE80] bg-[#16A34A]/10 border border-[#16A34A]/30 rounded">
          {notice}
        </div>
      )}

      {/* Split View: Incident Queue + Detail Workspace */}
      {snapshot.incidents.length === 0 ? (
        <div className="bg-[#0F1115] border border-[#222732] rounded-lg p-12 text-center space-y-2">
          <CheckCircle2 className="w-6 h-6 text-[#6B7484] mx-auto" />
          <div className="text-sm font-medium text-white">No Security Incidents Recorded</div>
          <p className="text-xs text-[#A1AAB8]">
            Escalate findings from Exposure Analysis or open a manual incident above.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Queue */}
          <div className="lg:col-span-5 bg-[#0F1115] border border-[#222732] rounded-lg divide-y divide-[#222732] max-h-[700px] overflow-y-auto">
            {snapshot.incidents.map((inc) => {
              const active = selected?.id === inc.id;
              return (
                <button
                  key={inc.id}
                  type="button"
                  onClick={() => handleSelectIncident(inc)}
                  className={`w-full text-left p-4 transition-colors space-y-1.5 ${
                    active ? 'bg-[#161920]' : 'hover:bg-[#14171E]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <SeverityLabel severity={inc.severity} />
                    <span
                      className={`text-[11px] font-mono ${
                        inc.status === 'Resolved' ? 'text-[#4ADE80]' : 'text-[#A1AAB8]'
                      }`}
                    >
                      {inc.status}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-white leading-snug">{inc.title}</div>
                  <div className="text-[11px] text-[#6B7484]">
                    Owner: {inc.ownerName} · {inc.dataOrigin}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Right Detail */}
          {selected && (
            <div className="lg:col-span-7 bg-[#0F1115] border border-[#222732] rounded-lg p-6 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#222732] pb-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <SeverityLabel severity={selected.severity} />
                    <span className="font-mono text-[#6B7484]">{selected.id}</span>
                    <span className="font-mono text-[#A1AAB8]">{selected.dataOrigin}</span>
                    {selected.resolvedAt && (
                      <span className="font-mono text-[#4ADE80]">
                        Resolved {selected.resolvedAt.slice(0, 10)}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-semibold text-white">{selected.title}</h3>
                  <p className="text-xs text-[#A1AAB8] leading-relaxed">
                    {selected.description || 'No description provided.'}
                  </p>
                  {selected.linkedAdvisoryIds.length > 0 && (
                    <div className="text-[11px] font-mono text-[#3B82F6]">
                      Linked Advisories: {selected.linkedAdvisoryIds.join(' · ')}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {canWrite && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleSpawnRemediation}
                      className="px-3 py-1.5 text-xs font-medium bg-[#161920] hover:bg-[#1E232E] border border-[#222732] rounded text-white inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Wrench className="w-3.5 h-3.5 text-[#3B82F6]" />
                      <span>Create Task</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={aiLoading}
                    onClick={handleAiSummarize}
                    className="px-3 py-1.5 text-xs font-medium bg-[#161920] hover:bg-[#1E232E] border border-[#222732] rounded text-white inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    {aiLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3B82F6]" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-[#3B82F6]" />
                    )}
                    <span>Summarize</span>
                  </button>
                </div>
              </div>

              {aiSummary && (
                <div className="p-4 bg-[#08090B] border border-[#2563EB]/30 rounded text-xs text-[#E2E8F0] leading-relaxed whitespace-pre-wrap">
                  <div className="font-mono text-[#3B82F6] text-[11px] mb-2">
                    AI INCIDENT BRIEF (GROUNDED IN RECORDED EVIDENCE)
                  </div>
                  {aiSummary}
                </div>
              )}

              {/* Workflow & Evidence Update */}
              <form
                onSubmit={handleUpdateIncident}
                className="p-4 bg-[#08090B] border border-[#222732] rounded space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-[#A1AAB8] mb-1">Workflow Status</label>
                    <select
                      disabled={!canCoordinate || busy}
                      value={nextStatus}
                      onChange={(e) => setNextStatus(e.target.value as IncidentStatus)}
                      className="w-full px-3 py-2 text-xs bg-[#0F1115] border border-[#222732] rounded text-white"
                    >
                      {INCIDENT_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[#A1AAB8] mb-1">Severity</label>
                    <select
                      disabled={!canCoordinate || busy}
                      value={editSeverity}
                      onChange={(e) => setEditSeverity(e.target.value as SeverityLevel)}
                      className="w-full px-3 py-2 text-xs bg-[#0F1115] border border-[#222732] rounded text-white"
                    >
                      <option value="Critical">Critical</option>
                      <option value="High">High</option>
                      <option value="Medium">Medium</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-[#A1AAB8] mb-1">Owner</label>
                    <input
                      type="text"
                      disabled={!canCoordinate || busy}
                      value={editOwner}
                      onChange={(e) => setEditOwner(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[#0F1115] border border-[#222732] rounded text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#A1AAB8] mb-1">
                    Verification Evidence (Required for Resolved)
                  </label>
                  <input
                    type="text"
                    disabled={!canCoordinate || busy}
                    value={evidenceInput}
                    onChange={(e) => setEvidenceInput(e.target.value)}
                    placeholder="CI run ID, SBOM digest, or patch verification reference"
                    className="w-full px-3 py-2 text-xs bg-[#0F1115] border border-[#222732] rounded text-white"
                  />
                </div>
                {canCoordinate && (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-[#6B7484]">
                      Resolution timestamps are recorded automatically when status becomes Resolved.
                    </span>
                    <button
                      type="submit"
                      disabled={busy}
                      className="px-3.5 py-1.5 text-xs font-medium bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded whitespace-nowrap"
                    >
                      Update Incident
                    </button>
                  </div>
                )}
              </form>

              {/* Investigation Notes */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-white">
                  Investigation Notes ({selected.notes.length})
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {selected.notes.length === 0 ? (
                    <p className="text-xs text-[#6B7484]">No investigation notes added yet.</p>
                  ) : (
                    selected.notes.map((n) => (
                      <div
                        key={n.id}
                        className="p-3 bg-[#08090B] border border-[#222732] rounded text-xs"
                      >
                        <div className="flex justify-between text-[#6B7484] mb-1">
                          <span className="font-medium text-[#E2E8F0]">{n.authorName}</span>
                          <span className="font-mono">{n.createdAt.slice(0, 16).replace('T', ' ')}</span>
                        </div>
                        <p className="text-[#A1AAB8]">{n.content}</p>
                      </div>
                    ))
                  )}
                </div>

                {canCoordinate && (
                  <form onSubmit={handleAddNote} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={noteInput}
                      onChange={(e) => setNoteInput(e.target.value)}
                      placeholder="Append investigation finding or containment note..."
                      className="flex-1 px-3 py-2 text-xs bg-[#08090B] border border-[#222732] rounded text-white"
                    />
                    <button
                      type="submit"
                      disabled={busy || !noteInput.trim()}
                      className="px-3 py-2 text-xs font-medium bg-[#161920] hover:bg-[#1E232E] border border-[#222732] text-white rounded inline-flex items-center gap-1.5 disabled:opacity-40 whitespace-nowrap shrink-0"
                    >
                      <MessageSquarePlus className="w-3.5 h-3.5" />
                      <span>Add Note</span>
                    </button>
                  </form>
                )}
              </div>

              {/* Audit History */}
              <div className="border-t border-[#222732] pt-4 space-y-2">
                <div className="text-xs font-semibold text-white">Incident Audit History</div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto text-[11px] font-mono text-[#6B7484]">
                  {selected.auditHistory.map((h) => (
                    <div key={h.id} className="flex items-center justify-between gap-3">
                      <span className="text-[#A1AAB8]">
                        {h.actorName}: {h.action}
                      </span>
                      <span className="shrink-0">{h.timestamp.slice(0, 19).replace('T', ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
