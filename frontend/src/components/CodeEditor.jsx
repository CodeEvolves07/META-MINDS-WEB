import React, { useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";

export function CodeEditor({
  code,
  language,
  onChange,
  remoteCursors,
  onCursorChange,
  onRunCode,
  isInterviewerTyping,
  isCandidateTyping
}) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef([]);
  const isLocalChange = useRef(false);

  // Map internal language name to Monaco language id
  const getMonacoLanguage = (lang) => {
    switch (lang) {
      case "python": return "python";
      case "javascript": return "javascript";
      case "cpp": return "cpp";
      case "java": return "java";
      default: return "python";
    }
  };

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Define Monaco dark custom theme
    monaco.editor.defineTheme("metaMindsDark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6a737d", fontStyle: "italic" },
        { token: "keyword", foreground: "f97583", fontStyle: "bold" },
        { token: "string", foreground: "9ecbff" },
        { token: "number", foreground: "79b8ff" },
        { token: "identifier", foreground: "e1e4e8" }
      ],
      colors: {
        "editor.background": "#0d131f",
        "editor.foreground": "#e2e8f0",
        "editorLineNumber.foreground": "#475569",
        "editorLineNumber.activeForeground": "#38bdf8",
        "editor.selectionBackground": "#1e3a8a66",
        "editor.lineHighlightBackground": "#1e293b40",
        "editorCursor.foreground": "#38bdf8"
      }
    });
    monaco.editor.setTheme("metaMindsDark");

    // Add keyboard shortcut for Run Code (Ctrl+Enter / Cmd+Enter)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      if (onRunCode) onRunCode();
    });

    // Cursor position and selection change listener
    editor.onDidChangeCursorPosition((e) => {
      if (onCursorChange) {
        const selection = editor.getSelection();
        onCursorChange({
          lineNumber: e.position.lineNumber,
          column: e.position.column,
          selection: selection ? {
            startLineNumber: selection.startLineNumber,
            startColumn: selection.startColumn,
            endLineNumber: selection.endLineNumber,
            endColumn: selection.endColumn
          } : null
        });
      }
    });
  };

  const handleCodeChange = (newValue) => {
    isLocalChange.current = true;
    onChange(newValue);
    setTimeout(() => { isLocalChange.current = false; }, 50);
  };

  // Render Remote Cursors
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const editor = editorRef.current;
    const monaco = monacoRef.current;

    const newDecorations = [];

    // Loop through remote cursors and build decorations
    Object.values(remoteCursors || {}).forEach((remote) => {
      if (!remote || !remote.cursor) return;
      const { lineNumber, column } = remote.cursor;
      const isInterviewer = remote.role === "interviewer";
      const badgeClass = isInterviewer ? "remote-cursor-interviewer" : "remote-cursor-candidate";
      const labelClass = isInterviewer ? "remote-cursor-label-interviewer" : "remote-cursor-label-candidate";

      newDecorations.push({
        range: new monaco.Range(lineNumber, column, lineNumber, column),
        options: {
          className: badgeClass,
          hoverMessage: { value: `**${remote.username || (isInterviewer ? 'Interviewer' : 'Candidate')}** is here` },
          before: {
            content: ` ${remote.username || (isInterviewer ? 'Interviewer' : 'Candidate')} `,
            inlineClassName: `remote-cursor-label ${labelClass}`
          }
        }
      });
    });

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);
  }, [remoteCursors]);

  return (
    <div className="relative h-full w-full flex flex-col bg-[#0d131f] overflow-hidden">
      {/* Editor Sub-Header / Status Bar */}
      <div className="h-8 border-b border-slate-800/80 bg-slate-950/60 px-3 flex items-center justify-between text-xs text-slate-400 select-none">
        <div className="flex items-center space-x-3">
          <span className="font-mono text-slate-300 font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            main.{language === "python" ? "py" : language === "javascript" ? "js" : language === "cpp" ? "cpp" : "java"}
          </span>
          <span className="text-[11px] text-slate-500">|</span>
          <span className="text-[11px] text-slate-400 font-mono">UTF-8</span>
        </div>

        {/* Remote Active Indicators */}
        <div className="flex items-center space-x-2 text-[11px]">
          {isInterviewerTyping && (
            <span className="flex items-center gap-1 text-purple-400 animate-pulse font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              Interviewer is typing...
            </span>
          )}
          {isCandidateTyping && (
            <span className="flex items-center gap-1 text-blue-400 animate-pulse font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              Candidate is typing...
            </span>
          )}
          <span className="text-[10px] text-slate-500 font-mono">Live Sync Active</span>
        </div>
      </div>

      {/* Monaco Editor Container */}
      <div className="flex-1 w-full relative">
        <Editor
          height="100%"
          language={getMonacoLanguage(language)}
          value={code}
          onChange={handleCodeChange}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          options={{
            fontFamily: "'Fira Code', 'JetBrains Mono', Consolas, monospace",
            fontSize: 13,
            lineHeight: 22,
            fontLigatures: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            renderWhitespace: "none",
            tabSize: 4,
            automaticLayout: true,
            formatOnPaste: true,
            formatOnType: true,
            scrollbar: {
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8
            }
          }}
        />
      </div>
    </div>
  );
}
