# Remote Technical Interview Sandbox with WebRTC Audio & Code Run

A production-ready, peer-to-peer browser-based technical interview and pair-programming platform. Engineered with **zero paid server dependencies**, direct browser-to-browser WebRTC audio/video mesh networking (<100ms latency), Monaco Editor operational code synchronization, and secure Judge0 CE cloud code execution.

---

## 🌟 Key Features

1. **FR-1: Collaborative Code Editor (Monaco)**
   - Industry-standard Monaco Editor (VS Code engine) with full syntax highlighting for **Python, Java, C++, and JavaScript**.
   - Bidirectional real-time operational synchronization via Socket.io with caret stability (no cursor jumping).
   - Live synchronized remote cursors showing colored participant labels (*"Interviewer"*, *"Candidate"*).

2. **FR-2: Cloud Code Execution Sandbox (Judge0 CE)**
   - Secure server-proxied execution against standard input (`stdin`) capturing `stdout`, `stderr`, compile errors, execution runtime (seconds), and memory usage (MB).
   - Interactive bottom console with tabs for Output, Custom Stdin, Automated Test Cases, and Session History.
   - Built-in resilient sandbox fallback runner for seamless interviews even during upstream API outages.

3. **FR-3: Peer-to-Peer WebRTC Audio & Video**
   - Direct browser-to-browser SRTP media streams establishing connection under 100ms over Google STUN (`stun:stun.l.google.com:19302`).
   - In-app media controls: Microphone Mute/Unmute, Camera On/Off, Screen Sharing, and Audio Wave meter.
   - Continuous in-band network quality monitoring (RTT in ms, packet loss, quality badge).

4. **FR-4: Curated Problem Statement Library**
   - Curated repository of LeetCode-style algorithmic challenges (Two Sum, LRU Cache, Longest Substring, Valid Parentheses, Binary Tree Max Path Sum).
   - Interviewer-only injection panel: search, filter by difficulty (Easy/Medium/Hard), preview, and inject directly into the candidate's active view.

5. **FR-5: Hidden Interviewer Private Scorecard & Notes**
   - Private evaluation suite strictly isolated to the user logged in as *"Interviewer"*.
   - Star ratings across 4 core competencies: *Problem Solving & Algorithms*, *Code Quality*, *Communication*, *System Design / Optimization*.
   - Hiring recommendation selector (*Strong Hire*, *Hire*, *Leaning Hire*, *No Hire*) and private markdown notes hidden from candidate.

6. **FR-6: Post-Interview Session Dossier & Report**
   - Downloadable audit/summary report containing final code snapshot, automated test case pass rate, execution metrics, and interviewer ratings/comments.
   - One-click export to **Markdown (.md)**, **JSON audit format (.json)**, and **Print/PDF Dossier**.

---

## 🏛️ System Architecture

```
                       [Candidate Browser]
                               ▲
                               │
               Direct P2P SRTP Media Stream (<100ms)
                               │
                               ▼
                      [Interviewer Browser]
                               ▲
                               │
          WebSocket Signaling & Operational Code Delta Sync
                               │
                               ▼
        ┌────────────────────────────────────────────────────────┐
        │       Node.js / Express Backend (Signaling + Proxy)    │
        │  - Socket.io WebRTC Signaling Engine                   │
        │  - In-Memory Room & Collaborative State Manager        │
        │  - Secure Judge0 CE Code Execution Proxy               │
        │  - Problem Library Data Provider                       │
        └──────────────────────────┬─────────────────────────────┘
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
       [Google Free Public STUN]        [Judge0 CE Sandbox API]
      stun:stun.l.google.com:19302       Isolated Code Compiler
```

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js (v18+ or v20 LTS recommended)
- npm (v9+)

### 1. Start the Backend Signaling & Proxy Server
```bash
cd backend
npm install
npm run dev
# Server starts on http://localhost:5000
```

### 2. Start the Frontend Application
```bash
cd frontend
npm install
npm run dev
# Vite dev server starts on http://localhost:5173
```

### 3. Open in Browser
- **Interviewer Tab:** Navigate to `http://localhost:5173/?room=room-101&role=interviewer`
- **Candidate Tab:** Navigate to `http://localhost:5173/?room=room-101&role=candidate`
- Notice instant cursor tracking, WebRTC audio/video pairing, and shared code execution!

---

## 📁 Repository Structure

```
d:/META_MINDS WEB/
├── backend/
│   ├── src/
│   │   ├── server.js            # Express + Socket.io WebRTC signaling & sync
│   │   ├── judge0Service.js     # Secure Judge0 CE proxy with fallback runner
│   │   └── problemLibrary.js    # Curated algorithmic challenges & test cases
│   ├── .env.example             # Backend environment template
│   └── package.json             # Backend dependencies (express, socket.io, axios)
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.jsx               # Header with latency RTT, role toggle, run button
│   │   │   ├── ProblemCard.jsx          # Active problem statement, examples, constraints
│   │   │   ├── InterviewerPanel.jsx     # Challenge picker & private scorecard (Interviewer only)
│   │   │   ├── CodeEditor.jsx           # Monaco Editor with remote cursor badges & delta sync
│   │   │   ├── TerminalPane.jsx         # Output console, stdin, automated test case runner
│   │   │   ├── VideoGrid.jsx            # WebRTC P2P audio/video, mute/cam toggles, chat
│   │   │   └── SessionReportModal.jsx   # Post-session dossier generator (MD, JSON, Print)
│   │   ├── data/
│   │   │   └── problems.js              # Client problems & starter codes
│   │   ├── services/
│   │   │   ├── socket.js                # Singleton Socket.io client
│   │   │   ├── webrtc.js                # RTCPeerConnection controller with STUN fallback
│   │   │   └── api.js                   # REST API client for execution proxy & reports
│   │   ├── App.jsx                      # Main workspace orchestrator & layout
│   │   ├── index.css                    # Global dark styling, Monaco cursors, VU meter
│   │   └── main.jsx                     # Vite React root
│   ├── vercel.json                      # Vercel SPA rewrite configuration
│   ├── tailwind.config.js               # Tailored dark color tokens & typography
│   └── package.json                     # Frontend dependencies (React 19, Monaco, Lucide)
├── docs/
│   ├── PLANNING.md                      # System architecture & Mermaid sequence diagrams
│   ├── PROGRESS.md                      # Task checklist and milestone tracker
│   ├── DEPLOYMENT.md                    # Zero-cost deployment guide (Vercel & Render)
│   └── DEFENSE_QA.md                    # Technical defense answers for architecture judges
└── README.md                            # Comprehensive project overview and instructions
```

---

## 📖 Mandatory Documentation
Detailed engineering specifications are available in the `docs/` folder:
- [docs/PLANNING.md](file:///d:/META_MINDS%20WEB/docs/PLANNING.md) — Architectural diagrams, WebRTC sequence flows, operational sync model, and component hierarchy.
- [docs/PROGRESS.md](file:///d:/META_MINDS%20WEB/docs/PROGRESS.md) — Implementation verification checklist and milestones.
- [docs/DEPLOYMENT.md](file:///d:/META_MINDS%20WEB/docs/DEPLOYMENT.md) — Production setup for Vercel (Frontend) and Render (Backend).
- [docs/DEFENSE_QA.md](file:///d:/META_MINDS%20WEB/docs/DEFENSE_QA.md) — Comprehensive technical defense questions & architectural rationales.

---

## 🛡️ Security & Zero Cost Guarantees
- **Zero Paid Dependencies:** Uses free Google STUN servers and open Judge0 CE endpoints.
- **Client Security:** Remote API keys are never exposed to client browsers; all executions route via backend proxy.
- **Interviewer Privacy:** Scorecards and private notes are filtered at component boundary and never broadcasted to candidates.
