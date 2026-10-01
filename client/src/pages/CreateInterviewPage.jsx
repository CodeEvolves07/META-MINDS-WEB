import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { PROBLEMS } from '../data/problems';
import { 
  Code2, 
  ArrowLeft, 
  Copy, 
  Check, 
  Sparkles, 
  User, 
  Briefcase, 
  BookOpen, 
  ChevronRight,
  Loader2,
  AlertCircle
} from 'lucide-react';

export default function CreateInterviewPage() {
  const navigate = useNavigate();

  const [interviewerName, setInterviewerName] = useState('');
  const [candidateName, setCandidateName] = useState('');
  const [problemId, setProblemId] = useState(PROBLEMS[0].id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Post-creation modal state
  const [createdRoom, setCreatedRoom] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!interviewerName.trim()) {
      setError('Please enter your name as the Interviewer.');
      return;
    }
    if (!candidateName.trim()) {
      setError('Please enter the Candidate\'s name.');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.createInterview({
        interviewerName: interviewerName.trim(),
        candidateName: candidateName.trim()
      });

      if (res.success && res.interview) {
        // Save session details to localStorage for user role persistence
        localStorage.setItem(`codemeet_role_${res.interview.id}`, 'interviewer');
        localStorage.setItem(`codemeet_user_${res.interview.id}`, interviewerName.trim());
        if (res.token) {
          localStorage.setItem(`codemeet_token_${res.interview.id}`, res.token);
        }

        setCreatedRoom(res.interview);
      } else {
        setError(res.message || 'Failed to create interview session.');
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Network error while creating interview.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopy = () => {
    if (!createdRoom) return;
    navigator.clipboard.writeText(createdRoom.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEnterRoom = () => {
    if (!createdRoom) return;
    const token = localStorage.getItem(`codemeet_token_${createdRoom.id}`);
    navigate(`/interview/${createdRoom.id}`, {
      state: {
        role: 'interviewer',
        userName: interviewerName.trim(),
        problemId: createdRoom.problemId,
        token
      }
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12 text-slate-100">
      <div className="w-full max-w-lg">
        {/* Back Link */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </button>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Subtle gradient glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none"></div>

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Create Interview</h2>
              <p className="text-xs text-slate-400">
                Setup a synchronized interview sandbox room with WebRTC & code execution.
              </p>
            </div>
          </div>

          {/* Error Notice */}
          {error && (
            <div className="mb-6 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-400" />
                Interviewer Name:
              </label>
              <input
                type="text"
                required
                value={interviewerName}
                onChange={(e) => setInterviewerName(e.target.value)}
                placeholder="e.g. Alex Johnson (Lead Engineer)"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                Candidate Name:
              </label>
              <input
                type="text"
                required
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="e.g. Sarah Williams"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
              <div className="flex items-center gap-2 mb-1">
                <BookOpen className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-semibold text-slate-200">Per-Candidate Question Assignment</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Questions are selected and assigned individually for each candidate after they join the interview room. No question is automatically pre-assigned.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-lg shadow-indigo-600/30 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Creating Sandbox Session...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Create Interview Room</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Room Created Modal */}
      {createdRoom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <Check className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-white mb-1">Interview Room Created!</h3>
              <p className="text-xs text-slate-400">
                Share this unique Interview ID with candidate <span className="text-indigo-400 font-semibold">{createdRoom.candidateName}</span>.
              </p>
            </div>

            {/* Room ID box */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
              <div className="text-left">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                  Interview ID:
                </span>
                <span className="text-2xl font-mono font-extrabold text-white tracking-widest">
                  {createdRoom.id}
                </span>
              </div>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-all shadow-md shadow-indigo-600/20"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy ID</span>
                  </>
                )}
              </button>
            </div>

            <button
              onClick={handleEnterRoom}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-700/30"
            >
              <span>Enter Interview Room</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
