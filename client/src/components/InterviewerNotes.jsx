import React, { useState } from 'react';
import { 
  Lock, 
  Star, 
  Save, 
  Check, 
  ShieldCheck, 
  Sliders,
  MessageSquare
} from 'lucide-react';

export default function InterviewerNotes({
  notes,
  onChangeNotes,
  onSaveNotes,
  isSaving
}) {
  const [justSaved, setJustSaved] = useState(false);

  const handleRatingClick = (category, value) => {
    onChangeNotes({
      ...notes,
      [category]: value
    });
  };

  const handleSave = async () => {
    await onSaveNotes();
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const renderRatingBar = (label, categoryKey, currentValue) => {
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300 font-medium">{label}</span>
          <span className="text-indigo-400 font-bold font-mono">
            {currentValue > 0 ? `${currentValue} / 5` : 'Not Rated'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4, 5].map((val) => (
            <button
              key={val}
              type="button"
              onClick={() => handleRatingClick(categoryKey, val)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                currentValue >= val
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm shadow-indigo-600/30'
                  : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              {val}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg select-none">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <Lock className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Private Interviewer Notes
            </h3>
            <p className="text-[10px] text-amber-400/90 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              Confidential • Never visible to candidate
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 rounded-md text-xs font-medium border border-slate-700 transition-all disabled:opacity-50"
        >
          {justSaved ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400 text-[11px]">Saved</span>
            </>
          ) : (
            <>
              <Save className="w-3 h-3 text-indigo-400" />
              <span className="text-[11px]">{isSaving ? 'Saving...' : 'Save'}</span>
            </>
          )}
        </button>
      </div>

      {/* Evaluation Controls */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Rating 1: Communication */}
        {renderRatingBar('Communication', 'communicationRating', notes.communicationRating)}

        {/* Rating 2: Problem Solving */}
        {renderRatingBar('Problem Solving', 'problemSolvingRating', notes.problemSolvingRating)}

        {/* Rating 3: Technical Knowledge */}
        {renderRatingBar('Technical Knowledge', 'technicalRating', notes.technicalRating)}

        {/* Overall Score (0 - 10) */}
        <div className="space-y-1.5 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-300 font-semibold flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              Overall Score:
            </span>
            <span className="text-sm font-extrabold text-indigo-400 font-mono">
              {notes.overallScore} / 10
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="10"
            step="1"
            value={notes.overallScore}
            onChange={(e) =>
              onChangeNotes({ ...notes, overallScore: Number(e.target.value) })
            }
            className="w-full h-1.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <div className="flex justify-between text-[10px] text-slate-500 font-mono px-0.5">
            <span>0</span>
            <span>2</span>
            <span>4</span>
            <span>6</span>
            <span>8</span>
            <span>10</span>
          </div>
        </div>

        {/* Qualitative Comments */}
        <div className="space-y-1.5 pt-2 border-t border-slate-800/80 flex flex-col flex-1">
          <label className="text-slate-300 font-semibold flex items-center gap-1 text-xs">
            <MessageSquare className="w-3.5 h-3.5 text-indigo-400" />
            Interviewer Comments & Observations:
          </label>
          <textarea
            value={notes.comments}
            onChange={(e) => onChangeNotes({ ...notes, comments: e.target.value })}
            placeholder="Record candidate's code structuring, grasp of time complexity, responsiveness to hints, edge case coverage..."
            rows={5}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
}
