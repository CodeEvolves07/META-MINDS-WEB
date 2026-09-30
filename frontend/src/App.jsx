import React, { useState, useEffect, useRef, useCallback } from "react";
import confetti from "canvas-confetti";
import { Navbar } from "./components/Navbar";
import { ProblemCard } from "./components/ProblemCard";
import { InterviewerPanel } from "./components/InterviewerPanel";
import { CodeEditor } from "./components/CodeEditor";
import { TerminalPane } from "./components/TerminalPane";
import { VideoGrid } from "./components/VideoGrid";
import { SessionReportModal } from "./components/SessionReportModal";
import { LoginPage } from "./components/LoginPage";
import { PROBLEMS } from "./data/problems";
import { getSocket } from "./services/socket";
import { WebRTCConnection, getLocalUserMedia } from "./services/webrtc";
import { runCode, saveSessionReport } from "./services/api";

export default function App() {
  // Parse query params for room and role
  const queryParams = new URLSearchParams(window.location.search);
  const paramRoom = queryParams.get("room");
  const initialRoom = paramRoom || "room-101";
  const initialRole = queryParams.get("role") || "candidate"; // 'interviewer' | 'candidate'
  const initialUser = queryParams.get("user") || (initialRole === "interviewer" ? "Alex (Lead Engineer)" : "Morgan (Candidate)");

  // Login State: if URL has ?room=, user automatically enters; otherwise shows LoginPage
  const [isLoggedIn, setIsLoggedIn] = useState(Boolean(paramRoom));

  // Room & User State
  const [roomId, setRoomId] = useState(initialRoom);
  const [role, setRole] = useState(initialRole);
  const [username, setUsername] = useState(initialUser);
  const [candidateCode, setCandidateCode] = useState(queryParams.get("code") || "");
  const [isConnected, setIsConnected] = useState(false);
  const [latency, setLatency] = useState(42);

  // Active Problem & Code State
  const [activeProblem, setActiveProblem] = useState(PROBLEMS[0]);
  const [language, setLanguage] = useState("python");
  const [code, setCode] = useState(PROBLEMS[0].starterCode.python);
  const [remoteCursors, setRemoteCursors] = useState({});
  const [isRemoteTyping, setIsRemoteTyping] = useState(false);

  // Execution & Terminal State
  const [isRunning, setIsRunning] = useState(false);
  const [terminalOutput, setTerminalOutput] = useState(null);
  const [stdin, setStdin] = useState("");
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(false);
  const [isTestingCases, setIsTestingCases] = useState(false);
  const [testResults, setTestResults] = useState({});
  const [executionHistory, setExecutionHistory] = useState([]);

  // WebRTC Audio/Video State
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [networkQuality, setNetworkQuality] = useState(null);
  const [remotePeerInfo, setRemotePeerInfo] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);

  // Interviewer Scorecard State (Private)
  const [scorecard, setScorecard] = useState({
    problemSolving: 4,
    codeQuality: 4,
    communication: 5,
    optimization: 4,
    recommendation: "Hire",
    notes: ""
  });
  const [isScorecardSaved, setIsScorecardSaved] = useState(false);

  // Report Modal
  const [isReportOpen, setIsReportOpen] = useState(false);

  // Left panel view for Interviewer: 'problem' or 'interviewer-tools'
  const [leftTab, setLeftTab] = useState(role === "interviewer" ? "interviewer-tools" : "problem");

  // WebRTC & Socket Refs
  const webrtcRef = useRef(null);
  const socketRef = useRef(null);
  const codeSyncTimeout = useRef(null);

  // ---------------- 1. SOCKET.IO & WEBRTC INITIALIZATION ----------------
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    // Acquire Local Media (Camera/Mic with simulated fallback)
    getLocalUserMedia(!isVideoOff, !isMuted).then(({ stream }) => {
      setLocalStream(stream);

      // Create WebRTC Connection Manager
      const webrtc = new WebRTCConnection({
        socket,
        localStream: stream,
        onRemoteStream: (rStream) => {
          console.log("[App] Remote stream received and bound to state");
          setRemoteStream(rStream);
        },
        onConnectionStateChange: (state) => {
          console.log("[App] WebRTC State:", state);
        },
        onNetworkStats: (stats) => {
          setNetworkQuality(stats);
          if (stats.rtt) setLatency(stats.rtt);
        }
      });
      webrtcRef.current = webrtc;

      // Join Room via Socket.io
      socket.emit("join-room", { roomId, role, username });
    });

    // Socket Event Handlers
    socket.on("connect", () => {
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("room-joined", (data) => {
      console.log("[Socket] Joined Room:", data);
      setIsConnected(true);
      if (data.activeProblem) setActiveProblem(data.activeProblem);
      if (data.language) setLanguage(data.language);
      if (data.code) setCode(data.code);
      if (data.terminalOutput) setTerminalOutput(data.terminalOutput);
      if (data.peers && data.peers.length > 0) {
        setRemotePeerInfo(data.peers[0]);
        // Initiator creates offer to existing peer
        if (webrtcRef.current) {
          webrtcRef.current.createOffer(data.peers[0].socketId);
        }
      }
    });

    socket.on("peer-joined", (peer) => {
      console.log("[Socket] Peer joined:", peer);
      setRemotePeerInfo(peer);
    });

    // WebRTC Signaling Events
    socket.on("signal-offer", ({ fromSocketId, sdpOffer, senderRole, senderUsername }) => {
      setRemotePeerInfo({ socketId: fromSocketId, role: senderRole, username: senderUsername });
      if (webrtcRef.current) {
        webrtcRef.current.handleOffer(fromSocketId, sdpOffer);
      }
    });

    socket.on("signal-answer", ({ sdpAnswer }) => {
      if (webrtcRef.current) {
        webrtcRef.current.handleAnswer(sdpAnswer);
      }
    });

    socket.on("signal-ice-candidate", ({ candidate }) => {
      if (webrtcRef.current) {
        webrtcRef.current.handleIceCandidate(candidate);
      }
    });

    // Remote Code Changes
    socket.on("remote-code-update", ({ code: remoteCode, role: senderRole }) => {
      setCode(remoteCode);
      setIsRemoteTyping(true);
      setTimeout(() => setIsRemoteTyping(false), 800);
    });

    // Remote Language Change
    socket.on("remote-language-update", ({ language: remoteLang, code: remoteCode }) => {
      setLanguage(remoteLang);
      if (remoteCode) setCode(remoteCode);
    });

    // Remote Cursor Positions
    socket.on("remote-cursor-update", ({ senderId, role: senderRole, username: senderUser, cursor }) => {
      setRemoteCursors((prev) => ({
        ...prev,
        [senderId]: { role: senderRole, username: senderUser, cursor }
      }));
    });

    // Problem Injected by Interviewer
    socket.on("problem-injected", ({ problem, starterCode: starter, language: probLang, injectedBy }) => {
      setActiveProblem(problem);
      if (starter) setCode(starter);
      setTerminalOutput(null);
      setTestResults({});
      console.log(`[Problem Injected by ${injectedBy}]:`, problem.title);
    });

    // Code Execution Sync
    socket.on("remote-execution-started", ({ executor, language: runLang }) => {
      setIsRunning(true);
    });

    socket.on("code-execution-complete", ({ result, executionEntry }) => {
      setIsRunning(false);
      setTerminalOutput(result);
      if (executionEntry) {
        setExecutionHistory((prev) => [executionEntry, ...prev]);
      }
    });

    // Chat Received
    socket.on("chat-received", (msg) => {
      setChatMessages((prev) => [...prev, msg]);
    });

    // Latency Ping interval
    const pingInterval = setInterval(() => {
      if (socket.connected) {
        const start = Date.now();
        socket.emit("latency-ping", start, (clientTime, serverTime) => {
          const rtt = Date.now() - clientTime;
          setLatency(Math.max(12, rtt));
        });
      }
    }, 5000);

    return () => {
      clearInterval(pingInterval);
      if (webrtcRef.current) webrtcRef.current.close();
      socket.off("room-joined");
      socket.off("peer-joined");
      socket.off("signal-offer");
      socket.off("signal-answer");
      socket.off("signal-ice-candidate");
      socket.off("remote-code-update");
      socket.off("remote-language-update");
      socket.off("remote-cursor-update");
      socket.off("problem-injected");
      socket.off("remote-execution-started");
      socket.off("code-execution-complete");
      socket.off("chat-received");
    };
  }, [roomId]);

  // ---------------- 2. ROLE SWITCHER ----------------
  const handleRoleChange = (newRole) => {
    setRole(newRole);
    const newUsername = newRole === "interviewer" ? "Alex (Interviewer)" : "Morgan (Candidate)";
    setUsername(newUsername);
    if (newRole === "interviewer") setLeftTab("interviewer-tools");
    else setLeftTab("problem");

    if (socketRef.current) {
      socketRef.current.emit("join-room", { roomId, role: newRole, username: newUsername });
    }
  };

  // ---------------- 3. COLLABORATIVE CODE EDITING ----------------
  const handleCodeChange = (newCode) => {
    setCode(newCode);
    if (socketRef.current) {
      // Debounced delta emission
      clearTimeout(codeSyncTimeout.current);
      codeSyncTimeout.current = setTimeout(() => {
        socketRef.current.emit("code-change", {
          roomId,
          code: newCode,
          language
        });
      }, 50);
    }
  };

  const handleCursorChange = (cursor) => {
    if (socketRef.current) {
      socketRef.current.emit("cursor-move", { roomId, cursor });
    }
  };

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    const starter = activeProblem?.starterCode[newLang] || "";
    setCode(starter);
    if (socketRef.current) {
      socketRef.current.emit("language-change", { roomId, language: newLang });
    }
  };

  const handleResetCode = () => {
    const starter = activeProblem?.starterCode[language] || "";
    setCode(starter);
    if (socketRef.current) {
      socketRef.current.emit("code-change", { roomId, code: starter, language });
    }
  };

  // ---------------- 4. INTERVIEWER PROBLEM INJECTION ----------------
  const handleInjectProblem = (problemId) => {
    const prob = PROBLEMS.find((p) => p.id === problemId);
    if (prob && socketRef.current) {
      socketRef.current.emit("interviewer-set-problem", { roomId, problemId });
    }
  };

  // ---------------- 5. CLOUD CODE EXECUTION (JUDGE0 PROXY) ----------------
  const handleRunCode = async () => {
    if (isRunning) return;
    setIsRunning(true);
    if (isTerminalCollapsed) setIsTerminalCollapsed(false);

    if (socketRef.current) {
      socketRef.current.emit("code-execution-started", { roomId, language });
    }

    try {
      const result = await runCode({
        language,
        sourceCode: code,
        stdin,
        roomId
      });
      setTerminalOutput(result);

      if (result.isSuccess) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.8 }
        });
      }
    } catch (err) {
      setTerminalOutput({
        stdout: "",
        stderr: err.message,
        status: "Execution Failed",
        isSuccess: false
      });
    } finally {
      setIsRunning(false);
    }
  };

  // Automated Test Case Runner
  const handleRunTestCases = async () => {
    if (isTestingCases || isRunning || !activeProblem?.testCases) return;
    setIsTestingCases(true);
    const results = {};
    let passedCount = 0;

    for (const tc of activeProblem.testCases) {
      try {
        const res = await runCode({
          language,
          sourceCode: code,
          stdin: tc.stdin
        });
        const cleanActual = (res.stdout || "").trim();
        const cleanExpected = tc.expectedOutput.trim();
        const passed = cleanActual === cleanExpected || cleanActual.replace(/\s+/g, '') === cleanExpected.replace(/\s+/g, '');
        if (passed) passedCount++;

        results[tc.id] = {
          passed,
          actualOutput: cleanActual,
          expectedOutput: cleanExpected
        };
      } catch (err) {
        results[tc.id] = {
          passed: false,
          actualOutput: `Error: ${err.message}`,
          expectedOutput: tc.expectedOutput
        };
      }
      setTestResults({ ...results });
    }

    setIsTestingCases(false);

    // If all pass, shoot celebration confetti!
    if (passedCount === activeProblem.testCases.length && passedCount > 0) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  };

  // ---------------- 6. WEBRTC MEDIA TOGGLES ----------------
  const handleToggleMic = () => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      audioTracks.forEach((t) => { t.enabled = !t.enabled; });
      const nextMuted = !isMuted;
      setIsMuted(nextMuted);
      if (socketRef.current) {
        socketRef.current.emit("media-state-toggle", {
          roomId,
          isMuted: nextMuted,
          isVideoOff,
          isScreenSharing
        });
      }
    }
  };

  const handleToggleVideo = () => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      videoTracks.forEach((t) => { t.enabled = !t.enabled; });
      const nextVideoOff = !isVideoOff;
      setIsVideoOff(nextVideoOff);
      if (socketRef.current) {
        socketRef.current.emit("media-state-toggle", {
          roomId,
          isMuted,
          isVideoOff: nextVideoOff,
          isScreenSharing
        });
      }
    }
  };

  const handleToggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        if (webrtcRef.current) {
          webrtcRef.current.replaceTrack(screenTrack, "video");
        }
        setIsScreenSharing(true);

        screenTrack.onended = () => {
          if (localStream && webrtcRef.current) {
            const camTrack = localStream.getVideoTracks()[0];
            webrtcRef.current.replaceTrack(camTrack, "video");
          }
          setIsScreenSharing(false);
        };
      } catch (e) {
        console.warn("Screen share cancelled:", e.message);
      }
    } else {
      if (localStream && webrtcRef.current) {
        const camTrack = localStream.getVideoTracks()[0];
        webrtcRef.current.replaceTrack(camTrack, "video");
      }
      setIsScreenSharing(false);
    }
  };

  const handleSendChat = (message) => {
    if (socketRef.current) {
      socketRef.current.emit("send-chat", { roomId, message });
    }
  };

  // ---------------- 7. SCORECARD SAVE ----------------
  const handleSaveScorecard = async () => {
    try {
      await saveSessionReport(roomId, {
        scorecard,
        candidateName: role === "interviewer" ? (remotePeerInfo?.username || "Candidate") : username,
        interviewerName: role === "interviewer" ? username : "Interviewer"
      });
      setIsScorecardSaved(true);
      setTimeout(() => setIsScorecardSaved(false), 3000);
    } catch (e) {
      console.warn("Failed to persist scorecard to backend:", e.message);
      setIsScorecardSaved(true);
    }
  };

  const handleLoginSuccess = ({ role: newRole, username: newUsername, roomId: newRoomId, candidateCode: newCode }) => {
    setRole(newRole);
    setUsername(newUsername);
    setRoomId(newRoomId);
    if (newCode) setCandidateCode(newCode);
    if (newRole === "interviewer") setLeftTab("interviewer-tools");
    else setLeftTab("problem");
    const codeParam = newCode ? `&code=${encodeURIComponent(newCode)}` : "";
    const cleanUrl = `${window.location.pathname}?room=${newRoomId}&role=${newRole}&user=${encodeURIComponent(newUsername)}${codeParam}`;
    window.history.pushState(null, '', cleanUrl);
    setIsLoggedIn(true);
  };

  const handleLeaveRoom = () => {
    setIsLoggedIn(false);
    window.history.pushState(null, '', window.location.pathname);
  };

  // If not authenticated or no room selected, show Dual-Role Login Page
  if (!isLoggedIn) {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        defaultRoomId={roomId}
        defaultRole={role}
      />
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-[#0b0f19] text-slate-100 overflow-hidden font-sans">
      {/* Top Navbar */}
      <Navbar
        roomId={roomId}
        role={role}
        onRoleChange={handleRoleChange}
        language={language}
        onLanguageChange={handleLanguageChange}
        onRunCode={handleRunCode}
        isRunning={isRunning}
        latency={latency}
        isConnected={isConnected}
        onOpenReport={() => setIsReportOpen(true)}
        onResetCode={handleResetCode}
        onLeaveRoom={handleLeaveRoom}
        candidateCode={candidateCode}
      />

      {/* Main Split Layout: 3 Columns (Left: Problem/Interviewer, Center: Code+Terminal, Right: A/V Grid) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Problem Statement & Interviewer Private Suite */}
        <div className="w-80 md:w-96 lg:w-[420px] flex-shrink-0 flex flex-col border-r border-slate-800 bg-[#0f172a]/95">
          {/* Sub-tab switcher for Interviewer */}
          {role === "interviewer" && (
            <div className="flex border-b border-slate-800 bg-slate-950/80 text-xs select-none">
              <button
                onClick={() => setLeftTab("interviewer-tools")}
                className={`flex-1 py-2 font-semibold text-center transition-colors ${
                  leftTab === "interviewer-tools"
                    ? "text-purple-400 border-b-2 border-purple-500 bg-purple-500/10"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                🔒 Interviewer Suite
              </button>
              <button
                onClick={() => setLeftTab("problem")}
                className={`flex-1 py-2 font-semibold text-center transition-colors ${
                  leftTab === "problem"
                    ? "text-blue-400 border-b-2 border-blue-500 bg-blue-500/10"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Challenge Statement
              </button>
            </div>
          )}

          <div className="flex-1 overflow-hidden">
            {role === "interviewer" && leftTab === "interviewer-tools" ? (
              <InterviewerPanel
                activeProblemId={activeProblem?.id}
                onInjectProblem={handleInjectProblem}
                scorecard={scorecard}
                onUpdateScorecard={setScorecard}
                onSaveScorecard={handleSaveScorecard}
                isSaved={isScorecardSaved}
              />
            ) : (
              <ProblemCard problem={activeProblem} />
            )}
          </div>
        </div>

        {/* Center Column: Collaborative Monaco Code Editor + Bottom Execution Terminal */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0d131f] relative overflow-hidden">
          <div className="flex-1 relative overflow-hidden">
            <CodeEditor
              code={code}
              language={language}
              onChange={handleCodeChange}
              remoteCursors={remoteCursors}
              onCursorChange={handleCursorChange}
              onRunCode={handleRunCode}
              isInterviewerTyping={role === "candidate" && isRemoteTyping}
              isCandidateTyping={role === "interviewer" && isRemoteTyping}
            />
          </div>

          <TerminalPane
            output={terminalOutput}
            isRunning={isRunning}
            stdin={stdin}
            onStdinChange={setStdin}
            onClearOutput={() => setTerminalOutput(null)}
            testCases={activeProblem?.testCases || []}
            onRunTestCases={handleRunTestCases}
            isTestingCases={isTestingCases}
            testResults={testResults}
            executionHistory={executionHistory}
            isCollapsed={isTerminalCollapsed}
            onToggleCollapse={() => setIsTerminalCollapsed(!isTerminalCollapsed)}
          />
        </div>

        {/* Right Column: WebRTC Audio/Video Tiles & Chat */}
        <div className="w-72 lg:w-80 flex-shrink-0 flex flex-col border-l border-slate-800 bg-[#0f172a]">
          <VideoGrid
            localStream={localStream}
            remoteStream={remoteStream}
            isMuted={isMuted}
            isVideoOff={isVideoOff}
            isScreenSharing={isScreenSharing}
            onToggleMic={handleToggleMic}
            onToggleVideo={handleToggleVideo}
            onToggleScreenShare={handleToggleScreenShare}
            networkQuality={networkQuality}
            role={role}
            username={username}
            remotePeerInfo={remotePeerInfo}
            chatMessages={chatMessages}
            onSendChat={handleSendChat}
          />
        </div>
      </div>

      {/* Post-Interview Session Report Dossier Modal */}
      <SessionReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        roomId={roomId}
        activeProblem={activeProblem}
        language={language}
        finalCode={code}
        scorecard={scorecard}
        testResults={testResults}
        testCases={activeProblem?.testCases || []}
        executionHistory={executionHistory}
      />
    </div>
  );
}
