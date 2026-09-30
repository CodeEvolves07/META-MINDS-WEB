import React, { useState } from "react";
import { 
  Play, 
  Copy, 
  Check, 
  Radio, 
  FileText, 
  UserCheck, 
  Code2, 
  Zap, 
  ShieldCheck, 
  Sparkles,
  HelpCircle,
  RefreshCw
} from "lucide-react";

export function Navbar({
  roomId,
  role,
  onRoleChange,
  language,
  onLanguageChange,
  onRunCode,
  isRunning,
  latency,
  isConnected,
  onOpenReport,
  onResetCode,
  onLeaveRoom,
  candidateCode
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}&role=${role === 'interviewer' ? 'candidate' : 'interviewer'}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="h-14 border-b border-slate-800 bg-[#0f172a]/95 backdrop-blur-md px-4 flex items-center justify-between z-30 select-none">
      {/* Left: Branding & Room Info */}
      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Code2 className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold text-slate-100 flex items-center gap-1.5 leading-tight">
              MetaMinds Sandbox
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                P2P Live
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">WebRTC Audio &amp; Judge0 Cloud Run</p>
          </div>
        </div>

        <div className="h-5 w-px bg-slate-800 mx-1 hidden sm:block" />

        {/* Room Share Pill */}
        <div className="flex items-center bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/60 text-xs">
          <span className="px-2 py-0.5 text-slate-400 font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Room: <strong className="text-slate-200">{roomId}</strong>
          </span>
          <button
            onClick={handleCopyLink}
            title="Copy Invite Link (Invites opposite role)"
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden md:inline text-[11px]">{copied ? "Copied!" : "Invite"}</span>
          </button>
        </div>

        {/* Candidate Code Pill */}
        {candidateCode && (
          <div className="hidden lg:flex items-center bg-purple-950/40 border border-purple-800/60 rounded-lg px-2.5 py-1 text-xs">
            <span className="text-purple-300 font-mono flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              Candidate Code: <strong className="text-white font-bold">{candidateCode}</strong>
            </span>
          </div>
        )}
      </div>

      {/* Middle: Controls (Language + Run) */}
      <div className="flex items-center space-x-2">
        {/* Language Selector */}
        <div className="relative">
          <select
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="bg-slate-800/90 text-slate-200 text-xs font-medium rounded-lg px-3 py-1.5 pr-7 border border-slate-700 hover:border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
          >
            <option value="python">Python 3 (3.8.1)</option>
            <option value="javascript">JavaScript (Node 12)</option>
            <option value="cpp">C++ (GCC 9.2)</option>
            <option value="java">Java (OpenJDK 13)</option>
          </select>
        </div>

        {/* Reset Code */}
        <button
          onClick={onResetCode}
          title="Reset to problem starter code"
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        {/* Run Code Button */}
        <button
          onClick={onRunCode}
          disabled={isRunning}
          title="Execute in Judge0 Sandbox (Ctrl + Enter)"
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-md transition-all ${
            isRunning
              ? "bg-emerald-700/50 text-emerald-200 cursor-not-allowed"
              : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 active:scale-95"
          }`}
        >
          {isRunning ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-emerald-300 border-t-transparent rounded-full animate-spin" />
              <span>Running...</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Code</span>
              <kbd className="hidden lg:inline text-[10px] bg-emerald-800/60 px-1 rounded text-emerald-200 ml-1">
                Ctrl+↵
              </kbd>
            </>
          )}
        </button>
      </div>

      {/* Right: Latency indicator, Role Switcher, Report Modal */}
      <div className="flex items-center space-x-2.5">
        {/* Latency & Network Pill */}
        <div 
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/50 text-[11px]"
          title="WebRTC / WebSocket connection health"
        >
          <span className={`w-2 h-2 rounded-full ${isConnected ? (latency < 100 ? "bg-emerald-400 animate-pulse" : "bg-amber-400") : "bg-rose-500"}`} />
          <span className="text-slate-400 font-mono">
            {isConnected ? `${latency}ms` : "Offline"}
          </span>
          <span className="text-[10px] text-slate-400 hidden xl:inline">
            {latency < 100 ? "• P2P Ultra-Low" : "• Normal"}
          </span>
        </div>

        {/* Role Toggle Switcher */}
        <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs">
          <button
            onClick={() => onRoleChange("interviewer")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all font-medium ${
              role === "interviewer"
                ? "bg-purple-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="text-[11px]">Interviewer</span>
          </button>
          <button
            onClick={() => onRoleChange("candidate")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all font-medium ${
              role === "candidate"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span className="text-[11px]">Candidate</span>
          </button>
        </div>

        {/* Session Report Trigger */}
        <button
          onClick={onOpenReport}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
          title="View and download complete session report dossier"
        >
          <FileText className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline text-[11px]">Report</span>
        </button>

        {/* Leave / Exit to Lobby */}
        {onLeaveRoom && (
          <button
            onClick={onLeaveRoom}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-rose-950/40 text-slate-400 hover:text-rose-300 text-xs font-medium border border-slate-700/80 hover:border-rose-500/30 transition-colors"
            title="Leave session and return to Login Lobby"
          >
            <span className="text-[11px]">Lobby</span>
          </button>
        )}
      </div>
    </header>
  );
}
