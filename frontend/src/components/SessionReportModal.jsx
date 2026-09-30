import React from "react";
import { 
  X, 
  Download, 
  FileCode, 
  Printer, 
  CheckCircle, 
  XCircle, 
  Award, 
  Star, 
  Calendar, 
  Clock, 
  Code2, 
  ShieldCheck 
} from "lucide-react";

export function SessionReportModal({
  isOpen,
  onClose,
  roomId,
  activeProblem,
  language,
  finalCode,
  scorecard,
  testResults,
  testCases = [],
  executionHistory = []
}) {
  if (!isOpen) return null;

  // Compute test case stats
  const totalCases = testCases.length;
  let passedCases = 0;
  if (testResults) {
    Object.values(testResults).forEach((r) => {
      if (r && r.passed) passedCases++;
    });
  }
  const passRate = totalCases > 0 ? Math.round((passedCases / totalCases) * 100) : 0;

  // Build Markdown report string for download
  const generateMarkdownReport = () => {
    return `# Technical Interview Evaluation Dossier
**Room ID:** \`${roomId}\`  
**Date:** ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}  
**Challenge:** ${activeProblem?.title || "Algorithmic Assessment"} (${activeProblem?.difficulty || "Medium"})  
**Target Complexity:** Time ${activeProblem?.timeTarget || "O(n)"}, Space ${activeProblem?.spaceTarget || "O(1)"}  
**Language:** ${language.toUpperCase()}  

---

## 1. Candidate Evaluation Scorecard
- **Overall Recommendation:** **${scorecard?.recommendation || "Hire"}**
- **Problem Solving & Algorithms:** ${scorecard?.problemSolving || 0} / 5
- **Code Quality & Architecture:** ${scorecard?.codeQuality || 0} / 5
- **Communication & Clarification:** ${scorecard?.communication || 0} / 5
- **System Design & Optimization:** ${scorecard?.optimization || 0} / 5

### Interviewer Private Comments:
> ${scorecard?.notes || "Candidate demonstrated sound problem decomposition and handled edge cases systematically."}

---

## 2. Test Execution Metrics & Pass Rate
- **Automated Test Cases Passed:** ${passedCases} / ${totalCases} (${passRate}%)
- **Total Code Sandbox Runs:** ${executionHistory.length}
- **Average Runtime:** ${executionHistory.length > 0 ? executionHistory[executionHistory.length - 1].time : "N/A"}

---

## 3. Final Code Snapshot (${language})
\`\`\`${language}
${finalCode}
\`\`\`

---
*Report automatically compiled by MetaMinds Remote Technical Interview Sandbox with WebRTC Audio & Code Run.*
`;
  };

  const handleDownloadMarkdown = () => {
    const md = generateMarkdownReport();
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `interview_report_${roomId}_${Date.now()}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJSON = () => {
    const dossier = {
      roomId,
      exportedAt: new Date().toISOString(),
      problem: activeProblem,
      language,
      finalCodeSnapshot: finalCode,
      scorecard: scorecard || {},
      testMetrics: {
        totalCases,
        passedCases,
        passRate: `${passRate}%`
      },
      executionHistory
    };
    const blob = new Blob([JSON.stringify(dossier, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `interview_dossier_${roomId}_${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-3xl bg-[#0f172a] rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                Technical Interview Session Dossier
              </h3>
              <p className="text-xs text-slate-400">
                Room: <strong className="text-slate-300 font-mono">{roomId}</strong> • Session Complete
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-slate-200 text-sm">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">Hiring Verdict</span>
              <div className="text-sm font-bold text-purple-400 mt-1">
                {scorecard?.recommendation || "Hire"}
              </div>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">Test Pass Rate</span>
              <div className="text-sm font-bold text-emerald-400 mt-1 flex items-center gap-1">
                <span>{passRate}%</span>
                <span className="text-xs text-slate-400 font-normal">({passedCases}/{totalCases})</span>
              </div>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">Challenge</span>
              <div className="text-sm font-bold text-slate-200 mt-1 truncate">
                {activeProblem?.title || "Custom Challenge"}
              </div>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 font-medium">Total Runs</span>
              <div className="text-sm font-bold text-cyan-400 mt-1 font-mono">
                {executionHistory.length} Executions
              </div>
            </div>
          </div>

          {/* Scorecard Breakdown */}
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <Award className="w-4 h-4" />
              Interviewer Rubric Evaluation
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex justify-between items-center p-2 rounded bg-slate-950/60 border border-slate-800">
                <span className="text-slate-300">Problem Solving</span>
                <div className="flex items-center text-amber-400 font-bold">
                  {scorecard?.problemSolving || 4} / 5
                </div>
              </div>

              <div className="flex justify-between items-center p-2 rounded bg-slate-950/60 border border-slate-800">
                <span className="text-slate-300">Code Quality</span>
                <div className="flex items-center text-amber-400 font-bold">
                  {scorecard?.codeQuality || 4} / 5
                </div>
              </div>

              <div className="flex justify-between items-center p-2 rounded bg-slate-950/60 border border-slate-800">
                <span className="text-slate-300">Communication</span>
                <div className="flex items-center text-amber-400 font-bold">
                  {scorecard?.communication || 5} / 5
                </div>
              </div>

              <div className="flex justify-between items-center p-2 rounded bg-slate-950/60 border border-slate-800">
                <span className="text-slate-300">System Design / Optimization</span>
                <div className="flex items-center text-amber-400 font-bold">
                  {scorecard?.optimization || 4} / 5
                </div>
              </div>
            </div>

            {/* Scorecard Notes */}
            <div className="pt-2">
              <span className="text-xs font-medium text-slate-400">Interviewer Private Remarks:</span>
              <p className="mt-1 p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs text-slate-300 font-sans italic whitespace-pre-wrap">
                {scorecard?.notes || "Candidate demonstrated excellent algorithmic clarity, articulated trade-offs well, and resolved edge-case constraints cleanly."}
              </p>
            </div>
          </div>

          {/* Final Code Snapshot */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Code2 className="w-4 h-4 text-blue-400" />
                Final Code Snapshot ({language})
              </h4>
              <span className="text-[11px] font-mono text-slate-500">
                {finalCode.split('\n').length} lines
              </span>
            </div>

            <pre className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-emerald-300 overflow-x-auto max-h-48 leading-relaxed">
              <code>{finalCode}</code>
            </pre>
          </div>
        </div>

        {/* Modal Footer with Actions */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
          >
            Close Window
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Dossier</span>
            </button>

            <button
              onClick={handleDownloadJSON}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export JSON</span>
            </button>

            <button
              onClick={handleDownloadMarkdown}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-all active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Markdown Report</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
