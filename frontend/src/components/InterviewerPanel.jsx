import React, { useState } from "react";
import { 
  ShieldAlert, 
  Search, 
  Send, 
  Star, 
  Lock, 
  Check, 
  Eye, 
  Save, 
  Award,
  Sparkles,
  BookOpen,
  Filter
} from "lucide-react";
import { PROBLEMS } from "../data/problems";

export function InterviewerPanel({
  activeProblemId,
  onInjectProblem,
  scorecard,
  onUpdateScorecard,
  onSaveScorecard,
  isSaved
}) {
  const [tab, setTab] = useState("library"); // 'library' | 'scorecard'
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("all");

  const filteredProblems = PROBLEMS.filter((p) => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesDiff = filterDifficulty === "all" || p.difficulty.toLowerCase() === filterDifficulty.toLowerCase();
    return matchesSearch && matchesDiff;
  });

  const renderStars = (category, currentVal) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onUpdateScorecard({ ...scorecard, [category]: star })}
            className={`p-1 transition-colors ${
              star <= (currentVal || 0)
                ? "text-amber-400 hover:text-amber-300"
                : "text-slate-600 hover:text-slate-400"
            }`}
          >
            <Star className="w-4 h-4 fill-current" />
          </button>
        ))}
        <span className="text-xs text-slate-400 ml-1.5 font-mono">
          {currentVal ? `${currentVal}/5` : "-"}
        </span>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-slate-900/90 border-r border-slate-800 text-slate-200 select-none">
      {/* Privacy Notice Banner */}
      <div className="bg-purple-950/40 border-b border-purple-800/40 px-3 py-1.5 flex items-center justify-between text-[11px] text-purple-300 font-medium">
        <div className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-purple-400" />
          <span>Interviewer-Only Workspace (Hidden from Candidate)</span>
        </div>
        <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
      </div>

      {/* Tabs Header */}
      <div className="flex border-b border-slate-800 bg-slate-950/40 text-xs">
        <button
          onClick={() => setTab("library")}
          className={`flex-1 py-2 px-3 flex items-center justify-center gap-1.5 font-medium transition-colors ${
            tab === "library"
              ? "text-purple-400 border-b-2 border-purple-500 bg-purple-500/10"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Problem Library</span>
        </button>
        <button
          onClick={() => setTab("scorecard")}
          className={`flex-1 py-2 px-3 flex items-center justify-center gap-1.5 font-medium transition-colors ${
            tab === "scorecard"
              ? "text-purple-400 border-b-2 border-purple-500 bg-purple-500/10"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <Award className="w-3.5 h-3.5" />
          <span>Private Scorecard</span>
        </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {tab === "library" ? (
          <div className="space-y-3">
            {/* Search & Filter Bar */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search challenges by title or tag..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 text-xs pl-8 pr-3 py-1.5 rounded-lg border border-slate-700/80 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>

              <div className="flex gap-1">
                {["all", "easy", "medium", "hard"].map((diff) => (
                  <button
                    key={diff}
                    onClick={() => setFilterDifficulty(diff)}
                    className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded capitalize transition-all ${
                      filterDifficulty === diff
                        ? "bg-purple-600 text-white"
                        : "bg-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            {/* Problem List Cards */}
            <div className="space-y-2 pt-1">
              {filteredProblems.map((prob) => {
                const isActive = prob.id === activeProblemId;
                return (
                  <div
                    key={prob.id}
                    className={`p-3 rounded-lg border transition-all ${
                      isActive
                        ? "bg-purple-950/20 border-purple-500/60 ring-1 ring-purple-500/30"
                        : "bg-slate-800/40 border-slate-700/60 hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            prob.difficulty === "Easy"
                              ? "bg-emerald-500/20 text-emerald-400"
                              : prob.difficulty === "Medium"
                              ? "bg-amber-500/20 text-amber-400"
                              : "bg-rose-500/20 text-rose-400"
                          }`}>
                            {prob.difficulty}
                          </span>
                          <span className="text-xs font-semibold text-slate-100">{prob.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                          {prob.description.replace(/[#*`]/g, '')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-800">
                      <div className="flex gap-1 flex-wrap">
                        {prob.tags.slice(0, 2).map((t, idx) => (
                          <span key={idx} className="text-[9px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded">
                            {t}
                          </span>
                        ))}
                      </div>

                      <button
                        onClick={() => onInjectProblem(prob.id)}
                        disabled={isActive}
                        className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded transition-all ${
                          isActive
                            ? "bg-purple-900/60 text-purple-300 cursor-default"
                            : "bg-purple-600 hover:bg-purple-500 text-white shadow-sm"
                        }`}
                      >
                        {isActive ? (
                          <>
                            <Check className="w-3 h-3 text-purple-300" />
                            <span>Active in Room</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3 h-3" />
                            <span>Inject to Room</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* Private Scorecard Form */
          <div className="space-y-4">
            <div className="space-y-3 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <Award className="w-4 h-4" />
                Assessment Rubric
              </h4>

              {/* Rubric Criteria */}
              <div className="space-y-2.5 text-xs">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300">Problem Solving &amp; Algorithms</span>
                  </div>
                  {renderStars("problemSolving", scorecard.problemSolving)}
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300">Code Quality &amp; Cleanliness</span>
                  </div>
                  {renderStars("codeQuality", scorecard.codeQuality)}
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300">Communication &amp; Clarification</span>
                  </div>
                  {renderStars("communication", scorecard.communication)}
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300">System Design &amp; Optimization</span>
                  </div>
                  {renderStars("optimization", scorecard.optimization)}
                </div>
              </div>
            </div>

            {/* Recommendation Select */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">Hiring Recommendation</label>
              <select
                value={scorecard.recommendation || "Hire"}
                onChange={(e) => onUpdateScorecard({ ...scorecard, recommendation: e.target.value })}
                className="w-full bg-slate-950 text-xs rounded-lg px-2.5 py-1.5 border border-slate-700 text-slate-200 focus:outline-none focus:ring-1 focus:ring-purple-500"
              >
                <option value="Strong Hire">Strong Hire (Level 5)</option>
                <option value="Hire">Hire (Meets All Standards)</option>
                <option value="Leaning Hire">Leaning Hire (Needs Minor Upskilling)</option>
                <option value="Leaning No Hire">Leaning No Hire</option>
                <option value="Strong No Hire">Strong No Hire</option>
              </select>
            </div>

            {/* Private Notes Textarea */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold text-slate-300">Private Interviewer Notes</label>
                <span className="text-[10px] text-purple-400 font-mono">Encrypted Local Buffer</span>
              </div>
              <textarea
                rows={6}
                placeholder="Candidate walked through edge case testing well. Clean recursion but missed off-by-one constraint initially..."
                value={scorecard.notes || ""}
                onChange={(e) => onUpdateScorecard({ ...scorecard, notes: e.target.value })}
                className="w-full bg-slate-950 text-xs rounded-lg p-2.5 border border-slate-700 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-purple-500 font-sans"
              />
            </div>

            {/* Save Button */}
            <button
              onClick={onSaveScorecard}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-all shadow-md active:scale-98"
            >
              {isSaved ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>Evaluation Saved to Dossier</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Evaluation to Session Dossier</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
