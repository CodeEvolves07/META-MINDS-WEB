import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { executeCode, LANGUAGE_MAP } from "./judge0Service.js";
import { PROBLEMS, getProblemById, getAllProblemsSummary } from "./problemLibrary.js";

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

// Middleware
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json({ limit: "5mb" }));

// Socket.io setup with low pingInterval for sub-100ms responsiveness
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true
  },
  pingInterval: 10000,
  pingTimeout: 5000
});

// In-Memory Room Store
const rooms = new Map();
const codeToRoomId = new Map(); // candidateCode (uppercase) -> roomId

function generateCandidateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  for (let i = 0; i < 4; i++) {
    suffix += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `INT-${suffix}`;
}

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    const defaultProblem = PROBLEMS[0]; // Two Sum
    let code = generateCandidateCode();
    while (codeToRoomId.has(code)) {
      code = generateCandidateCode();
    }
    codeToRoomId.set(code, roomId);

    rooms.set(roomId, {
      id: roomId,
      candidateCode: code,
      createdAt: Date.now(),
      peers: new Map(), // socketId -> { socketId, role, username, isMuted, isVideoOff }
      language: "python",
      code: defaultProblem.starterCode.python,
      activeProblemId: defaultProblem.id,
      terminalOutput: null,
      scorecard: null,
      chatMessages: [],
      executionHistory: []
    });
  }
  return rooms.get(roomId);
}

// ---------------- REST API ROUTES ----------------

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Remote Technical Interview Sandbox Backend",
    uptime: process.uptime(),
    activeRooms: rooms.size,
    timestamp: new Date().toISOString()
  });
});

// Problem library endpoints
app.get("/api/problems", (req, res) => {
  res.json({ success: true, problems: getAllProblemsSummary() });
});

app.get("/api/problems/:id", (req, res) => {
  const problem = getProblemById(req.params.id);
  if (!problem) {
    return res.status(404).json({ success: false, error: "Problem not found" });
  }
  res.json({ success: true, problem });
});

// Interviewer Session Creation API (Generates Unique Candidate Access Code)
app.post("/api/auth/create-session", (req, res) => {
  const { interviewerName = "Alex (Interviewer)", customRoomId = "" } = req.body;
  const cleanRoomId = customRoomId.trim().toLowerCase() || `room-${Math.random().toString(36).substring(2, 7)}`;
  const room = getOrCreateRoom(cleanRoomId);

  const token = `token_interviewer_${cleanRoomId}_${Date.now()}`;
  console.log(`[Session Created] Interviewer "${interviewerName}" created room "${cleanRoomId}" with candidate code "${room.candidateCode}"`);

  res.json({
    success: true,
    roomId: cleanRoomId,
    candidateCode: room.candidateCode,
    token,
    user: {
      username: interviewerName.trim() || "Alex (Interviewer)",
      role: "interviewer",
      roomId: cleanRoomId
    },
    room: {
      id: cleanRoomId,
      candidateCode: room.candidateCode,
      activeProblem: getProblemById(room.activeProblemId),
      activePeersCount: room.peers.size
    }
  });
});

// Candidate Verification & Join API (Verifies Unique Code from Interviewer)
app.post("/api/auth/candidate-verify", (req, res) => {
  const { candidateCode = "", candidateName = "Morgan (Candidate)" } = req.body;
  const formattedCode = candidateCode.trim().toUpperCase();

  if (!formattedCode) {
    return res.status(400).json({ success: false, error: "Please provide the unique candidate access code." });
  }

  // Lookup by candidate code (e.g. INT-8492) or direct room id fallback
  let targetRoomId = codeToRoomId.get(formattedCode);
  if (!targetRoomId) {
    // Check if the user entered room ID directly
    const directRoom = rooms.get(candidateCode.trim().toLowerCase());
    if (directRoom) {
      targetRoomId = directRoom.id;
    }
  }

  if (!targetRoomId || !rooms.has(targetRoomId)) {
    return res.status(404).json({
      success: false,
      error: `Invalid access code "${formattedCode}". Please check the code provided by your interviewer.`
    });
  }

  const room = rooms.get(targetRoomId);
  const token = `token_candidate_${targetRoomId}_${Date.now()}`;
  console.log(`[Candidate Verified] Candidate "${candidateName}" verified code "${formattedCode}" -> Room "${targetRoomId}"`);

  res.json({
    success: true,
    roomId: targetRoomId,
    candidateCode: room.candidateCode,
    token,
    user: {
      username: candidateName.trim() || "Morgan (Candidate)",
      role: "candidate",
      roomId: targetRoomId
    },
    room: {
      id: targetRoomId,
      candidateCode: room.candidateCode,
      activeProblem: getProblemById(room.activeProblemId),
      activePeersCount: room.peers.size
    }
  });
});

// Authentication / Lobby Login API (Standard / Direct)
app.post("/api/auth/login", (req, res) => {
  const { role = "candidate", username = "Guest", roomId, passcode = "" } = req.body;
  if (!roomId || !roomId.trim()) {
    return res.status(400).json({ success: false, error: "Room ID is required" });
  }

  // Interviewer Passcode check (Optional passcode e.g. INTERVIEW2026 or empty)
  if (role === "interviewer" && passcode && passcode !== "INTERVIEW2026" && passcode !== "admin") {
    return res.status(401).json({ success: false, error: "Invalid Interviewer Passcode" });
  }

  const cleanRoomId = roomId.trim().toLowerCase();
  const room = getOrCreateRoom(cleanRoomId);

  const token = `token_${role}_${cleanRoomId}_${Date.now()}`;
  res.json({
    success: true,
    token,
    user: {
      username: username.trim() || (role === "interviewer" ? "Interviewer" : "Candidate"),
      role,
      roomId: cleanRoomId
    },
    room: {
      id: cleanRoomId,
      candidateCode: room.candidateCode,
      activeProblem: getProblemById(room.activeProblemId),
      activePeersCount: room.peers.size
    }
  });
});

// Room validation endpoint
app.get("/api/rooms/:roomId/validate", (req, res) => {
  const cleanRoomId = req.params.roomId.trim().toLowerCase();
  const exists = rooms.has(cleanRoomId);
  const room = exists ? rooms.get(cleanRoomId) : null;
  res.json({
    success: true,
    exists,
    roomId: cleanRoomId,
    candidateCode: room ? room.candidateCode : null,
    activePeersCount: room ? room.peers.size : 0,
    activeProblemTitle: room ? (getProblemById(room.activeProblemId)?.title || "Two Sum") : "Two Sum"
  });
});

// Secure Code Execution Proxy
app.post("/api/execute", async (req, res) => {
  try {
    const { language = "python", sourceCode, stdin = "", roomId } = req.body;
    if (!sourceCode) {
      return res.status(400).json({ success: false, error: "sourceCode is required" });
    }

    console.log(`[API /api/execute] Running ${language} snippet (${sourceCode.length} chars)`);
    const result = await executeCode({ language, sourceCode, stdin });

    // If roomId provided, log execution in room state
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      const executionEntry = {
        id: `exec_${Date.now()}`,
        timestamp: new Date().toISOString(),
        language,
        status: result.status,
        time: result.time,
        memory: result.memory,
        isSuccess: result.isSuccess
      };
      room.executionHistory.push(executionEntry);
      room.terminalOutput = result;
      // Broadcast execution result to room
      io.to(roomId).emit("code-execution-complete", { result, executionEntry });
    }

    res.json({ success: true, ...result });
  } catch (err) {
    console.error("[API /api/execute] Error:", err.message);
    res.status(500).json({
      success: false,
      error: err.message,
      stdout: "",
      stderr: err.message,
      status: "Execution Failed"
    });
  }
});

// Session Audit Report save/retrieve
app.post("/api/rooms/:roomId/report", (req, res) => {
  const { roomId } = req.params;
  const { scorecard, candidateName, interviewerName } = req.body;
  const room = getOrCreateRoom(roomId);

  room.scorecard = {
    ...scorecard,
    candidateName: candidateName || "Candidate",
    interviewerName: interviewerName || "Interviewer",
    submittedAt: new Date().toISOString()
  };

  res.json({ success: true, message: "Scorecard recorded", roomState: serializeRoom(room) });
});

app.get("/api/rooms/:roomId/summary", (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({ success: false, error: "Room not found" });
  }
  res.json({ success: true, summary: serializeRoom(room) });
});

function serializeRoom(room) {
  return {
    roomId: room.id,
    createdAt: room.createdAt,
    language: room.language,
    code: room.code,
    activeProblem: getProblemById(room.activeProblemId),
    terminalOutput: room.terminalOutput,
    scorecard: room.scorecard,
    executionHistory: room.executionHistory,
    totalExecutions: room.executionHistory.length,
    activePeers: Array.from(room.peers.values())
  };
}

// ---------------- SOCKET.IO REAL-TIME LOGIC ----------------

io.on("connection", (socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);

  // Join Room
  socket.on("join-room", ({ roomId, role = "candidate", username = "Guest" }) => {
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.role = role;
    socket.data.username = username;

    const room = getOrCreateRoom(roomId);
    room.peers.set(socket.id, {
      socketId: socket.id,
      role,
      username,
      isMuted: false,
      isVideoOff: false
    });

    console.log(`[Room Join] User "${username}" (${role}) joined room "${roomId}". Total peers: ${room.peers.size}`);

    // Return existing room state to joining peer
    socket.emit("room-joined", {
      roomId,
      role,
      username,
      language: room.language,
      code: room.code,
      activeProblem: getProblemById(room.activeProblemId),
      terminalOutput: room.terminalOutput,
      peers: Array.from(room.peers.values()).filter(p => p.socketId !== socket.id)
    });

    // Notify other peers in the room
    socket.to(roomId).emit("peer-joined", {
      socketId: socket.id,
      role,
      username
    });
  });

  // WebRTC Signaling Relay: SDP Offer
  socket.on("signal-offer", ({ targetSocketId, sdpOffer }) => {
    console.log(`[WebRTC Relay] Offer from ${socket.id} -> ${targetSocketId}`);
    io.to(targetSocketId).emit("signal-offer", {
      fromSocketId: socket.id,
      sdpOffer,
      senderRole: socket.data.role,
      senderUsername: socket.data.username
    });
  });

  // WebRTC Signaling Relay: SDP Answer
  socket.on("signal-answer", ({ targetSocketId, sdpAnswer }) => {
    console.log(`[WebRTC Relay] Answer from ${socket.id} -> ${targetSocketId}`);
    io.to(targetSocketId).emit("signal-answer", {
      fromSocketId: socket.id,
      sdpAnswer
    });
  });

  // WebRTC Signaling Relay: ICE Candidate
  socket.on("signal-ice-candidate", ({ targetSocketId, candidate }) => {
    io.to(targetSocketId).emit("signal-ice-candidate", {
      fromSocketId: socket.id,
      candidate
    });
  });

  // Collaborative Code Editing Sync
  socket.on("code-change", ({ roomId, code, delta, version }) => {
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.code = code;
      // Broadcast to other peers in room
      socket.to(roomId).emit("remote-code-update", {
        code,
        delta,
        version,
        senderId: socket.id,
        role: socket.data.role
      });
    }
  });

  // Language Change Sync
  socket.on("language-change", ({ roomId, language }) => {
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.language = language;
      const problem = getProblemById(room.activeProblemId);
      if (problem && problem.starterCode[language]) {
        room.code = problem.starterCode[language];
      }
      io.to(roomId).emit("remote-language-update", {
        language,
        code: room.code,
        senderRole: socket.data.role
      });
    }
  });

  // Remote Cursor Synchronization
  socket.on("cursor-move", ({ roomId, cursor }) => {
    socket.to(roomId).emit("remote-cursor-update", {
      senderId: socket.id,
      role: socket.data.role,
      username: socket.data.username,
      cursor // { lineNumber, column, selection }
    });
  });

  // Interviewer Problem Injection
  socket.on("interviewer-set-problem", ({ roomId, problemId }) => {
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      const problem = getProblemById(problemId);
      if (problem) {
        room.activeProblemId = problemId;
        const starter = problem.starterCode[room.language] || problem.starterCode.python;
        room.code = starter;
        io.to(roomId).emit("problem-injected", {
          problem,
          starterCode: starter,
          language: room.language,
          injectedBy: socket.data.username
        });
        console.log(`[Problem Injected] Problem "${problem.title}" injected into room "${roomId}"`);
      }
    }
  });

  // Execution Trigger Sync (Interviewer and Candidate see execution status)
  socket.on("code-execution-started", ({ roomId, language }) => {
    socket.to(roomId).emit("remote-execution-started", {
      executor: socket.data.username,
      role: socket.data.role,
      language
    });
  });

  // In-Room Chat Sync
  socket.on("send-chat", ({ roomId, message }) => {
    const chatEntry = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      sender: socket.data.username || "Anonymous",
      role: socket.data.role || "candidate",
      text: message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    if (roomId && rooms.has(roomId)) {
      rooms.get(roomId).chatMessages.push(chatEntry);
    }
    io.to(roomId).emit("chat-received", chatEntry);
  });

  // Media Track State Sync (Mute / Cam toggle notifications)
  socket.on("media-state-toggle", ({ roomId, isMuted, isVideoOff, isScreenSharing }) => {
    if (roomId && rooms.has(roomId)) {
      const peer = rooms.get(roomId).peers.get(socket.id);
      if (peer) {
        peer.isMuted = isMuted;
        peer.isVideoOff = isVideoOff;
        peer.isScreenSharing = isScreenSharing;
      }
    }
    socket.to(roomId).emit("peer-media-state-updated", {
      socketId: socket.id,
      isMuted,
      isVideoOff,
      isScreenSharing
    });
  });

  // Ping / RTT Measurement
  socket.on("latency-ping", (clientTimestamp, callback) => {
    if (typeof callback === "function") {
      callback(clientTimestamp, Date.now());
    }
  });

  // Disconnection Handler
  socket.on("disconnect", () => {
    console.log(`[Socket Disconnected] ID: ${socket.id}`);
    const roomId = socket.data.roomId;
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId);
      room.peers.delete(socket.id);
      socket.to(roomId).emit("peer-left", {
        socketId: socket.id,
        role: socket.data.role,
        username: socket.data.username
      });
      if (room.peers.size === 0) {
        // Clean up empty room after 1 hour to prevent memory leak
        setTimeout(() => {
          if (rooms.has(roomId) && rooms.get(roomId).peers.size === 0) {
            rooms.delete(roomId);
            console.log(`[Room Cleaned] Room ${roomId} pruned due to inactivity.`);
          }
        }, 3600000);
      }
    }
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Interview Sandbox Backend running on http://localhost:${PORT}`);
  console.log(`📡 WebRTC Signaling + Socket.io initialized`);
  console.log(`⚡ Judge0 CE Execution Proxy Target: ${process.env.JUDGE0_API_URL || "https://ce.judge0.com"}`);
  console.log(`=======================================================`);
});
