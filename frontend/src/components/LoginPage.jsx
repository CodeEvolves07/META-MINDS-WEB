import React, { useState, useEffect } from "react";
import { 
  Code2, 
  ShieldCheck, 
  UserCheck, 
  ArrowRight, 
  Sparkles, 
  Copy, 
  Check, 
  Lock, 
  KeyRound, 
  Video, 
  Wifi, 
  Terminal, 
  AlertCircle,
  Share2,
  CheckCircle2,
  ExternalLink
} from "lucide-react";
import { createInterviewerSession, verifyCandidateCode, loginUser } from "../services/api";

export function LoginPage({ onLoginSuccess, defaultRoomId = "", defaultRole = "interviewer" }) {
  // Check URL query parameters for prefilled code or role
  const queryParams = new URLSearchParams(window.location.search);
  const urlCode = queryParams.get("code") || "";
  const urlRole = queryParams.get("role") || (urlCode ? "candidate" : defaultRole);

  const [role, setRole] = useState(urlRole);
  
  // Interviewer Form State
  const [interviewerName, setInterviewerName] = useState("Alex (Lead Engineer)");
  const [customRoomId, setCustomRoomId] = useState("");
  const [generatedCode, setGeneratedCode] = useState(null); // { roomId, candidateCode }
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Candidate Form State
  const [candidateName, setCandidateName] = useState("Morgan (Candidate)");
  const [candidateCodeInput, setCandidateCodeInput] = useState(urlCode);

  // Status State
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleRoleToggle = (selectedRole) => {
    setRole(selectedRole);
    setErrorMessage("");
  };

  // Interviewer: Generates unique candidate access code via backend
  const handleInterviewerSubmit = async (e) => {
    e.preventDefault();
    if (!interviewerName.trim()) {
      setErrorMessage("Please enter your name as the interviewer.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const data = await createInterviewerSession({
        interviewerName: interviewerName.trim(),
        customRoomId: customRoomId.trim()
      });

      // Save generated candidate code to show to interviewer
      setGeneratedCode({
        roomId: data.roomId,
        candidateCode: data.candidateCode,
        interviewerName: data.user.username,
        role: "interviewer"
      });
    } catch (err) {
      setErrorMessage(err.message || "Failed to create interviewer session.");
    } finally {
      setIsLoading(false);
    }
  };

  // Interviewer: Enters the room after seeing the generated code
  const handleEnterAsInterviewer = () => {
    if (!generatedCode) return;
    onLoginSuccess({
      role: "interviewer",
      username: generatedCode.interviewerName,
      roomId: generatedCode.roomId,
      candidateCode: generatedCode.candidateCode
    });
  };

  // Candidate: Verifies code and enters room
  const handleCandidateSubmit = async (e) => {
    e.preventDefault();
    if (!candidateName.trim()) {
      setErrorMessage("Please enter your name.");
      return;
    }
    if (!candidateCodeInput.trim()) {
      setErrorMessage("Please enter the unique interview code provided by your interviewer.");
      return;
    }

    setIsLoading(true);
    setErrorMessage("");

    try {
      const data = await verifyCandidateCode({
        candidateCode: candidateCodeInput.trim(),
        candidateName: candidateName.trim()
      });

      onLoginSuccess({
        role: "candidate",
        username: data.user.username,
        roomId: data.roomId,
        candidateCode: data.candidateCode
      });
    } catch (err) {
      setErrorMessage(err.message || "Invalid or expired interview code. Please verify with your interviewer.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (!generatedCode) return;
    navigator.clipboard.writeText(generatedCode.candidateCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  const handleCopyInviteLink = () => {
    if (!generatedCode) return;
    const url = `${window.location.origin}${window.location.pathname}?code=${generatedCode.candidateCode}&role=candidate`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  return (
    <div className="min-h-screen w-screen bg-[#070b14] text-slate-100 flex flex-col justify-between overflow-x-hidden font-sans relative selection:bg-blue-600 selection:text-white">
      {/* Background Neon Ambient Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Top Navbar */}
      <header className="h-16 border-b border-slate-800/80 px-6 flex items-center justify-between z-20 backdrop-blur-md bg-slate-950/40">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/25">
            <Code2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              Remote Technical Interview Sandbox
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                P2P Live
              </span>
            </h1>
            <p className="text-[11px] text-slate-400">WebRTC Audio &amp; Judge0 Cloud Run</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center space-x-4 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span>&lt;100ms P2P WebRTC</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Judge0 Cloud Compiler</span>
          </div>
        </div>
      </header>

      {/* Main Authentication Card */}
      <main className="flex-1 flex items-center justify-center p-4 z-10 my-6">
        <div className="w-full max-w-lg bg-slate-900/85 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 sm:p-9 shadow-2xl space-y-6">
          
          {/* Header Title */}
          <div className="text-center space-y-1.5">
            <h2 className="text-2xl font-bold text-slate-100 tracking-tight">
              Technical Interview Portal
            </h2>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Interviewer generates a unique candidate code. Candidate enters the code to synchronize into the room.
            </p>
          </div>

          {/* Role Selection Tabs */}
          <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-semibold">
            <button
              type="button"
              onClick={() => { handleRoleToggle("interviewer"); setGeneratedCode(null); }}
              className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
                role === "interviewer"
                  ? "bg-purple-600 text-white shadow-lg shadow-purple-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Log in as Interviewer</span>
            </button>

            <button
              type="button"
              onClick={() => { handleRoleToggle("candidate"); setGeneratedCode(null); }}
              className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
                role === "candidate"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>Log in as Candidate</span>
            </button>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ---------------- 1. INTERVIEWER VIEW ---------------- */}
          {role === "interviewer" && (
            <div className="space-y-5">
              {!generatedCode ? (
                /* Interviewer Setup Form */
                <form onSubmit={handleInterviewerSubmit} className="space-y-4 text-xs">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-300">Interviewer Display Name</label>
                    <input
                      type="text"
                      value={interviewerName}
                      onChange={(e) => setInterviewerName(e.target.value)}
                      placeholder="e.g. Alex (Lead Software Engineer)"
                      className="w-full bg-slate-950 text-slate-200 px-4 py-3 rounded-xl border border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-600 font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-slate-300">Custom Room Identifier (Optional)</label>
                      <span className="text-[10px] text-slate-500 font-mono">Auto-generated if blank</span>
                    </div>
                    <input
                      type="text"
                      value={customRoomId}
                      onChange={(e) => setCustomRoomId(e.target.value)}
                      placeholder="e.g. google-l5-interview"
                      className="w-full bg-slate-950 font-mono text-slate-200 px-4 py-3 rounded-xl border border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-slate-600"
                    />
                  </div>

                  <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/40 text-purple-300 text-[11px] leading-relaxed">
                    ✨ Submitting will create a live interview session and generate a <strong>Unique 6-Character Candidate Access Code</strong> for your candidate to join.
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition-all active:scale-98"
                  >
                    {isLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Generating Candidate Code...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Create Session &amp; Generate Candidate Code</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              ) : (
                /* Generated Code Display Card */
                <div className="space-y-5 animate-fadeIn">
                  <div className="p-5 rounded-2xl bg-purple-950/30 border border-purple-500/50 space-y-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-purple-300 uppercase tracking-wider">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Interview Room Created Successfully!</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-xs text-slate-400">Share this Unique Code with the Candidate:</span>
                      <div className="text-3xl font-extrabold font-mono tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-pink-300 to-cyan-300 py-1">
                        {generatedCode.candidateCode}
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Room ID: {generatedCode.roomId}
                      </span>
                    </div>

                    {/* Copy Buttons */}
                    <div className="flex flex-col sm:flex-row gap-2 pt-1 text-xs">
                      <button
                        type="button"
                        onClick={handleCopyCode}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-500/40 font-semibold transition-all flex items-center justify-center gap-2"
                      >
                        {copiedCode ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                        <span>{copiedCode ? "Code Copied!" : "Copy Code"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleCopyInviteLink}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold transition-all flex items-center justify-center gap-2"
                      >
                        {copiedLink ? <Check className="w-4 h-4 text-emerald-300" /> : <Share2 className="w-4 h-4 text-cyan-400" />}
                        <span>{copiedLink ? "Link Copied!" : "Copy Invite Link"}</span>
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 text-center leading-relaxed">
                    Once the candidate logs in with code <strong className="text-purple-300 font-mono">{generatedCode.candidateCode}</strong>, both of you will enter this room together in real-time.
                  </p>

                  <button
                    type="button"
                    onClick={handleEnterAsInterviewer}
                    className="w-full py-3.5 rounded-xl font-bold text-white bg-purple-600 hover:bg-purple-500 shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2 transition-all active:scale-98"
                  >
                    <span>Enter Interview Room as Interviewer</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ---------------- 2. CANDIDATE VIEW ---------------- */}
          {role === "candidate" && (
            <form onSubmit={handleCandidateSubmit} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-300">Candidate Full Name</label>
                <input
                  type="text"
                  value={candidateName}
                  onChange={(e) => setCandidateName(e.target.value)}
                  placeholder="e.g. Morgan (Software Engineer)"
                  className="w-full bg-slate-950 text-slate-200 px-4 py-3 rounded-xl border border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-600 font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-cyan-400" />
                    <span>Unique Interview Code</span>
                  </label>
                  <span className="text-[10px] text-cyan-400 font-mono">Given by Interviewer</span>
                </div>
                <input
                  type="text"
                  value={candidateCodeInput}
                  onChange={(e) => setCandidateCodeInput(e.target.value.toUpperCase())}
                  placeholder="e.g. INT-8492"
                  className="w-full bg-slate-950 font-mono text-center text-lg tracking-widest font-bold text-cyan-300 px-4 py-3 rounded-xl border border-slate-700/80 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-600 uppercase"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-800/40 text-blue-300 text-[11px] leading-relaxed">
                🔑 Enter the unique access code sent by your interviewer. You will immediately enter the live coding sandbox with audio/video pairing.
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all active:scale-98"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying Code &amp; Joining...</span>
                  </>
                ) : (
                  <>
                    <span>Enter Interview Room as Candidate</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Quick Demo Previews */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
            <span>Room Code Mode: Active</span>
            <button
              type="button"
              onClick={() => {
                onLoginSuccess({
                  role: "interviewer",
                  username: "Alex (Lead Engineer)",
                  roomId: "room-101",
                  candidateCode: "INT-101"
                });
              }}
              className="text-purple-400 hover:text-purple-300 transition-colors"
            >
              1-Click Demo Sandbox &rarr;
            </button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="h-10 border-t border-slate-800/80 px-6 flex items-center justify-between text-[11px] text-slate-500 z-10">
        <span>MetaMinds Peer-to-Peer Technical Interview Platform</span>
        <span>Unique Code Handshake • Zero Server Dependency</span>
      </footer>
    </div>
  );
}
