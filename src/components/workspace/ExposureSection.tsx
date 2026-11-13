import React, { useMemo, useState } from 'react';
import { AlertTriangle, Wrench, ShieldPlus } from 'lucide-react';
import { vytronApi, type WorkspaceSnapshot } from '../../lib/api.ts';
import type { ExposureFinding, InvestigationStatus } from '../../types/vytron.ts';
import { ConfidenceLabel, SeverityLabel } from '../StatusText.tsx';

interface ExposureSectionProps {
  snapshot: WorkspaceSnapshot;
  canWrite: boolean;
  onRefresh: () => Promise<void>;
  onNavigateSection: (sec: 'incidents' | 'remediation') => void;
}

const INVESTIGATION_STATUSES: InvestigationStatus[] = [
  'New',
  'Triaged',
  'Confirmed',
  'False Positive',
  'Accepted Risk',
];

export const ExposureSection: React.FC<ExposureSectionProps> = ({
  snapshot,
  canWrite,
  onRefresh,
  onNavigateSection,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'crit_high' | 'outdated' | 'no_fix'>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return snapshot.exposures.filter((e) => {
      if (filterMode === 'crit_high') return e.severity === 'Critical' || e.severity === 'High';
      if (filterMode === 'outdated') return e.isOutdated;
      if (filterMode === 'no_fix') return !e.fixAvailable;
      return true;
    });
  }, [snapshot.exposures, filterMode]);

  const handleStatusChange = async (exp: ExposureFinding, status: string) => {
    setError(null);
    setBusyId(exp.id);
    try {
      await vytronApi.updateExposureStatus(exp.id, status);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update status.');
    } finally {
      setBusyId(null);
    }
  };

  const handleEscalateIncident = async (exp: ExposureFinding) => {
    setError(null);
    setNotice(null);
    setBusyId(exp.id);
    try {
      await vytronApi.createIncident({
        title: `${exp.advisoryId} Exposure in ${exp.applicationName} (${exp.componentName}@${exp.componentVersion})`,
        description: `Escalated from Exposure Analysis. Path: ${exp.dependencyPath.join(
          ' -> '
        )}. Recommended action: ${exp.recommendedAction}`,
        severity: exp.severity,
        linkedVulnerabilityIds: [exp.vulnerabilityId],
        linkedComponentIds: [exp.componentId],
        linkedAdvisoryIds: [exp.advisoryId],
      });
      await onRefresh();
      setNotice(`Incident created for ${exp.advisoryId}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create incident.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateRemediation = async (exp: ExposureFinding) => {
    setError(null);
    setNotice(null);
    setBusyId(exp.id);
    try {
      await vytronApi.createRemediation({
        exposureId: exp.id,
        advisoryId: exp.advisoryId,
        componentId: exp.componentId,
        componentName: exp.componentName,
        componentVersion: exp.componentVersion,
        applicationName: exp.applicationName,
        severity: exp.severity,
        recommendedAction: exp.recommendedAction,
      });
      await onRefresh();
      setNotice(`Remediation task created for ${exp.componentName}@${exp.componentVersion}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create remediation task.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Segmented Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-[#0F1115] border border-[#222732] rounded-md">
          {(
            [
              ['all', `All Findings (${snapshot.exposures.length})`],
              [
                'crit_high',
                `Critical & High (${
                  snapshot.exposures.filter(
                    (e) => e.severity === 'Critical' || e.severity === 'High'
                  ).length
                })`,
              ],
              [
                'outdated',
                `Outdated Dependencies (${snapshot.exposures.filter((e) => e.isOutdated).length})`,
              ],
              [
                'no_fix',
                `No Known Fix (${snapshot.exposures.filter((e) => !e.fixAvailable).length})`,
              ],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilterMode(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                filterMode === key ? 'bg-[#161920] text-white' : 'text-[#A1AAB8] hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => onNavigateSection('incidents')}
            className="text-[#3B82F6] hover:underline"
          >
            Incidents Workspace →
          </button>
          <button
            type="button"
            onClick={() => onNavigateSection('remediation')}
            className="text-[#3B82F6] hover:underline"
          >
            Remediation Queue →
          </button>
        </div>
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

      {/* Exposure Table */}
      <div className="bg-[#0F1115] border border-[#222732] rounded-lg overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-xs text-[#A1AAB8]">
            No exposure findings match the selected filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#222732] text-xs text-[#6B7484]">
                  <th className="py-3 px-4 font-medium">Priority</th>
                  <th className="py-3 px-4 font-medium">Application & Dependency Path</th>
                  <th className="py-3 px-4 font-medium">Advisory & Match</th>
                  <th className="py-3 px-4 font-medium">Recommended Remediation</th>
                  <th className="py-3 px-4 font-medium">Triage Status</th>
                  <th className="py-3 px-4 font-medium text-right">Coordinate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#222732] text-xs">
                {filtered.map((exp) => (
                  <tr key={exp.id} className="hover:bg-[#161920]/60 align-top">
                    <td className="py-3 px-4 whitespace-nowrap space-y-1">
                      <div className="font-mono font-semibold text-white tabular-nums">
                        Score {exp.priorityScore}/100
                      </div>
                      <SeverityLabel severity={exp.severity} />
                    </td>
                    <td className="py-3 px-4 space-y-1">
                      <div className="font-medium text-white">{exp.applicationName}</div>
                      <div className="font-mono text-[11px] text-[#A1AAB8] max-w-xs break-words">
                        {exp.dependencyPath.join(' → ')}
                      </div>
                      <div className="text-[11px] text-[#6B7484]">
                        {exp.isDirectDependency ? 'Direct dependency' : 'Transitive dependency'} ·{' '}
                        {exp.isOutdated ? 'Outdated' : 'No upstream patch'}
                      </div>
                    </td>
                    <td className="py-3 px-4 space-y-1 whitespace-nowrap">
                      <div className="font-mono text-white">{exp.advisoryId}</div>
                      <ConfidenceLabel confidence={exp.matchConfidence} />
                    </td>
                    <td className="py-3 px-4 max-w-xs space-y-1">
                      <div className="text-[#E2E8F0] leading-relaxed">{exp.recommendedAction}</div>
                      {!exp.fixAvailable && (
                        <div className="inline-flex items-center gap-1 text-[11px] text-[#FBBF24]">
                          <AlertTriangle className="w-3 h-3" />
                          <span>No upstream fix available</span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <select
                        disabled={!canWrite || busyId === exp.id}
                        value={exp.investigationStatus}
                        onChange={(e) => handleStatusChange(exp, e.target.value)}
                        className="px-2.5 py-1.5 text-xs bg-[#08090B] border border-[#222732] rounded text-white disabled:opacity-60"
                      >
                        {INVESTIGATION_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                      {canWrite && (
                        <>
                          <button
                            type="button"
                            disabled={busyId === exp.id}
                            onClick={() => handleEscalateIncident(exp)}
                            title="Escalate to Security Incident"
                            className="px-2.5 py-1.5 bg-[#161920] hover:bg-[#1E232E] border border-[#222732] rounded text-white inline-flex items-center gap-1"
                          >
                            <ShieldPlus className="w-3 h-3 text-[#F87171]" />
                            <span>Incident</span>
                          </button>
                          <button
                            type="button"
                            disabled={busyId === exp.id}
                            onClick={() => handleCreateRemediation(exp)}
                            title="Create Remediation Task"
                            className="px-2.5 py-1.5 bg-[#161920] hover:bg-[#1E232E] border border-[#222732] rounded text-white inline-flex items-center gap-1"
                          >
                            <Wrench className="w-3 h-3 text-[#3B82F6]" />
                            <span>Remediate</span>
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
