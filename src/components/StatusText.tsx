import React from 'react';
import type { MatchConfidence, SeverityLevel } from '../types/vytron.ts';

export const SeverityLabel: React.FC<{ severity: SeverityLevel }> = ({ severity }) => {
  const styles: Record<SeverityLevel, { bar: string; text: string }> = {
    Critical: { bar: 'bg-[#DC2626]', text: 'text-[#F87171]' },
    High: { bar: 'bg-[#EA580C]', text: 'text-[#FB923C]' },
    Medium: { bar: 'bg-[#D97706]', text: 'text-[#FBBF24]' },
    Low: { bar: 'bg-[#16A34A]', text: 'text-[#4ADE80]' },
    Unknown: { bar: 'bg-[#6B7484]', text: 'text-[#A1AAB8]' },
  };
  const s = styles[severity] ?? styles.Unknown;
  return (
    <span className={`inline-flex items-center gap-2 text-xs font-medium whitespace-nowrap ${s.text}`}>
      <span className={`w-1.5 h-3.5 rounded-[1px] ${s.bar}`} aria-hidden="true" />
      <span>{severity}</span>
    </span>
  );
};

export const ConfidenceLabel: React.FC<{ confidence: MatchConfidence }> = ({ confidence }) => {
  const map: Record<MatchConfidence, { label: string; color: string }> = {
    confirmed_match: { label: 'Confirmed Match', color: 'text-[#F87171]' },
    potentially_affected: { label: 'Potentially Affected', color: 'text-[#FBBF24]' },
    unverified: { label: 'Unverified', color: 'text-[#A1AAB8]' },
    no_known_vulnerability: { label: 'No Known Vuln', color: 'text-[#4ADE80]' },
  };
  const info = map[confidence] ?? map.unverified;
  return (
    <span className={`text-xs font-mono whitespace-nowrap ${info.color}`}>{info.label}</span>
  );
};
