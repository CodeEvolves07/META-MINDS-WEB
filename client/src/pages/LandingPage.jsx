import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Code2, 
  Video, 
  Terminal, 
  ShieldCheck, 
  FileText, 
  Users, 
  ArrowRight, 
  Zap, 
  CheckCircle,
  Play
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-between text-slate-100 selection:bg-indigo-600 selection:text-white">
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex items-center justify-between max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-600/30">
            <Code2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent">
              CodeMeet
            </span>
            <span className="hidden sm:inline-block ml-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-400 border border-indigo-800/60">
              Technical Interview Sandbox
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/join')}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-slate-800"
          >
            Join with ID
          </button>
          <button
            onClick={() => navigate('/create')}
            className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all shadow-md shadow-indigo-600/30"
          >
            Create Interview
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center max-w-5xl mx-auto">
        {/* Hackathon Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-950/60 border border-indigo-800/60 text-indigo-300 text-xs font-medium mb-8 animate-fadeIn">
          <Zap className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          <span>Remote Technical Interview Sandbox with WebRTC Audio & Code Run</span>
        </div>

        {/* Title & Subtitle */}
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white max-w-4xl leading-tight sm:leading-none mb-6">
          The all-in-one sandbox for{' '}
          <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
            technical interviews
          </span>
        </h1>

        <p className="text-base sm:text-lg text-slate-400 max-w-2xl mb-10 leading-relaxed font-normal">
          Conduct technical interviews with real-time video, collaborative coding, code execution and interviewer evaluation in one platform.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto mb-16">
          <button
            onClick={() => navigate('/create')}
            className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition-all shadow-xl shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>Create Interview</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => navigate('/join')}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-sm border border-slate-700 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Users className="w-4 h-4 text-slate-400" />
            <span>Join Interview</span>
          </button>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full text-left">
          {/* Card 1 */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 hover:border-slate-700 transition-all">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-4">
              <Video className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">WebRTC Video & Audio</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              True 1-to-1 peer-to-peer browser video and audio calling with live camera and microphone controls.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 hover:border-slate-700 transition-all">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4">
              <Code2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Monaco Code Sync</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Real-time synchronized coding powered by Monaco Editor (VS Code core) with multi-language syntax support.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 hover:border-slate-700 transition-all">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
              <Terminal className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-white mb-2">Judge0 Sandbox Run</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Execute Python, JavaScript, Java, and C++ code remotely with instant stdout, execution time, and error logs.
            </p>
          </div>
        </div>

        {/* Evaluation & Security Highlight */}
        <div className="mt-8 w-full p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 flex flex-wrap items-center justify-around gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Private Interviewer Notes (Confidential)</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span>Instant Interview Report & PDF Export</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-amber-400" />
            <span>Curated Problem Library & Test Cases</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-6 text-center text-xs text-slate-500">
        CodeMeet &bull; Remote Technical Interview Sandbox &bull; College Hackathon Edition
      </footer>
    </div>
  );
}
