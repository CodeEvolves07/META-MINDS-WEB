import React from 'react';
import { PhoneOff, AlertTriangle, X, CheckCircle, ShieldAlert } from 'lucide-react';

export default function EndInterviewModal({
  isOpen,
  onClose,
  onConfirm,
  isInterviewer,
  notes,
  isEnding
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {isInterviewer ? 'End Technical Interview?' : 'Leave Interview Room?'}
              </h3>
              <p className="text-xs text-slate-400">
                {isInterviewer
                  ? 'This will complete the session and generate the final interview report.'
                  : 'You will disconnect from the audio/video call and code editor.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Preview */}
        {isInterviewer && (
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80 space-y-2 text-xs">
            <div className="font-semibold text-slate-300 flex items-center justify-between">
              <span>Overall Score Recorded:</span>
              <span className="text-indigo-400 font-mono font-bold">
                {notes?.overallScore || 0} / 10
              </span>
            </div>
            <div className="text-slate-400 text-[11px] leading-relaxed">
              Once ended, the candidate will be redirected to their completion screen, and you will receive the full evaluative report.
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isEnding}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isEnding}
            className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold transition-all shadow-lg shadow-rose-900/40 disabled:opacity-50"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            <span>{isEnding ? 'Ending Session...' : isInterviewer ? 'Yes, End Interview' : 'Leave Room'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
