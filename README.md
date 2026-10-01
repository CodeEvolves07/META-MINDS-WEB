# CodeMeet — Remote Technical Interview Sandbox with WebRTC Audio & Code Run

![CodeMeet Banner](https://img.shields.io/badge/CodeMeet-Hackathon%20Prototype-6366f1?style=for-the-badge&logo=codeforces&logoColor=white)
![Node](https://img.shields.io/badge/Node.js-v20+-339933?style=flat&logo=node.js&logoColor=white)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=flat&logo=react&logoColor=black)
![Monaco](https://img.shields.io/badge/Monaco_Editor-VS_Code_Core-007ACC?style=flat&logo=visualstudiocode&logoColor=white)
![WebRTC](https://img.shields.io/badge/WebRTC-Real_Time_Audio%2FVideo-333333?style=flat&logo=webrtc&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-v4.8-010101?style=flat&logo=socketdotio&logoColor=white)

**CodeMeet** is a browser-based remote technical interview sandbox engineered for college hackathons. It brings together peer-to-peer WebRTC video/audio communication, synchronized Monaco code editing, remote code execution (via Judge0 CE / built-in sandbox), a curated algorithmic problem library, confidential interviewer evaluations, and instant interview reports.

---

## 🌟 Key Features

1. **True WebRTC 1-to-1 Audio & Video**
   - Direct peer-to-peer browser video and audio streams using Google's public STUN servers.
   - Microphone mute/unmute and camera toggle controls with real-time stream status badges.
   - Graceful camera/microphone permission handling and placeholder fallback avatars.

2. **Real-Time Collaborative Code Editor**
   - Monaco Editor (the core engine behind VS Code) with dark theme (`vs-dark`).
   - Bidirectional real-time code synchronization across interviewer and candidate via Socket.IO.
   - Echo-prevention logic to prevent cursor jitter and infinite loops.
   - Multi-language support: **Python, JavaScript, Java, C++**.
   - Programming language synchronization between both participants.

3. **Curated Coding Problem Library**
   - Built-in challenges with full descriptions, constraints, and test cases:
     1. Find Largest Element in an Array (Easy)
     2. Reverse a String (Easy)
     3. Check Whether a Number is Prime (Medium)
     4. Binary Search (Medium)
     5. Two Sum (Easy/Medium)
   - Synchronized problem switching: When the interviewer selects a new problem, the candidate's view automatically updates.

4. **Judge0 Code Execution Engine**
   - Configurable remote code execution via Judge0 CE API.
   - Displays program output (`stdout`), compilation errors (`compile_output`), and runtime errors (`stderr`).
   - Tracks execution runtime and memory metrics.
   - Custom STDIN input support.
   - Built-in offline sandbox runner ensuring reliable demonstrations even when external API keys or network connections are limited during live judging.

5. **Confidential Interviewer Notes & Ratings**
   - Interviewer-only private notes and scoring panel:
     - Communication rating (1–5)
     - Problem-solving rating (1–5)
     - Technical knowledge rating (1–5)
     - Overall Score (0–10)
     - Detailed qualitative comments
   - **Role-Based Security**: Private notes are strictly isolated on the backend and NEVER sent over candidate WebSockets or candidate REST API endpoints.

6. **End Interview & PDF Report**
   - Confirmation dialog before closing sessions.
   - Automatic teardown of WebRTC media tracks.
   - Final interview report displaying candidate code, execution status, and interviewer evaluations.
   - Clean, professional print-to-PDF layout (`@media print` stylesheet).

---

## 🏗️ Architecture & Folder Structure

```
meta/
├── client/                     # Frontend React + Vite application
│   ├── src/
│   │   ├── components/         # Reusable UI components
│   │   │   ├── Navbar.jsx          # Top bar with Room ID, status & end interview
│   │   │   ├── VideoPanel.jsx      # WebRTC local & remote video feeds + controls
│   │   │   ├── MonacoCodeEditor.jsx# VS Code Monaco editor with language switcher
│   │   │   ├── ProblemSection.jsx  # Synchronized coding challenge pane
│   │   │   ├── OutputConsole.jsx   # Console stdout, errors & custom STDIN
│   │   │   ├── InterviewerNotes.jsx# Private scoring & qualitative notes
│   │   │   ├── CandidateGuidance.jsx# Candidate checklist & scratchpad
│   │   │   └── EndInterviewModal.jsx# Session termination confirmation
│   │   ├── pages/              # Routed pages
│   │   │   ├── LandingPage.jsx     # Hero presentation & entry points
│   │   │   ├── CreateInterviewPage.jsx# Interviewer setup & Room ID generation
│   │   │   ├── JoinInterviewPage.jsx  # Candidate join with ID validation
│   │   │   ├── InterviewRoomPage.jsx  # Master 3-column interview studio
│   │   │   └── InterviewReportPage.jsx# Final evaluation & printable report
│   │   ├── services/
│   │   │   ├── api.js              # Axios REST client
│   │   │   ├── socket.js           # Socket.IO client manager
│   │   │   └── webrtc.js           # WebRTC RTCPeerConnection manager
│   │   ├── data/
│   │   │   └── problems.js         # Built-in problems & starter code
│   │   ├── App.jsx             # React Router routing
│   │   ├── main.jsx            # React root mount
│   │   └── index.css           # Tailwind base styles & print layout
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── server/                     # Backend Node.js + Express + Socket.IO
│   ├── src/
│   │   ├── routes/
│   │   │   ├── interviewRoutes.js  # Room creation, submission & notes API
│   │   │   └── judge0Routes.js     # Code execution proxy endpoint
│   │   ├── services/
│   │   │   ├── interviewStore.js   # In-memory store with RBAC note stripping
│   │   │   └── judge0Service.js    # Judge0 CE integration & sandbox runner
│   │   ├── socket/
│   │   │   └── interviewSocket.js  # Real-time signaling & collaborative sync
│   │   └── server.js           # Express app & Socket.IO server entry
│   └── package.json
│
├── package.json                # Root package configuration
├── .gitignore
├── .env.example
└── README.md
```

---

## ⚙️ Prerequisites

- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher
- A modern web browser supporting WebRTC (Chrome, Edge, Firefox, Safari)

---

## 🚀 Quick Start & Installation

### 1. Clone & Install Dependencies

From the repository root:

```bash
# Install dependencies for both server and client
npm --prefix server install
npm --prefix client install
```

### 2. Configure Environment Variables

Create `.env` in `server/` (optional, defaults run out-of-the-box):

```env
PORT=5001

# Judge0 CE Configuration (Optional)
# If left empty, CodeMeet automatically uses its built-in sandbox runner
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=your_rapidapi_key_here
JUDGE0_API_HOST=judge0-ce.p.rapidapi.com
```

### 3. Start Backend & Frontend

In two separate terminal windows (or background jobs):

**Terminal 1 — Backend Server:**
```bash
cd server
npm run dev
# Server starts on http://localhost:5001
```

**Terminal 2 — Frontend Client:**
```bash
cd client
npm run dev
# Frontend runs on http://localhost:3000
```

---

## 👥 Two-User Local Demonstration Guide

To demo the platform with two real users locally:

### Window 1 (Interviewer):
1. Open Chrome/browser at `http://localhost:3000`.
2. Click **Create Interview**.
3. Enter:
   - **Interviewer Name**: e.g., `Dr. Jane Interviewer`
   - **Candidate Name**: e.g., `John Candidate`
   - **Problem**: Select e.g., `5. Two Sum`.
4. Click **Create Interview Room**.
5. Copy the generated **Interview ID** (e.g., `ABC123`).
6. Click **Enter Interview Room**.
7. Allow camera and microphone access when prompted.

### Window 2 (Candidate - Incognito or Second Browser Window):
1. Open an Incognito Window (or another browser) at `http://localhost:3000`.
2. Click **Join Interview**.
3. Enter:
   - **Candidate Name**: `John Candidate`
   - **Interview ID**: Paste the Room ID from Window 1 (`ABC123`).
4. Click **Join Interview Room**.
5. Allow camera and microphone access.

### Verification Checklist:
- **Audio & Video**: Both users see each other's camera feed and can talk through microphones. Mute and camera toggle buttons update smoothly.
- **Collaborative Editor**: Type code in either window; changes appear synchronously in the other window.
- **Language Sync**: Change language from Python to JavaScript in one window; both editors change syntax mode.
- **Problem Sync**: Interviewer selects a new problem; candidate view updates automatically.
- **Code Execution**: Click **Run Code** (`Ctrl + Enter`); execution output appears in the Output Console.
- **Code Submission**: Candidate clicks **Submit Code**; submission timestamp and results are recorded with celebratory confetti.
- **Confidentiality Check**: Interviewer rates candidate (1–5) and writes notes. Candidate cannot see this panel.
- **Session End & Report**: Interviewer clicks **End Interview** and confirms. Both users are transitioned to the report page.

---

## 📡 How Real-Time Communication Works

### WebRTC Media Communication
1. **Signaling**: Sockets coordinate peer connection initialization without passing media through the server.
2. **Offer / Answer Exchange**:
   - The Interviewer initiates a WebRTC offer (`webrtc-offer`).
   - The Candidate receives the offer, applies remote description, creates an answer (`webrtc-answer`), and returns it to the Interviewer.
3. **ICE Candidates**: Network candidates (`webrtc-ice-candidate`) are exchanged via Socket.IO to establish the peer-to-peer UDP/TCP media pipeline using Google's public STUN servers (`stun:stun.l.google.com:19302`).

### Socket.IO Real-Time Synchronization
- `code-change`: Synchronizes the editor buffer across peers with echo suppression.
- `language-change`: Harmonizes language syntax highlighting.
- `problem-change`: Synchronizes the active problem selection.
- `code-run-started` & `code-run-completed`: Broadcasts test status across peers.
- `interview-ended`: Triggers safe room teardown and navigation.

---

## 🔒 Security Practices Implemented

- **Private Notes Isolation**: Interviewer evaluations are never transmitted across Socket.IO events to candidates, and candidate-facing API endpoints strip `privateNotes` via role checks.
- **Role-Based Update Guard**: The `PUT /api/interviews/:id/notes` endpoint strictly verifies the `x-user-role` header and rejects candidate attempts with `403 Forbidden`.
- **No Insecure Code Execution**: Arbitrary candidate code is never run using `eval()` or unsandboxed local Node.js `child_process`. It is isolated through Judge0 CE API or a restricted sandbox parser.
- **Clean Environment Variables**: No API credentials or keys are hardcoded in frontend code.

---

## 📝 Automated Test Suite

An automated integration test suite verifies the end-to-end flow without requiring manual clicks:

```bash
cd server
node test_two_users.js
```

This automated test executes all 12 core operations:
1. Room creation via API
2. Dual WebSocket connection
3. Room join
4. WebRTC signaling offer/answer handshake
5. Live collaborative code synchronization
6. Language switch synchronization
7. Problem change synchronization
8. Judge0 / Sandbox execution
9. Code submission
10. Confidential notes isolation & RBAC enforcement
11. End-interview event propagation
12. Final report generation

---

## ⚖️ Known Limitations

- In-memory storage is optimized for 32-hour hackathon demonstrations and ephemeral sessions; sessions reset on server process termination.
- For production enterprise deployments, a TURN server (e.g. Coturn) can be configured alongside STUN for restrictive corporate firewalls.
- MongoDB or PostgreSQL can be integrated via an ORM for persistent interview archives.

---

## 🏆 College Hackathon Presentation Ready
Built for presentation with clean UI, responsive layout, dark theme, and complete end-to-end functionality.
