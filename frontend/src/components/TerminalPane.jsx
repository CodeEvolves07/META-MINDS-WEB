import React, { useState } from "react";
import { 
  Terminal, 
  Play, 
  Clock, 
  Database, 
  CheckCircle, 
  XCircle, 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  Cpu, 
  Sliders,
  History,
  CheckCheck
} from "lucide-react";

export function TerminalPane({
  output,
  isRunning,
  stdin,
  onStdinChange,
  onClearOutput,
  testCases = [],
  onRunTestCases,
  isTestingCases,
  testResults,
  executionHistory = [],
  isCollapsed,
  onToggleCollapse
}) {
  const [activeTab, setActiveTab] = useState("output"); // 'output' | 'stdin' | 'tests' | 'history'

  const getStatusBadge = (status, isSuccess) => {
    if (!status) return null;
    const isAccepted = isSuccess || status.toLowerCase().includes("accepted");
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border ${
        isAccepted
          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
          : "bg-rose-500/10 text-rose-400 border-rose-500/30"
      }`}>
        {isAccepted ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
        {status}
      </span>
    );
  };

  return (
    <div className={`border-t border-slate-800 bg-[#070b14] flex flex-col transition-all duration-200 select-none ${
      isCollapsed ? "h-9" : "h-64 sm:h-72"
    }`}>
      {/* Terminal Tab Bar */}
      <div className="h-9 px-3 flex items-center justify-between border-b border-slate-800 bg-slate-950 text-xs">
        <div className="flex items-center space-x-1">
          <button
            onClick={() => { setActiveTab("output"); if (isCollapsed) onToggleCollapse(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md font-medium transition-colors ${
              activeTab === "output" && !isCollapsed
                ? "bg-[#070b14] text-cyan-400 border-t-2 border-cyan-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Output</span>
            {output && (
              <span className={`w-1.5 h-1.5 rounded-full ${output.isSuccess ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            )}
          </button>

          <button
            onClick={() => { setActiveTab("stdin"); if (isCollapsed) onToggleCollapse(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md font-medium transition-colors ${
              activeTab === "stdin" && !isCollapsed
                ? "bg-[#070b14] text-cyan-400 border-t-2 border-cyan-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Custom Stdin</span>
            {stdin && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />}
          </button>

          <button
            onClick={() => { setActiveTab("tests"); if (isCollapsed) onToggleCollapse(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md font-medium transition-colors ${
              activeTab === "tests" && !isCollapsed
                ? "bg-[#070b14] text-cyan-400 border-t-2 border-cyan-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <CheckCheck className="w-3.5 h-3.5" />
            <span>Test Cases</span>
            {testCases.length > 0 && (
              <span className="text-[10px] bg-slate-800 text-slate-400 px-1 rounded">
                {testCases.length}
              </span>
            )}
          </button>

          <button
            onClick={() => { setActiveTab("history"); if (isCollapsed) onToggleCollapse(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-t-md font-medium transition-colors ${
              activeTab === "history" && !isCollapsed
                ? "bg-[#070b14] text-cyan-400 border-t-2 border-cyan-400"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History</span>
          </button>
        </div>

        {/* Right side controls */}
        <div className="flex items-center space-x-2">
          {output && (
            <div className="hidden md:flex items-center gap-3 text-[11px] text-slate-400 mr-2 font-mono">
              {getStatusBadge(output.status, output.isSuccess)}
              {output.time && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-cyan-400" /> {output.time}
                </span>
              )}
              {output.memory && (
                <span className="flex items-center gap-1">
                  <Database className="w-3 h-3 text-indigo-400" /> {output.memory}
                </span>
              )}
            </div>
          )}

          <button
            onClick={onClearOutput}
            title="Clear output console"
            className="p-1 rounded text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? "Expand Terminal" : "Collapse Terminal"}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            {isCollapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Terminal Body */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto p-3 font-mono text-xs text-slate-300">
          {activeTab === "output" && (
            <div className="h-full flex flex-col justify-between">
              <div className="space-y-2">
                {isRunning ? (
                  <div className="flex items-center space-x-2 text-cyan-400 py-3">
                    <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                    <span>Compiling and executing in remote isolated sandbox...</span>
                  </div>
                ) : output ? (
                  <div className="space-y-2">
                    {output.engine && (
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pb-1 border-b border-slate-900 font-sans">
                        <Cpu className="w-3 h-3 text-blue-400" />
                        <span>Execution Engine: <strong className="text-slate-400">{output.engine}</strong></span>
                        {output.language && <span>• {output.language}</span>}
                      </div>
                    )}

                    {output.compileOutput && (
                      <div className="bg-rose-950/20 border border-rose-800/40 p-2.5 rounded text-rose-300 whitespace-pre-wrap">
                        <div className="text-[10px] uppercase font-bold text-rose-400 mb-1">Compilation Error:</div>
                        {output.compileOutput}
                      </div>
                    )}

                    {output.stderr && (
                      <div className="bg-rose-950/20 border border-rose-800/40 p-2.5 rounded text-rose-300 whitespace-pre-wrap">
                        <div className="text-[10px] uppercase font-bold text-rose-400 mb-1">Stderr:</div>
                        {output.stderr}
                      </div>
                    )}

                    {output.stdout ? (
                      <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800/80 text-emerald-300 whitespace-pre-wrap">
                        <div className="text-[10px] uppercase font-bold text-slate-400 mb-1 font-sans">Standard Output:</div>
                        {output.stdout}
                      </div>
                    ) : !output.stderr && !output.compileOutput ? (
                      <p className="text-slate-500 italic">Program finished execution with no standard output.</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="h-28 flex flex-col items-center justify-center text-slate-600 space-y-1">
                    <Terminal className="w-6 h-6 stroke-1 text-slate-600" />
                    <p className="text-xs">Terminal is idle. Click "Run Code" (Ctrl+Enter) to compile &amp; run.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "stdin" && (
            <div className="h-full flex flex-col space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400 font-sans">
                <span>Enter custom standard input (stdin) for code execution:</span>
                <span className="text-slate-500">Passed line-by-line to process.stdin</span>
              </div>
              <textarea
                value={stdin}
                onChange={(e) => onStdinChange(e.target.value)}
                placeholder="e.g.&#10;[2, 7, 11, 15]&#10;9"
                rows={5}
                className="w-full flex-1 bg-slate-950 text-slate-200 font-mono text-xs p-3 rounded-lg border border-slate-800 focus:outline-none focus:ring-1 focus:ring-cyan-500 placeholder-slate-600 resize-none"
              />
            </div>
          )}

          {activeTab === "tests" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 font-sans">
                  Evaluate solution against all sample &amp; hidden validation test cases:
                </span>
                <button
                  onClick={onRunTestCases}
                  disabled={isTestingCases || isRunning}
                  className="flex items-center gap-1.5 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white font-sans text-xs font-semibold shadow transition-all active:scale-95 disabled:opacity-50"
                >
                  {isTestingCases ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Validating...</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3 fill-current" />
                      <span>Run All Test Cases</span>
                    </>
                  )}
                </button>
              </div>

              {/* Test Cases Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-sans">
                {testCases.map((tc, idx) => {
                  const result = testResults && testResults[tc.id];
                  return (
                    <div
                      key={tc.id}
                      className={`p-2.5 rounded-lg border text-xs transition-all ${
                        result
                          ? result.passed
                            ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                            : "bg-rose-950/20 border-rose-500/40 text-rose-300"
                          : "bg-slate-900/60 border-slate-800 text-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-semibold text-slate-200">
                          Case {idx + 1} {tc.isHidden && <span className="text-[10px] text-purple-400 ml-1">(Hidden)</span>}
                        </span>
                        {result ? (
                          <span className={`flex items-center gap-1 text-[11px] font-bold ${
                            result.passed ? "text-emerald-400" : "text-rose-400"
                          }`}>
                            {result.passed ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                            {result.passed ? "Passed" : "Failed"}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500">Not Run</span>
                        )}
                      </div>

                      <div className="space-y-1 font-mono text-[11px]">
                        <div><span className="text-slate-500">Input: </span>{tc.stdin.replace(/\n/g, ' ')}</div>
                        <div><span className="text-slate-500">Expected: </span><span className="text-cyan-300">{tc.expectedOutput}</span></div>
                        {result && result.actualOutput && (
                          <div><span className="text-slate-500">Actual: </span><span className={result.passed ? "text-emerald-300" : "text-rose-300"}>{result.actualOutput}</span></div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "history" && (
            <div className="space-y-2 font-sans">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Session Run Log</h4>
              {executionHistory.length === 0 ? (
                <p className="text-xs text-slate-600 italic">No executions logged yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {executionHistory.map((h, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800 text-xs">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${h.isSuccess ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        <span className="font-mono text-slate-200">{h.language}</span>
                        <span className="text-slate-500">• {new Date(h.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="flex items-center gap-3 font-mono text-[11px]">
                        <span className={h.isSuccess ? "text-emerald-400" : "text-rose-400"}>{h.status}</span>
                        <span className="text-slate-400">{h.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
