import React, { useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { 
  Play, 
  Send, 
  RotateCcw, 
  CheckCircle2, 
  Loader2, 
  Code2, 
  ChevronDown 
} from 'lucide-react';

const SUPPORTED_LANGUAGES = [
  { id: 'python', label: 'Python (3.8.1)', monacoId: 'python' },
  { id: 'javascript', label: 'JavaScript (Node.js)', monacoId: 'javascript' },
  { id: 'java', label: 'Java (OpenJDK)', monacoId: 'java' },
  { id: 'cpp', label: 'C++ (GCC)', monacoId: 'cpp' },
];

export default function MonacoCodeEditor({
  code = '',
  language = 'python',
  onChangeCode,
  onChangeLanguage,
  onRunCode,
  onSubmitCode,
  onResetCode,
  isRunning = false,
  isSubmitting = false,
  isInterviewer = false,
  candidatesList = [],
  selectedCandidateId = '',
  onSelectCandidate,
  activeCandidateName = ''
}) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Custom editor configuration
    editor.updateOptions({
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      fontLigatures: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      lineNumbers: 'on',
      roundedSelection: true,
      tabSize: 4,
      automaticLayout: true,
      bracketPairColorization: { enabled: true }
    });

    // Add keyboard shortcut for Run Code (Ctrl+Enter or Cmd+Enter)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      onRunCode();
    });
  };

  const getMonacoLanguage = () => {
    const found = SUPPORTED_LANGUAGES.find((l) => l.id === language);
    return found ? found.monacoId : 'python';
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
      {/* Top Toolbar: Language Selector & Workspace Info */}
      <div className="h-10 border-b border-slate-800 bg-slate-900/95 px-3 flex items-center justify-between gap-2 shrink-0">
        {/* Language selector & Reset */}
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-indigo-400" />
          <div className="relative">
            <select
              value={language}
              onChange={(e) => onChangeLanguage(e.target.value)}
              className="appearance-none bg-slate-950 border border-slate-700 text-xs font-semibold text-slate-200 py-1 pl-2.5 pr-7 rounded-lg focus:outline-none focus:border-indigo-500 cursor-pointer shadow-sm hover:border-slate-600 transition-colors"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.id} value={lang.id}>
                  {lang.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 transform -translate-y-1/2 pointer-events-none" />
          </div>

          <button
            onClick={onResetCode}
            title="Clear editor to blank state"
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1 text-xs"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        </div>

        {/* Right: Candidate Live View Selector for Interviewer or Candidate Privacy Badge */}
        <div className="flex items-center gap-2">
          {isInterviewer ? (
            candidatesList.length > 0 ? (
              <div className="flex items-center gap-1.5 bg-indigo-950/60 border border-indigo-700/80 px-2 py-0.5 rounded-lg">
                <span className="text-[11px] text-indigo-300 font-medium hidden md:inline">Candidate:</span>
                <div className="relative">
                  <select
                    value={selectedCandidateId}
                    onChange={(e) => onSelectCandidate && onSelectCandidate(e.target.value)}
                    className="appearance-none bg-indigo-900/80 text-white text-xs font-semibold py-0.5 pl-2 pr-5 rounded focus:outline-none cursor-pointer"
                  >
                    {candidatesList.map((c) => (
                      <option key={c.socketId || c.candidateId} value={c.candidateId || c.userName}>
                        {c.userName || c.candidateId}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-indigo-300 absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-slate-400 italic bg-slate-800/60 px-2 py-0.5 rounded-lg border border-slate-700/50">
                Waiting for candidate...
              </span>
            )
          ) : (
            <span className="text-[11px] text-emerald-400/90 font-medium bg-emerald-950/40 border border-emerald-800/60 px-2 py-0.5 rounded-md flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              Isolated Workspace
            </span>
          )}
        </div>
      </div>

      {/* Monaco Editor Container (Middle, Scrollable independently) */}
      <div className="flex-1 w-full min-h-[160px] relative">
        <Editor
          height="100%"
          theme="vs-dark"
          language={getMonacoLanguage()}
          value={code}
          onChange={(newVal) => onChangeCode(newVal || '')}
          onMount={handleEditorDidMount}
          options={{
            automaticLayout: true,
            tabSize: 4,
            lineNumbers: 'on',
            minimap: { enabled: false },
            fontSize: 14,
            padding: { top: 10, bottom: 10 },
            scrollBeyondLastLine: false
          }}
          loading={
            <div className="flex items-center justify-center h-full text-slate-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
              <span className="text-xs">Loading Monaco Editor...</span>
            </div>
          }
        />
      </div>

      {/* Dedicated Action Bar: Always Visible & Clickable directly below Editor */}
      <div className="h-12 bg-slate-950 border-t border-slate-800 px-3.5 flex items-center justify-between gap-3 shrink-0 shadow-inner z-10">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
          <span className="hidden sm:inline text-slate-500">Shortcut:</span>
          <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px] text-slate-300 font-semibold shadow-sm">Ctrl+↵</kbd>
          <span className="text-slate-500">to execute</span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* RUN CODE BUTTON */}
          <button
            onClick={onRunCode}
            disabled={isRunning}
            title="Execute Code (Ctrl + Enter)"
            className="flex items-center gap-2 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-lg text-xs font-bold border border-emerald-500/40 shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 text-white fill-white" />
                <span>Run Code</span>
              </>
            )}
          </button>

          {/* FINAL SUBMIT BUTTON */}
          <button
            onClick={onSubmitCode}
            disabled={isSubmitting}
            title="Submit final solution"
            className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-lg text-xs font-bold border border-indigo-500/40 shadow-lg shadow-indigo-950/40 transition-all disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Submit Code</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
