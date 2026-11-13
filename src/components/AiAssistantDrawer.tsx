import React, { useState } from 'react';
import { X, Send, Loader2, Bot } from 'lucide-react';
import { vytronApi } from '../lib/api.ts';

interface AiAssistantDrawerProps {
  open: boolean;
  onClose: () => void;
  orgName: string;
  isDemo: boolean;
}

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const SUGGESTED_PROMPTS = [
  'Which components currently have Critical exposure with no upstream fix?',
  'Summarize our open security incidents and pending verification evidence.',
  'List all outdated packages and their exact fixed versions.',
];

export const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({
  open,
  onClose,
  orgName,
  isDemo,
}) => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);

  if (!open) return null;

  const submitQuestion = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setError(null);
    setTurns((prev) => [...prev, { id: `u_${Date.now()}`, role: 'user', text: trimmed }]);
    setQuestion('');
    setLoading(true);
    try {
      const res = await vytronApi.askInventory(trimmed);
      setTurns((prev) => [
        ...prev,
        { id: `a_${Date.now()}`, role: 'assistant', text: res.answer },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inventory analysis failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60">
      <div className="w-full max-w-md bg-[#0F1115] border-l border-[#222732] h-full flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#222732]">
          <div className="flex items-center gap-2.5">
            <Bot className="w-4 h-4 text-[#3B82F6]" />
            <div>
              <h3 className="text-sm font-semibold text-white">Inventory Evidence Analyst</h3>
              <p className="text-xs text-[#6B7484]">
                {orgName} {isDemo ? '· DEMO DATA' : '· LIVE VERIFIED'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-[#A1AAB8] hover:text-white"
            aria-label="Close analyst drawer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="p-3 bg-[#08090B] border border-[#222732] rounded text-xs text-[#A1AAB8] leading-relaxed">
            Grounded strictly in your organization’s deterministic SBOM inventory, OSV/NVD matches, and incident records. Vulnerability status is never inferred by AI.
          </div>

          {turns.length === 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-[#6B7484]">Suggested queries</div>
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => submitQuestion(p)}
                  className="w-full text-left p-3 text-xs text-[#E2E8F0] bg-[#161920] hover:bg-[#1C2029] border border-[#222732] rounded transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {turns.map((turn) => (
            <div
              key={turn.id}
              className={`p-3.5 rounded text-xs leading-relaxed whitespace-pre-wrap ${
                turn.role === 'user'
                  ? 'bg-[#2563EB]/15 border border-[#2563EB]/30 text-white ml-6'
                  : 'bg-[#161920] border border-[#222732] text-[#E2E8F0] mr-4'
              }`}
            >
              {turn.text}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-[#A1AAB8]">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#3B82F6]" />
              <span>Analyzing retrieved inventory evidence...</span>
            </div>
          )}

          {error && (
            <div className="p-3 text-xs text-[#F87171] bg-[#DC2626]/10 border border-[#DC2626]/30 rounded">
              {error}
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitQuestion(question);
          }}
          className="p-4 border-t border-[#222732] flex items-center gap-2"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about packages, CVEs, or incidents..."
            className="flex-1 px-3 py-2 text-xs bg-[#08090B] border border-[#222732] rounded text-white placeholder:text-[#6B7484] focus:outline-none focus:border-[#3B82F6]"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="p-2 bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded disabled:opacity-40"
            aria-label="Send query"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
