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

// Security Headers & Cache-Control Middleware
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Prevent caching of private application data
  if (req.path.startsWith('/api/interviews') || req.path.startsWith('/api/judge0')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Lightweight In-Memory Rate Limiter for Abuse Protection (Section 23)
const rateLimitMap = new Map();
function createRateLimiter(windowMs, maxRequests, keyPrefix) {
  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    const record = rateLimitMap.get(key) || { count: 0, resetTime: now + windowMs };
    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
    } else {
      record.count += 1;
    }
    rateLimitMap.set(key, record);

    if (record.count > maxRequests) {
      return res.status(429).json({
        success: false,
        message: 'Too many requests. Please wait a moment before trying again.'
      });
    }
    next();
  };
}

// Clean up stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

// CORS setup
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-auth-token']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Apply rate limiting on sensitive join requests (max 60/min) and code execution (max 120/min)
app.use('/api/interviews/:id/join', createRateLimiter(60 * 1000, 60, 'join'));
app.use('/api/judge0/run', createRateLimiter(60 * 1000, 120, 'exec'));

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
app.set('io', io);

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
