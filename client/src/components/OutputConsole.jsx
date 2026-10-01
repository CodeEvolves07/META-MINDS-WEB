import React, { useState, useRef, useEffect } from 'react';
import { 
  Terminal, 
  Clock, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  FileInput, 
  Square,
  CornerDownLeft,
  Sparkles
} from 'lucide-react';

export default function OutputConsole({
  outputResult,
  stdin = '',
  onChangeStdin,
  onClearOutput,
  isRunning = false,
  terminalLog = '',
  onSendInput,
  onStopProcess,
  isInterviewer = false,
  activeCandidateName = ''
}) {
  const [activeTab, setActiveTab] = useState('terminal'); // 'terminal' | 'stdin'
  const [currentInput, setCurrentInput] = useState('');
  const terminalEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom of terminal output as new text arrives
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLog, isRunning]);

  // Auto-focus interactive input when process is running
  useEffect(() => {
    if (isRunning && inputRef.current && !isInterviewer) {
      inputRef.current.focus();
    }
  }, [isRunning, isInterviewer]);

  const handleInputSubmit = (e) => {
    e.preventDefault();
    if (!onSendInput) return;
    const toSend = currentInput;
    onSendInput(toSend + '\n');
    setCurrentInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInputSubmit(e);
    }
  };

  const hasOutput = Boolean(
    terminalLog || 
    (outputResult && (outputResult.stdout || outputResult.stderr || outputResult.compile_output))
  );

  const getStatusBadge = () => {
    if (isRunning) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
          Running...
        </span>
      );
    }

    if (!outputResult) return null;
    const desc = outputResult.status?.description || (outputResult.success ? 'Accepted' : 'Executed');
    const isSuccess = outputResult.success && !outputResult.stderr && !outputResult.compile_output;

    if (isSuccess) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3 h-3" />
          {desc}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
        <XCircle className="w-3 h-3" />
        {desc}
      </span>
    );
  };

  const renderInputArea = () => (
    <div className="h-full flex flex-col p-3 bg-slate-950 font-mono">
      <div className="flex items-center justify-between mb-1 font-sans">
        <div className="flex items-center gap-1.5">
          <FileInput className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs font-semibold text-slate-200">Preloaded STDIN (Optional)</span>
        </div>
        {stdin && (
          <button
            onClick={() => onChangeStdin('')}
            className="text-[10px] text-slate-400 hover:text-rose-400 font-medium transition-colors"
          >
            Clear
          </button>
        )}
      </div>
      <p className="text-[11px] text-slate-400 font-sans mb-2">
        Leave empty to type input interactively in the terminal once your program starts, or preload input lines here:
      </p>
      <textarea
        value={stdin}
        onChange={(e) => onChangeStdin(e.target.value)}
        placeholder={`Leave empty to type interactively when program runs.\n\nOr enter lines here:\n5\n10`}
        className="flex-1 w-full bg-slate-900 border border-slate-700/80 rounded-lg p-2.5 font-mono text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none transition-colors"
      />
    </div>
  );

  const renderTerminalArea = () => (
    <div 
      onClick={() => {
        if (isRunning && inputRef.current && !isInterviewer) {
          inputRef.current.focus();
        }
      }}
      className="h-full flex flex-col bg-slate-950 text-xs font-mono p-3 overflow-hidden cursor-text"
    >
      {/* Scrollable Output Stream */}
      <div className="flex-1 overflow-y-auto space-y-2 select-text min-h-0">
        {!isRunning && !hasOutput && (
          <div className="text-slate-500 italic py-6 text-center font-sans text-xs select-none">
            Click <span className="font-semibold text-emerald-400">Run Code</span> to start your program. If it requests <code className="text-indigo-300 font-mono">input()</code>, you can type directly into the terminal!
          </div>
        )}

        {/* Display live terminal log if present */}
        {terminalLog ? (
          <pre className="whitespace-pre-wrap text-slate-200 font-mono leading-relaxed break-words">
            {terminalLog}
          </pre>
        ) : (
          <>
            {/* Fallback to legacy outputResult if terminalLog is empty */}
            {outputResult?.compile_output && (
              <div className="p-2 rounded bg-rose-950/40 border border-rose-900/60 text-rose-300">
                <div className="font-bold text-[11px] text-rose-400 uppercase mb-0.5 font-sans">
                  Compilation Error:
                </div>
                <pre className="whitespace-pre-wrap text-xs">{outputResult.compile_output}</pre>
              </div>
            )}
            {outputResult?.stderr && (
              <div className="p-2 rounded bg-rose-950/40 border border-rose-900/60 text-rose-300">
                <div className="font-bold text-[11px] text-rose-400 uppercase mb-0.5 font-sans">
                  Runtime Error (stderr):
                </div>
                <pre className="whitespace-pre-wrap text-xs">{outputResult.stderr}</pre>
              </div>
            )}
            {outputResult?.stdout && (
              <pre className="whitespace-pre-wrap text-emerald-300 font-mono leading-relaxed">
                {outputResult.stdout}
              </pre>
            )}
          </>
        )}

        {/* Scroll anchor */}
        <div ref={terminalEndRef} />
      </div>

      {/* Interactive Stdin Bar (ACTIVE WHEN PROCESS IS RUNNING) */}
      {isRunning && (
        <form 
          onSubmit={handleInputSubmit}
          className="mt-2 pt-2 border-t border-slate-800/80 flex items-center gap-2 shrink-0 bg-slate-950"
        >
          <span className="text-emerald-400 font-bold select-none text-xs flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            $
          </span>
          <input
            ref={inputRef}
            type="text"
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isInterviewer}
            placeholder={isInterviewer ? "Observing candidate terminal (read-only)..." : "Type input here and press Enter (↵)..."}
            className="flex-1 bg-slate-900 border border-slate-700/80 focus:border-emerald-500 rounded px-2.5 py-1 text-xs text-white placeholder-slate-500 font-mono focus:outline-none transition-colors"
          />
          {!isInterviewer && (
            <button
              type="submit"
              disabled={!currentInput.trim()}
              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded text-xs font-semibold flex items-center gap-1 transition-all"
            >
              <span>Send</span>
              <CornerDownLeft className="w-3 h-3" />
            </button>
          )}
        </form>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      {/* Console Header */}
      <div className="h-9 border-b border-slate-800 bg-slate-900/95 px-3 flex items-center justify-between text-xs font-sans shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-indigo-400" />
          
          {/* Terminal Tab */}
          <button
            onClick={() => setActiveTab('terminal')}
            className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeTab === 'terminal'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Interactive Terminal</span>
            {isRunning && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            )}
          </button>

          {/* Stdin Preload Tab */}
          <button
            onClick={() => setActiveTab('stdin')}
            className={`px-2 py-0.5 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
              activeTab === 'stdin'
                ? 'bg-slate-800 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Preloaded STDIN</span>
            {stdin && stdin.trim() ? (
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
            ) : null}
          </button>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center gap-2">
          {getStatusBadge()}

          {/* Stop Process Button (When running) */}
          {isRunning && onStopProcess && (
            <button
              onClick={onStopProcess}
              title="Stop running process"
              className="flex items-center gap-1 px-2 py-0.5 bg-rose-600/80 hover:bg-rose-500 text-white rounded text-[11px] font-semibold border border-rose-500/50 shadow-sm transition-all"
            >
              <Square className="w-2.5 h-2.5 fill-white" />
              <span>Stop</span>
            </button>
          )}

          <button
            onClick={onClearOutput}
            title="Clear Terminal Output"
            className="p-1 text-slate-500 hover:text-slate-300 rounded hover:bg-slate-800 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Console Body */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === 'stdin' ? renderInputArea() : renderTerminalArea()}
      </div>
    </div>
  );
}
