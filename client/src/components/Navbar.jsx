import React, { useState } from 'react';
import { 
  Code2, 
  Copy, 
  Check, 
  Wifi, 
  WifiOff, 
  PhoneOff, 
  UserCheck, 
  ShieldAlert,
  Sparkles,
  Clock
} from 'lucide-react';
import { useCountdownTimer } from '../utils/countdown';

export default function Navbar({ 
  roomId, 
  role, 
  connectionStatus, 
  socketConnected, 
  onEndInterview,
  isJoinWindowExpired = false,
  meetingJoinDeadline = null,
  serverTime = null
}) {
  const [copied, setCopied] = useState(false);
  const { secondsRemaining, isExpired: timerExpired, formatted } = useCountdownTimer(meetingJoinDeadline, serverTime);
  const effectivelyExpired = isJoinWindowExpired || timerExpired;

  const handleCopyId = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getStatusBadge = () => {
    if (!socketConnected) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <WifiOff className="w-3.5 h-3.5 animate-pulse" />
          Disconnected
        </span>
      );
    }
    if (connectionStatus === 'connected') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
          Live Session
        </span>
      );
    }
    if (connectionStatus === 'peer_joined') {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <UserCheck className="w-3.5 h-3.5" />
          Peer Connected
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <Wifi className="w-3.5 h-3.5 animate-pulse" />
        Connecting...
      </span>
    );
  };

  return (
    <header className="h-14 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-4 flex items-center justify-between z-30 select-none">
      {/* Left: Branding */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 font-bold text-lg tracking-tight text-white">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Code2 className="w-5 h-5 text-white" />
          </div>
          <span className="bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent font-extrabold text-xl">
            CodeMeet
          </span>
        </div>

        <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
          Sandbox
        </span>
      </div>

      {/* Center: Room ID & Copy */}
      <div className="flex items-center gap-3">
        {roomId && (
          <div className="flex items-center bg-slate-950/70 border border-slate-800 rounded-lg p-1 px-2.5 gap-2">
            <span className="text-xs text-slate-400 font-medium">Room ID:</span>
            <span className="font-mono text-xs font-bold text-indigo-400 tracking-wider">
              {roomId}
            </span>
            <button
              onClick={handleCopyId}
              title="Copy Room ID"
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        )}

        {getStatusBadge()}

        {/* Join window countdown badge for interviewer and candidate */}
        {meetingJoinDeadline && (
          effectivelyExpired || (secondsRemaining !== null && secondsRemaining <= 0) ? (
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-slate-800 text-slate-400 border-slate-700">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
              <span>Join window expired</span>
            </span>
          ) : (
            <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
              <Clock className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span>
                {role === 'interviewer' 
                  ? `New candidate entry closes in: ` 
                  : `Time remaining for new candidates: `}
                <strong className="font-mono font-bold text-emerald-300">{formatted}</strong>
              </span>
            </span>
          )
        )}
      </div>

      {/* Right: Role indicator & Action buttons */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold uppercase tracking-wider bg-slate-800/80 text-slate-300 border border-slate-700">
          <span className={`w-2 h-2 rounded-full ${role === 'interviewer' ? 'bg-indigo-400' : 'bg-teal-400'}`}></span>
          {role === 'interviewer' ? 'Interviewer' : 'Candidate'}
        </div>

        {role === 'interviewer' ? (
          <button
            onClick={onEndInterview}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600/90 hover:bg-rose-600 text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-rose-900/30"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>End Interview</span>
          </button>
        ) : (
          <button
            onClick={onEndInterview}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium border border-slate-700 transition-all"
          >
            <PhoneOff className="w-3.5 h-3.5 text-rose-400" />
            <span>Leave Session</span>
          </button>
        )}
      </div>
    </header>
  );
}
