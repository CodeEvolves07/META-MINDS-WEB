import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { 
  ArrowLeft, 
  User, 
  Hash, 
  LogIn, 
  Loader2, 
  AlertCircle,
  Video
} from 'lucide-react';

export default function JoinInterviewPage() {
  const navigate = useNavigate();

  const [candidateName, setCandidateName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanRoomId = roomId.trim().toUpperCase();
    const cleanName = candidateName.trim();

    if (!cleanName) {
      setError('Please enter your name.');
      return;
    }
    if (!cleanRoomId) {
      setError('Please enter the Interview ID.');
      return;
    }

    try {
      setIsSubmitting(true);
      // Join interview room and receive signed candidate authentication token
      const res = await api.joinInterview(cleanRoomId, cleanName);

      if (res.success && res.interview) {
        // Save candidate role, name, and token in localStorage for this room
        localStorage.setItem(`codemeet_role_${cleanRoomId}`, 'candidate');
        localStorage.setItem(`codemeet_user_${cleanRoomId}`, cleanName);
        if (res.token) {
          localStorage.setItem(`codemeet_token_${cleanRoomId}`, res.token);
        }

        navigate(`/interview/${cleanRoomId}`, {
          state: {
            role: 'candidate',
            userName: cleanName,
            problemId: res.interview.problemId,
            token: res.token
          }
        });
      } else {
        setError('Interview room not found.');
      }
    } catch (err) {
      console.error(err);
      if (err.response?.status === 404) {
        setError('Interview room not found.');
      } else {
        setError(err.response?.data?.message || 'Interview room not found.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-12 text-slate-100">
      <div className="w-full max-w-md">
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
          <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl pointer-events-none"></div>

          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-teal-600/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <Video className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Join Interview</h2>
              <p className="text-xs text-slate-400">
                Enter your name and the Interview ID provided by the interviewer.
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
                <User className="w-3.5 h-3.5 text-teal-400" />
                Candidate Name:
              </label>
              <input
                type="text"
                required
                value={candidateName}
                onChange={(e) => setCandidateName(e.target.value)}
                placeholder="e.g. Sarah Williams"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-indigo-400" />
                Interview ID:
              </label>
              <input
                type="text"
                required
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="e.g. ABC123"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 uppercase font-mono tracking-wider placeholder-slate-600 focus:outline-none focus:border-teal-500 transition-colors"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold text-sm transition-all shadow-lg shadow-teal-700/30 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Validating Room ID...</span>
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Join Interview Room</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
