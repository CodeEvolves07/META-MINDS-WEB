import React, { useState } from 'react';
import { 
  CheckSquare, 
  Lightbulb, 
  Clock, 
  Edit3, 
  HelpCircle, 
  Code 
} from 'lucide-react';

export default function CandidateGuidance() {
  const [checklist, setChecklist] = useState([
    { id: 1, text: 'Read problem statement & identify inputs/outputs', done: true },
    { id: 2, text: 'Discuss approach & time/space complexity', done: false },
    { id: 3, text: 'Consider edge cases (empty input, negatives, bounds)', done: false },
    { id: 4, text: 'Write modular and clean solution', done: false },
    { id: 5, text: 'Run code & test with sample cases', done: false },
  ]);

  const [scratchpad, setScratchpad] = useState('');

  const toggleCheck = (id) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item
      )
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg select-none">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Interview Workspace
          </h3>
        </div>
        <span className="text-[11px] font-medium text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
          Candidate View
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Checklist */}
        <div>
          <h4 className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
            <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
            Interview Checklist:
          </h4>
          <div className="space-y-1.5 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
            {checklist.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-2 cursor-pointer text-slate-300 hover:text-white transition-colors"
              >
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={() => toggleCheck(item.id)}
                  className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span className={item.done ? 'line-through text-slate-500' : ''}>
                  {item.text}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Tips for candidate */}
        <div className="bg-indigo-950/20 border border-indigo-900/40 p-3 rounded-lg text-indigo-200 space-y-1.5">
          <div className="font-semibold text-xs flex items-center gap-1.5 text-indigo-300">
            <HelpCircle className="w-3.5 h-3.5" />
            Tips for Success:
          </div>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-300 leading-relaxed">
            <li>Talk out loud while typing to share your thought process.</li>
            <li>Don't hesitate to ask your interviewer for clarification on edge cases.</li>
            <li>You can run your code multiple times before final submission.</li>
          </ul>
        </div>

        {/* Scratchpad */}
        <div className="flex flex-col flex-1 space-y-1.5 pt-1">
          <label className="text-slate-300 font-semibold flex items-center gap-1 text-xs">
            <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
            Personal Scratchpad:
          </label>
          <textarea
            value={scratchpad}
            onChange={(e) => setScratchpad(e.target.value)}
            placeholder="Jot down rough notes, pseudocode, or thoughts here..."
            rows={5}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none leading-relaxed"
          />
        </div>
      </div>
    </div>
  );
}
