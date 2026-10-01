import React, { useState } from 'react';
import { PROBLEMS } from '../data/problems';
import { 
  BookOpen, 
  ChevronDown, 
  Copy, 
  Check, 
  Tag, 
  AlertCircle,
  Code, 
  Users,
  Clock,
  RotateCcw,
  X,
  Sparkles,
  ArrowRight
} from 'lucide-react';

export default function ProblemSection({
  currentProblemId,
  onSelectProblem,
  isInterviewer,
  assignedProblemIds = [],
  candidatesList = [],
  onAssignProblemToCandidate,
  assignedMap = {},
  selectedCandidateId = '',
  onSelectCandidate
}) {
  const [copiedInputIndex, setCopiedInputIndex] = useState(null);
  const [modalCandidateId, setModalCandidateId] = useState(null); // When open, shows modal for this candidateId

  // Copy sample input helper
  const handleCopy = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedInputIndex(index);
    setTimeout(() => setCopiedInputIndex(null), 2000);
  };

  const getDifficultyColor = (diff) => {
    switch ((diff || '').toLowerCase()) {
      case 'easy':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'medium':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'hard':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  // Determine what problem to render for CANDIDATE:
  // Candidate sees strictly their assigned question(s)
  const candidateHasAssigned = Array.isArray(assignedProblemIds) && assignedProblemIds.length > 0;
  const candidateProblemId = candidateHasAssigned ? (currentProblemId || assignedProblemIds[0]) : null;

  // Determine what problem to render for INTERVIEWER:
  // Interviewer can browse any question in PROBLEMS or view observed candidate's question
  const activeProblemId = isInterviewer 
    ? (currentProblemId || PROBLEMS[0].id) 
    : candidateProblemId;

  const problem = activeProblemId ? PROBLEMS.find((p) => p.id === activeProblemId) : null;

  // Find who has this problem assigned (for interviewer info)
  const assignedCandidatesForThisProblem = Object.entries(assignedMap || {})
    .filter(([_, qIds]) => Array.isArray(qIds) && qIds.includes(problem?.id))
    .map(([cId]) => cId);

  // CANDIDATE VIEW WHEN NO QUESTION IS ASSIGNED YET:
  if (!isInterviewer && (!candidateHasAssigned || !problem)) {
    return (
      <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg p-5 justify-center items-center text-center">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
          <Clock className="w-6 h-6 animate-pulse" />
        </div>
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-semibold mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
          Question: Not Assigned
        </div>
        <h3 className="text-sm font-bold text-white mb-1.5">Waiting for Question Assignment</h3>
        <p className="text-xs text-slate-400 max-w-md leading-relaxed">
          The interviewer has not assigned a coding problem to you yet. Once assigned, your question description, input/output requirements, and constraints will appear here automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg relative">
      {/* Header bar */}
      <div className="p-2.5 border-b border-slate-800 bg-slate-900/95 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-400" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-white">
            {isInterviewer ? 'Question Repository' : 'Assigned Question'}
          </h2>
          {!isInterviewer && problem && (
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 font-mono">
              Assigned to you
            </span>
          )}
        </div>

        {/* Question Selector (INTERVIEWER ONLY - Candidates NEVER see question selection controls!) */}
        {isInterviewer && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 hidden sm:inline">Browse:</span>
            <div className="relative">
              <select
                value={problem?.id || PROBLEMS[0].id}
                onChange={(e) => onSelectProblem && onSelectProblem(e.target.value)}
                className="appearance-none bg-slate-950 border border-slate-700 text-xs font-medium text-slate-200 py-1 pl-2.5 pr-7 rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer shadow-sm max-w-[220px] truncate"
              >
                {PROBLEMS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.difficulty})
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        )}
      </div>

      {/* INTERVIEWER ONLY: Candidate Question Assignment Strip */}
      {isInterviewer && (
        <div className="border-b border-slate-800 bg-slate-950/80 px-3 py-2 shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              Candidate Question Status ({candidatesList.length})
            </span>
            <span className="text-[10px] text-slate-500">
              Select or change question per candidate
            </span>
          </div>

          {candidatesList.length === 0 ? (
            <div className="text-[11px] text-slate-500 italic py-1.5 text-center bg-slate-900/60 rounded-lg border border-slate-800/80">
              Waiting for candidate to join the interview room...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {candidatesList.map((cand) => {
                const cId = cand.candidateId || cand.userName;
                const assignedIds = assignedMap[cId] || [];
                const hasAssigned = assignedIds.length > 0;
                const assignedProb = hasAssigned ? PROBLEMS.find((p) => p.id === assignedIds[0]) : null;
                const isSelected = selectedCandidateId === cId;

                return (
                  <div
                    key={cId}
                    onClick={() => onSelectCandidate && onSelectCandidate(cId)}
                    className={`p-2 rounded-lg border transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-indigo-950/50 border-indigo-500 shadow-sm'
                        : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${cand.isDisqualified ? 'bg-rose-500' : 'bg-emerald-400'}`}></span>
                        {cId}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-semibold shrink-0 border ${
                        cand.isDisqualified 
                          ? 'text-rose-400 bg-rose-950/70 border-rose-800/80' 
                          : 'text-emerald-400 bg-emerald-950/70 border-emerald-800/80'
                      }`}>
                        {cand.isDisqualified ? 'DISQUALIFIED' : 'Active'}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 mb-1 flex items-center justify-between">
                      <span>Screen violations: <strong className={cand.violations > 0 ? (cand.isDisqualified ? 'text-rose-400' : 'text-amber-400') : 'text-slate-300'}>{cand.violations || 0}</strong></span>
                      <span>Status: <strong className={cand.isDisqualified ? 'text-rose-400' : 'text-emerald-400'}>{cand.isDisqualified ? 'DISQUALIFIED' : 'Active'}</strong></span>
                    </div>

                    <div className="text-[11px] mb-1.5 truncate">
                      <span className="text-slate-400">Question: </span>
                      {hasAssigned ? (
                        <span className="font-semibold text-indigo-300">
                          {assignedProb ? assignedProb.title.replace(/^\d+\.\s*/, '') : assignedIds[0]}
                        </span>
                      ) : (
                        <span className="text-amber-400 font-medium italic">
                          Not Assigned
                        </span>
                      )}
                    </div>

                    {cand.isDisqualified ? (
                      <div className="w-full py-1 px-2 rounded text-[11px] font-semibold text-center bg-rose-950/40 text-rose-400 border border-rose-800/50">
                        Disqualified
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setModalCandidateId(cId);
                        }}
                        className={`w-full py-1 px-2 rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition-all ${
                          hasAssigned
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm shadow-indigo-900/40'
                        }`}
                      >
                        {hasAssigned ? (
                          <>
                            <RotateCcw className="w-2.5 h-2.5 text-indigo-400" />
                            <span>Change Question</span>
                          </>
                        ) : (
                          <>
                            <BookOpen className="w-2.5 h-2.5 text-white" />
                            <span>Select Question</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Problem Content (Scrollable) */}
      {problem && (
        <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm text-slate-300 min-h-0">
          {/* Title, Badges & Assignment tags */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
              <h1 className="text-sm sm:text-base font-bold text-white">{problem.title}</h1>
              {isInterviewer && assignedCandidatesForThisProblem.length > 0 && (
                <span className="text-[10px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  Assigned to: {assignedCandidatesForThisProblem.join(', ')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${getDifficultyColor(problem.difficulty)}`}>
                {problem.difficulty}
              </span>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
                <Tag className="w-3 h-3 text-indigo-400" />
                {problem.category}
              </span>
            </div>
          </div>

          {/* Problem Description */}
          <div className="leading-relaxed text-xs text-slate-300 bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/80">
            <p>{problem.description}</p>
          </div>

          {/* Input & Output Format */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/80">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Input Format</h4>
              <p className="text-xs text-slate-300 leading-normal">{problem.inputFormat}</p>
            </div>
            <div className="bg-slate-950/50 p-2 rounded-lg border border-slate-800/80">
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-0.5">Output Format</h4>
              <p className="text-xs text-slate-300 leading-normal">{problem.outputFormat}</p>
            </div>
          </div>

          {/* Constraints */}
          {problem.constraints && problem.constraints.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-amber-400" />
                Constraints
              </h4>
              <ul className="list-disc list-inside space-y-0.5 text-xs text-slate-400 bg-slate-950/50 p-2 rounded-lg border border-slate-800/80 font-mono">
                {problem.constraints.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Sample Examples */}
          <div>
            <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1">
              <Code className="w-3 h-3 text-indigo-400" />
              Example 1
            </h4>
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-2">
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400 mb-0.5">
                  <span className="font-semibold text-slate-300">Input:</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(problem.sampleInput, 1)}
                    className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-indigo-400 transition-colors"
                  >
                    {copiedInputIndex === 1 ? (
                      <>
                        <Check className="w-3 h-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-slate-900 px-2 py-1 rounded font-mono text-xs text-emerald-400 overflow-x-auto">
                  {problem.sampleInput}
                </pre>
              </div>

              <div>
                <div className="text-xs text-slate-400 mb-0.5 font-semibold text-slate-300">
                  Output:
                </div>
                <pre className="bg-slate-900 px-2 py-1 rounded font-mono text-xs text-indigo-300 overflow-x-auto">
                  {problem.sampleOutput}
                </pre>
              </div>

              {problem.explanation && (
                <div className="text-xs text-slate-400 pt-1 border-t border-slate-800/60">
                  <span className="font-semibold text-slate-300">Explanation: </span>
                  {problem.explanation}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* QUESTION SELECTION MODAL (INTERVIEWER ONLY) */}
      {isInterviewer && modalCandidateId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  {assignedMap[modalCandidateId]?.length > 0 ? 'Change Question' : 'Select Question'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Assigning specifically to candidate: <span className="font-semibold text-indigo-300">{modalCandidateId}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalCandidateId(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Question List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {PROBLEMS.map((prob) => {
                const isCurrentlyAssigned = assignedMap[modalCandidateId]?.includes(prob.id);

                return (
                  <div
                    key={prob.id}
                    className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                      isCurrentlyAssigned
                        ? 'bg-indigo-950/50 border-indigo-500/80 shadow-md'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-white truncate">{prob.title}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full border ${getDifficultyColor(prob.difficulty)}`}>
                          {prob.difficulty}
                        </span>
                        <span className="text-[10px] font-medium px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400 border border-slate-700 hidden sm:inline">
                          {prob.category}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                        {prob.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (onAssignProblemToCandidate) {
                          onAssignProblemToCandidate(modalCandidateId, prob.id);
                        }
                        setModalCandidateId(null);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 flex items-center gap-1.5 transition-all ${
                        isCurrentlyAssigned
                          ? 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 hover:text-white'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-900/40'
                      }`}
                    >
                      <span>{isCurrentlyAssigned ? 'Keep Current' : 'Assign'}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between text-xs text-slate-400">
              <span>This question is assigned ONLY to candidate {modalCandidateId}.</span>
              <button
                type="button"
                onClick={() => setModalCandidateId(null)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
