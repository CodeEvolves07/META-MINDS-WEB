import React from "react";
import { BookOpen, Tag, Clock, Database, CheckCircle2, AlertCircle } from "lucide-react";

export function ProblemCard({ problem }) {
  if (!problem) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-slate-500">
        <p className="text-sm">No problem selected.</p>
      </div>
    );
  }

  const getDifficultyColor = (diff) => {
    switch (diff?.toLowerCase()) {
      case "easy":
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case "medium":
        return "bg-amber-500/10 text-amber-400 border-amber-500/30";
      case "hard":
        return "bg-rose-500/10 text-rose-400 border-rose-500/30";
      default:
        return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    }
  };

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 text-slate-200">
      {/* Title & Metadata Header */}
      <div className="space-y-2 pb-3 border-b border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getDifficultyColor(problem.difficulty)}`}>
            {problem.difficulty}
          </span>
          <span className="text-xs text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
            {problem.category}
          </span>
        </div>

        <h2 className="text-lg font-bold text-slate-100">{problem.title}</h2>

        {/* Complexity Targets */}
        <div className="flex flex-wrap gap-3 text-xs text-slate-400 pt-1">
          {problem.timeTarget && (
            <div className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Target: <strong className="text-slate-300 font-mono">{problem.timeTarget}</strong></span>
            </div>
          )}
          {problem.spaceTarget && (
            <div className="flex items-center gap-1">
              <Database className="w-3.5 h-3.5 text-indigo-400" />
              <span>Space: <strong className="text-slate-300 font-mono">{problem.spaceTarget}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="text-sm text-slate-300 leading-relaxed space-y-2 whitespace-pre-line font-normal">
        {problem.description}
      </div>

      {/* Examples */}
      {problem.examples && problem.examples.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
            Examples
          </h3>
          {problem.examples.map((example, idx) => (
            <div key={idx} className="bg-slate-900/80 rounded-lg p-3 border border-slate-800 text-xs font-mono space-y-1.5">
              <div className="text-slate-400 font-semibold font-sans text-[11px]">Example {idx + 1}:</div>
              <div>
                <span className="text-slate-400">Input: </span>
                <span className="text-slate-200">{example.input}</span>
              </div>
              <div>
                <span className="text-slate-400">Output: </span>
                <span className="text-emerald-400">{example.output}</span>
              </div>
              {example.explanation && (
                <div className="font-sans text-[11px] text-slate-400 pt-1 border-t border-slate-800/80 mt-1">
                  <span className="font-semibold text-slate-300">Explanation: </span>
                  {example.explanation}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Constraints */}
      {problem.constraints && problem.constraints.length > 0 && (
        <div className="space-y-2 pt-2 pb-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            Constraints
          </h3>
          <ul className="list-disc list-inside space-y-1 text-xs text-slate-400 font-mono">
            {problem.constraints.map((c, i) => (
              <li key={i} className="text-slate-300">{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
