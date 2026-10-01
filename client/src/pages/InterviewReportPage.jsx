import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { api } from '../services/api';
import { PROBLEMS } from '../data/problems';
import { 
  FileText, 
  Printer, 
  ArrowLeft, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  User, 
  ShieldCheck, 
  Code2, 
  Award, 
  Sliders, 
  Loader2, 
  AlertCircle,
  Download
} from 'lucide-react';

export default function InterviewReportPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const storedRole = localStorage.getItem(`codemeet_role_${roomId}`);
  const role = location.state?.role || storedRole || 'candidate';
  const isInterviewer = role === 'interviewer';

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);

  useEffect(() => {
    async function fetchReport() {
      try {
        setIsLoading(true);
        const res = await api.getReport(roomId, role);
        if (res.success && res.report) {
          setReport(res.report);
        } else {
          setError(res.message || 'Interview report not found.');
        }
      } catch (err) {
        console.error('Error fetching report:', err);
        setError(err.response?.data?.message || 'Failed to load interview report.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchReport();
  }, [roomId, role]);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-500 mb-3" />
        <p className="text-sm text-slate-300 font-medium">Generating Interview Report...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Report Unavailable</h2>
        <p className="text-sm text-slate-400 mb-6">{error || 'Unable to retrieve report details.'}</p>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
        >
          Return to Home
        </button>
      </div>
    );
  }

  const problem = PROBLEMS.find((p) => p.id === report.problemId) || PROBLEMS[0];
  const submission = report.submission;
  const finalCode = submission?.code || report.code || '// No code submitted during this session';
  const finalLang = submission?.language || report.language || 'python';
  const finalDate = report.completedAt ? new Date(report.completedAt) : new Date(report.createdAt);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-10 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Actions (Hidden in Print) */}
        <div className="flex items-center justify-between no-print">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Home</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition-all"
          >
            <Printer className="w-4 h-4" />
            <span>Print / Download PDF</span>
          </button>
        </div>

        {/* Report Document Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-10 shadow-2xl space-y-8 report-card">
          {/* Header */}
          <div className="border-b border-slate-800 pb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl font-extrabold tracking-tight text-white">
                  CodeMeet
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800">
                  Interview Report
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Official technical assessment summary and evaluation record.
              </p>
            </div>

            <div className="flex flex-col sm:items-end text-xs text-slate-400 space-y-1">
              <div className="flex items-center gap-1.5 font-mono text-slate-300">
                <span className="text-slate-500 uppercase text-[10px]">Session ID:</span>
                <span className="font-bold text-indigo-400">{report.id}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>{finalDate.toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
                <Clock className="w-3.5 h-3.5 text-slate-500 ml-1" />
                <span>{finalDate.toLocaleTimeString(undefined, { timeStyle: 'short' })}</span>
              </div>
              <div className="pt-1">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" />
                  Status: {report.status === 'completed' ? 'Completed' : 'Concluded'}
                </span>
              </div>
            </div>
          </div>

          {/* Participant Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                Candidate Name
              </div>
              <div className="text-base font-bold text-white">
                {report.candidateName}
              </div>
            </div>

            <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 mb-1 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
                Interviewer Name
              </div>
              <div className="text-base font-bold text-white">
                {report.interviewerName}
              </div>
            </div>
          </div>

          {/* Problem Attempted */}
          <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
                Problem Attempted
              </h3>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {problem.difficulty} &bull; {problem.category}
              </span>
            </div>
            <div className="text-base font-bold text-white">{problem.title}</div>
            <p className="text-xs text-slate-300 leading-relaxed">{problem.description}</p>
          </div>

          {/* Final Submitted Code */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Code2 className="w-4 h-4 text-indigo-400" />
                Final Submitted Code ({finalLang.toUpperCase()}):
              </span>
              {submission?.submittedAt && (
                <span className="text-slate-500 font-mono text-[11px]">
                  Submitted at: {new Date(submission.submittedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
            <pre className="bg-slate-950 border border-slate-800 p-4 rounded-xl font-mono text-xs text-slate-200 overflow-x-auto leading-relaxed max-h-96">
              <code>{finalCode}</code>
            </pre>
          </div>

          {/* Execution & Test Results */}
          <div className="bg-slate-950/60 p-5 rounded-xl border border-slate-800 space-y-3">
            <h3 className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
              Execution & Test Verification Results
            </h3>

            {submission?.executionResult ? (
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-300">Status:</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20">
                    {submission.executionResult.status?.description || 'Executed'}
                  </span>
                  {submission.executionResult.time && (
                    <span className="text-slate-400">
                      Time: {submission.executionResult.time}
                    </span>
                  )}
                  {submission.executionResult.memory && (
                    <span className="text-slate-400">
                      Memory: {submission.executionResult.memory}
                    </span>
                  )}
                </div>

                {submission.executionResult.stdout && (
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
                      Program Output:
                    </span>
                    <pre className="text-emerald-400 font-mono">
                      {submission.executionResult.stdout}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                Execution test records: Candidate completed sandbox verification for the challenge.
              </p>
            )}
          </div>

          {/* Interviewer Evaluation (Role-Protected) */}
          {report.privateNotes ? (
            <div className="bg-indigo-950/20 border border-indigo-900/50 p-6 rounded-xl space-y-5">
              <div className="flex items-center justify-between border-b border-indigo-900/40 pb-3">
                <div className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Interviewer Assessment & Ratings
                  </h3>
                </div>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-indigo-900/40 text-indigo-300 border border-indigo-700/50">
                  Confidential Internal Evaluation
                </span>
              </div>

              {/* Ratings Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-950/70 p-3.5 rounded-lg border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Communication:</span>
                  <span className="text-lg font-extrabold text-indigo-300 font-mono">
                    {report.privateNotes.communicationRating || 0} / 5
                  </span>
                </div>

                <div className="bg-slate-950/70 p-3.5 rounded-lg border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Problem Solving:</span>
                  <span className="text-lg font-extrabold text-indigo-300 font-mono">
                    {report.privateNotes.problemSolvingRating || 0} / 5
                  </span>
                </div>

                <div className="bg-slate-950/70 p-3.5 rounded-lg border border-slate-800">
                  <span className="text-xs text-slate-400 block mb-1">Technical Knowledge:</span>
                  <span className="text-lg font-extrabold text-indigo-300 font-mono">
                    {report.privateNotes.technicalRating || 0} / 5
                  </span>
                </div>
              </div>

              {/* Overall Score */}
              <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block">Overall Performance Score:</span>
                  <span className="text-xs text-slate-500">Evaluated on a scale from 0 to 10</span>
                </div>
                <div className="text-3xl font-extrabold text-indigo-400 font-mono">
                  {report.privateNotes.overallScore || 0}
                  <span className="text-sm text-slate-500 font-normal"> / 10</span>
                </div>
              </div>

              {/* Comments */}
              {report.privateNotes.comments && (
                <div className="bg-slate-950/70 p-4 rounded-lg border border-slate-800 space-y-1.5">
                  <span className="text-xs font-semibold text-slate-300 block">
                    Interviewer Observations & Detailed Comments:
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {report.privateNotes.comments}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-950/50 border border-slate-800 text-center text-xs text-slate-500 italic">
              Detailed interviewer ratings and private notes are restricted to authorized reviewers.
            </div>
          )}

          {/* Footer inside report */}
          <div className="pt-6 border-t border-slate-800 text-center text-xs text-slate-500">
            CodeMeet Technical Interview Sandbox &bull; Verified Evaluation Record
          </div>
        </div>
      </div>
    </div>
  );
}
