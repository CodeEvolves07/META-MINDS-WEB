import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import interviewRoutes from './routes/interviewRoutes.js';
import judge0Routes from './routes/judge0Routes.js';
import { setupInterviewSocket } from './socket/interviewSocket.js';

dotenv.config();

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 5001;

// CORS setup
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-role']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Setup Real-time WebRTC and Collaborative Editing Socket
setupInterviewSocket(io);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'CodeMeet API Server',
    timestamp: new Date().toISOString()
  });
});

// WebRTC ICE Servers endpoint (STUN + TURN configuration for cross-network support)
app.get('/api/webrtc/ice-servers', (req, res) => {
  const stunUrls = [
    'stun:stun.l.google.com:19302',
    'stun:stun1.l.google.com:19302',
    'stun:stun2.l.google.com:19302'
  ];

  const iceServers = [{ urls: stunUrls }];

  const turnUrls = process.env.TURN_URLS;
  const turnUsername = process.env.TURN_USERNAME;
  const turnCredential = process.env.TURN_CREDENTIAL;

  if (turnUrls && turnUrls.trim()) {
    const urls = turnUrls.split(',').map((u) => u.trim()).filter(Boolean);
    const turnEntry = { urls };
    if (turnUsername) turnEntry.username = turnUsername.trim();
    if (turnCredential) turnEntry.credential = turnCredential.trim();
    iceServers.push(turnEntry);
  }

  res.json({
    success: true,
    iceServers,
    turnConfigured: Boolean(turnUrls && turnUrls.trim())
  });
});

// API Routes
app.use('/api/interviews', interviewRoutes);
app.use('/api/judge0', judge0Routes);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🚀 CodeMeet Server running on port ${PORT} (0.0.0.0)`);
  console.log(`📡 Socket.IO signaling active`);
  console.log(`===============================================`);
});
