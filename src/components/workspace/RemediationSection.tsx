import React, { useState } from 'react';
import { Sparkles, Loader2, X, CheckSquare } from 'lucide-react';
import { vytronApi, type WorkspaceSnapshot } from '../../lib/api.ts';
import type { RemediationStatus, RemediationTask } from '../../types/vytron.ts';
import { SeverityLabel } from '../StatusText.tsx';

interface RemediationSectionProps {
  snapshot: WorkspaceSnapshot;
  canCoordinate: boolean;
  onRefresh: () => Promise<void>;
}

const REM_STATUSES: RemediationStatus[] = [
  'Pending',
  'In Progress',
  'Blocked',
  'Awaiting Verification',
  'Completed',
];

export const RemediationSection: React.FC<RemediationSectionProps> = ({
  snapshot,
  canCoordinate,
  onRefresh,
}) => {
  const [editingTask, setEditingTask] = useState<RemediationTask | null>(null);
  const [status, setStatus] = useState<RemediationStatus>('In Progress');
  const [owner, setOwner] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [evidence, setEvidence] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // AI guidance modal
  const [aiTask, setAiTask] = useState<RemediationTask | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGuidance, setAiGuidance] = useState<string | null>(null);

  const openEditor = (task: RemediationTask) => {
    setEditingTask(task);
    setStatus(task.status);
    setOwner(task.responsibleOwner);
    setDueDate(task.dueDate);
    setEvidence(task.resolutionEvidence);
    setError(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      await vytronApi.updateRemediation(editingTask.id, {
        status,
        responsibleOwner: owner,
        dueDate,
        resolutionEvidence: evidence,
      });
      await onRefresh();
      setNotice(`Remediation task for ${editingTask.componentName} updated to ${status}.`);
      setEditingTask(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update remediation.');
    } finally {
      setSaving(false);
    }
  };

  const handleExplainRemediation = async (task: RemediationTask) => {
    setAiTask(task);
    setAiGuidance(null);
    setError(null);
    setAiLoading(true);
    try {
      const res = await vytronApi.explainRemediation(task.id);
      setAiGuidance(res.guidance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI remediation guidance failed.');
      setAiTask(null);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0F1115] border border-[#222732] rounded-lg px-5 py-3.5 text-xs">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-[#6B7484]">Total Tasks:</span>{' '}
            <span className="font-mono text-white">{snapshot.metrics.remediationTotal}</span>
          </div>
          <div>
            <span className="text-[#6B7484]">Completed:</span>{' '}
            <span className="font-mono text-[#4ADE80]">{snapshot.metrics.remediationCompleted}</span>
          </div>
          <div>
            <span className="text-[#6B7484]">Completion Rate:</span>{' '}
            <span className="font-mono text-white">{snapshot.metrics.remediationCompletionPct}%</span>
          </div>
        </div>
        <span className="text-[#6B7484]">
          Completed status requires resolution evidence (PR / SBOM digest)
        </span>
      </div>

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

      <div className="bg-[#0F1115] border border-[#222732] rounded-lg overflow-hidden">
        {snapshot.remediations.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <CheckSquare className="w-6 h-6 text-[#6B7484] mx-auto" />
            <div className="text-sm font-medium text-white">No Remediation Tasks Queued</div>
            <p className="text-xs text-[#A1AAB8]">
              Create remediation tasks directly from Exposure Analysis findings.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#222732] text-xs text-[#6B7484]">
                  <th className="py-3 px-4 font-medium">Vulnerability & Component</th>
                  <th className="py-3 px-4 font-medium">Severity</th>
                  <th className="py-3 px-4 font-medium">Recommended Action</th>
                  <th className="py-3 px-4 font-medium">Owner & Due Date</th>
                  <th className="py-3 px-4 font-medium">Status & Evidence</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222732] text-xs">
                {snapshot.remediations.map((task) => (
                  <tr key={task.id} className="hover:bg-[#161920]/60 align-top">
                    <td className="py-3 px-4 space-y-1">
                      <div className="font-mono font-semibold text-white">{task.advisoryId}</div>
                      <div className="font-mono text-[#A1AAB8]">
                        {task.componentName}@{task.componentVersion}
                      </div>
                      <div className="text-[11px] text-[#6B7484]">{task.applicationName}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <SeverityLabel severity={task.severity} />
                    </td>
                    <td className="py-3 px-4 max-w-xs text-[#E2E8F0] leading-relaxed">
                      {task.recommendedAction}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap space-y-1">
                      <div className="text-white">{task.responsibleOwner}</div>
                      <div className="font-mono text-[#6B7484]">Due {task.dueDate}</div>
                    </td>
                    <td className="py-3 px-4 space-y-1 max-w-xs">
                      <div
                        className={`font-mono font-medium ${
                          task.status === 'Completed'
                            ? 'text-[#4ADE80]'
                            : task.status === 'Blocked'
                            ? 'text-[#F87171]'
                            : 'text-[#FBBF24]'
                        }`}
                      >
                        {task.status}
                      </div>
                      {task.resolutionEvidence && (
                        <div className="text-[11px] text-[#A1AAB8] break-words">
                          Evidence: {task.resolutionEvidence}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                      <button
                        type="button"
                        onClick={() => handleExplainRemediation(task)}
                        className="px-2.5 py-1.5 bg-[#161920] hover:bg-[#1E232E] border border-[#222732] rounded text-white inline-flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3 text-[#3B82F6]" />
                        <span>Plan</span>
                      </button>
                      {canCoordinate && (
                        <button
                          type="button"
                          onClick={() => openEditor(task)}
                          className="px-2.5 py-1.5 bg-[#2563EB] hover:bg-[#1D4ED8] rounded text-white"
                        >
                          Update
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-lg bg-[#0F1115] border border-[#222732] rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-[#222732] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Update Remediation: {editingTask.componentName}
              </h3>
              <button
                type="button"
                onClick={() => setEditingTask(null)}
                className="p-1 text-[#A1AAB8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
              {error && (
                <div className="p-2.5 text-[#F87171] bg-[#DC2626]/10 border border-[#DC2626]/30 rounded">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#A1AAB8] mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as RemediationStatus)}
                    className="w-full px-3 py-2 bg-[#08090B] border border-[#222732] rounded text-white"
                  >
                    {REM_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[#A1AAB8] mb-1">Due Date</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#08090B] border border-[#222732] rounded text-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[#A1AAB8] mb-1">Responsible Owner</label>
                <input
                  type="text"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  className="w-full px-3 py-2 bg-[#08090B] border border-[#222732] rounded text-white"
                />
              </div>
              <div>
                <label className="block text-[#A1AAB8] mb-1">
                  Resolution Evidence (Required when Completed)
                </label>
                <textarea
                  rows={3}
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  placeholder="PR URL, lockfile SHA, or post-patch SBOM verification run ID"
                  className="w-full px-3 py-2 bg-[#08090B] border border-[#222732] rounded text-white"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTask(null)}
                  className="px-3.5 py-2 bg-[#161920] border border-[#222732] rounded text-[#A1AAB8]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded inline-flex items-center gap-2"
                >
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Progress</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Remediation Plan Modal */}
      {aiTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-xl bg-[#0F1115] border border-[#222732] rounded-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-[#222732] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">
                Remediation Guidance: {aiTask.advisoryId} ({aiTask.componentName})
              </h3>
              <button
                type="button"
                onClick={() => setAiTask(null)}
                className="p-1 text-[#A1AAB8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 max-h-[65vh] overflow-y-auto text-xs text-[#E2E8F0] leading-relaxed whitespace-pre-wrap">
              {aiLoading ? (
                <div className="flex items-center gap-2 justify-center py-8 text-[#A1AAB8]">
                  <Loader2 className="w-4 h-4 animate-spin text-[#3B82F6]" />
                  <span>Drafting evidence-based remediation steps...</span>
                </div>
              ) : (
                aiGuidance
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
