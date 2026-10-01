import React from 'react';
import { Clock } from 'lucide-react';
import { useCountdownTimer } from '../utils/countdown';

/**
 * Countdown banner for Pre-Join / Entry Page (PLACE 1)
 */
export function JoinCountdownBanner({ deadline, serverTime, isJoinWindowExpired = false }) {
  const { secondsRemaining, isExpired: timerExpired, formatted } = useCountdownTimer(deadline, serverTime);
  const effectivelyExpired = isJoinWindowExpired || timerExpired;

  if (effectivelyExpired || (secondsRemaining !== null && secondsRemaining <= 0)) {
    return (
      <div 
        id="join-countdown-banner"
        className="mb-6 p-3.5 rounded-xl bg-slate-950/80 border border-slate-700/80 text-slate-300 flex items-center justify-between shadow-inner animate-fadeIn"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-500" />
          <span className="text-xs font-semibold text-slate-400">Time remaining to join:</span>
        </div>
        <span 
          id="join-countdown-status"
          className="font-semibold text-xs text-rose-400 bg-rose-950/60 border border-rose-800/60 px-2.5 py-1 rounded-md"
        >
          Join window expired
        </span>
      </div>
    );
  }

  return (
    <div 
      id="join-countdown-banner"
      className="mb-6 p-3.5 rounded-xl bg-slate-950/80 border border-teal-500/30 text-teal-300 flex items-center justify-between shadow-inner animate-fadeIn"
    >
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-teal-400 animate-pulse" />
        <span className="text-xs font-semibold text-slate-200">Time remaining to join:</span>
      </div>
      <span 
        id="join-countdown-timer"
        className="font-mono text-base font-extrabold text-teal-300 tracking-wider"
      >
        {formatted}
      </span>
    </div>
  );
}

/**
 * Countdown indicator for Candidate Waiting Room (Pending Admission)
 */
export function WaitingRoomCountdown({ deadline, serverTime, isJoinWindowExpired = false }) {
  const { secondsRemaining, isExpired: timerExpired, formatted } = useCountdownTimer(deadline, serverTime);
  const effectivelyExpired = isJoinWindowExpired || timerExpired;

  return (
    <div className="flex justify-between text-xs items-center">
      <span className="text-slate-500">Join Window:</span>
      {effectivelyExpired || (secondsRemaining !== null && secondsRemaining <= 0) ? (
        <span className="text-rose-400 font-semibold bg-rose-950/60 border border-rose-800/60 px-2 py-0.5 rounded text-[11px]">
          Join window expired
        </span>
      ) : (
        <span className="font-mono font-bold text-teal-400 flex items-center gap-1.5">
          <Clock className="w-3 h-3 text-teal-400 animate-pulse" />
          <span>Time remaining to join: {formatted}</span>
        </span>
      )}
    </div>
  );
}
