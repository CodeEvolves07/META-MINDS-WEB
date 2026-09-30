`# Remote Technical Interview Sandbox with WebRTC Audio & Code Run
## System Architecture & Technical Planning Specification

---

### 1. Executive Summary & Architecture Overview

**Remote Technical Interview Sandbox with WebRTC Audio & Code Run** is a high-performance, real-time collaborative coding and technical assessment environment. It is engineered with zero paid server infrastructure dependencies, pairing lightweight Node.js/Socket.io signaling with direct browser-to-browser WebRTC audio/video mesh networking, Monaco Editor operational synchronization, and a secure backend-proxied Judge0 CE execution pipeline.

```mermaid
flowchart TB
    subgraph ClientInterviewer["Interviewer Client (Browser)"]
        UI_I["React 19 UI / Tailwind CSS"]
        Monaco_I["Monaco Editor Instance"]
        WebRTC_I["WebRTC Peer (Simple-Peer/PeerJS)"]
        Socket_I["Socket.io Client"]
        Scorecard_I["Private Scorecard & Notes (Interviewer Only)"]
        ProblemPicker_I["Problem Selector & Test Injector"]
    end

    subgraph ClientCandidate["Candidate Client (Browser)"]
        UI_C["React 19 UI / Tailwind CSS"]
        Monaco_C["Monaco Editor Instance"]
        WebRTC_C["WebRTC Peer (Simple-Peer/PeerJS)"]
        Socket_C["Socket.io Client"]
        ProblemViewer_C["Active Challenge View"]
        Terminal_C["Live Execution Terminal"]
    end

    subgraph BackendServer["Node.js / Express Signaling & Proxy (Render)"]
        RoomMgr["Room Manager & State Store"]
        Signaling["Socket.io WebRTC Signaling Engine"]
        SyncEngine["Code & Cursor Operational Sync Engine"]
        JudgeProxy["Secure Judge0 CE Code Execution Proxy"]
        ProblemRepo["Problem Library Data Provider"]
    end

    subgraph ExternalServices["External Infrastructure (Zero Cost)"]
        GoogleSTUN["Free Google STUN Server (stun:stun.l.google.com:19302)"]
        Judge0API["Judge0 CE Public Compiler API / Sandbox Worker"]
    end

    %% WebRTC Direct Stream
    WebRTC_I <===>|"Direct P2P Encrypted Audio/Video Stream (<100ms)"| WebRTC_C

    %% Signaling & Sync
    Socket_I <-->|"Signaling, Cursors, Code Delta, Role Auth"| Signaling
    Socket_C <-->|"Signaling, Cursors, Code Delta"| Signaling

    %% STUN Discovery
    WebRTC_I -.->|"NAT Traversal / ICE Candidates"| GoogleSTUN
    WebRTC_C -.->|"NAT Traversal / ICE Candidates"| GoogleSTUN

    %% Code Execution
    Monaco_I -.->|"Submit Code Run"| JudgeProxy
    Monaco_C -.->|"Submit Code Run"| JudgeProxy
    JudgeProxy <-->|"POST /submissions & GET /status"| Judge0API

    %% Interviewer Privileges
    Scorecard_I -.->|"Local Encrypted / Session Audit"| UI_I
    ProblemPicker_I -->|"Broadcast Active Problem"| RoomMgr
    RoomMgr -->|"Sync Problem Definition"| ProblemViewer_C
```

---

### 2. WebRTC Peer-to-Peer Signaling & Media Handshake

The WebRTC subsystem establishes direct sub-100ms peer connections over UDP/SRTP. Signaling happens over Socket.io using an Offer/Answer/ICE Candidate relay pattern.

```mermaid
sequenceDiagram
    autonumber
    participant I as Interviewer (Peer A)
    participant S as Signaling Server (Node/Socket.io)
    participant STUN as Google STUN Server
    participant C as Candidate (Peer B)

    Note over I,C: Phase 1: Room Join & Role Negotiation
    I->>S: join-room { roomId, role: "interviewer", username: "Alex (Interviewer)" }
    S-->>I: room-joined { role: "interviewer", peers: [] }

    C->>S: join-room { roomId, role: "candidate", username: "Morgan (Candidate)" }
    S-->>C: room-joined { role: "candidate", peers: ["interviewer-socket-id"] }
    S->>I: peer-joined { peerId: "candidate-socket-id", role: "candidate" }

    Note over I,C: Phase 2: WebRTC Offer/Answer via Signaling Relay
    I->>STUN: Request ICE Candidates (Public IP:Port)
    STUN-->>I: Return ICE Candidates
    I->>S: signal-offer { targetPeer: candidateId, sdpOffer, mediaTypes: [audio, video] }
    S->>C: signal-offer { fromPeer: interviewerId, sdpOffer }

    C->>STUN: Request ICE Candidates
    STUN-->>C: Return ICE Candidates
    C->>S: signal-answer { targetPeer: interviewerId, sdpAnswer }
    S->>I: signal-answer { fromPeer: candidateId, sdpAnswer }

    I->>S: signal-ice-candidate { targetPeer: candidateId, candidate }
    S->>C: signal-ice-candidate { fromPeer: interviewerId, candidate }
    C->>S: signal-ice-candidate { targetPeer: interviewerId, candidate }
    S->>I: signal-ice-candidate { fromPeer: candidateId, candidate }

    Note over I,C: Phase 3: Direct P2P Media Stream Established
    I<<-->>C: Direct SRTP Encrypted A/V Stream (<100ms Latency)
    Note over I,C: In-Band Network Stats Monitoring (RTT, Jitter, Packet Loss)
```

---

### 3. Collaborative Code Editor & Cursor Synchronization

Operational synchronization allows simultaneous typing, language switching, and cursor awareness without cursor collisions or cursor jumping:

```mermaid
sequenceDiagram
    autonumber
    participant C as Candidate Monaco Editor
    participant S as Server Sync Engine
    participant I as Interviewer Monaco Editor

    Note over C,I: Bidirectional Live Operational Sync
    C->>C: User types code or changes selection
    C->>S: code-change { roomId, delta, fullCode, version, cursor: { lineNumber, column } }
    S->>S: Validate & Cache Room Document State
    S->>I: remote-code-update { delta, fullCode, version, origin: "candidate" }
    I->>I: Apply Delta without moving local caret
    
    C->>S: cursor-move { roomId, cursor: { lineNumber, column, selectionRange }, role: "candidate" }
    S->>I: remote-cursor-update { user: "Candidate", position: { lineNumber, column }, color: "#3B82F6" }
    I->>I: Render Monaco Content Widget & Text Marker
```

---

### 4. Judge0 CE Code Execution Pipeline & Security Isolation

To strictly enforce constraint #3 ("Ensure code execution is securely isolated via remote API calls without exposing API keys on the client side"):
1. The client sends `{ languageId, sourceCode, stdin }` to the Node.js backend (`/api/execute`).
2. The Node.js backend validates, sanitizes, and forwards the request to Judge0 CE (using either free public instances or RapidAPI keys stored in backend environment variables).
3. The backend polls until completion (or uses callback where supported) and returns formatted `{ stdout, stderr, compile_output, time, memory, status }`.
4. If the remote service is temporarily rate-limited or offline, the backend includes an automated fallback execution runner for Python and JavaScript, ensuring unbroken interview experience.

```mermaid
flowchart LR
    Client["Client Monaco Terminal"] -->|"POST /api/execute (Sanitized Code + Stdin)"| BackendProxy["Node.js Server Backend"]
    BackendProxy -->|"Isolated Environment & Headers"| Judge0["Judge0 CE Endpoint (Public/RapidAPI)"]
    Judge0 -->|"Sandboxed Linux Cgroup Isolation"| Worker["Worker (Resource Limits: 5s, 128MB)"]
    Worker -->|"Stdout, Stderr, Time, Memory"| Judge0
    Judge0 -->|"JSON Status: Accepted / Error"| BackendProxy
    BackendProxy -->|"Clean Safe Response"| Client
```

---

### 5. Private Interviewer Scorecard & Audit Report Flow

```mermaid
flowchart TD
    Interviewer["Interviewer Panel"] -->|"Evaluate in Real-Time"| Scorecard["Private Evaluation Form"]
    Scorecard -->|"Ratings (1-5): Problem Solving, Code Quality, System Design, Communication"| LocalState["Secure Room State (Server In-Memory / Client)"]
    Scorecard -->|"Private Feedback Notes & Markdown"| LocalState
    SessionEnd["Session Completion / Report Trigger"] --> Generator["Session Summary Engine"]
    Generator --> ReportJSON["Structured JSON Audit Log"]
    Generator --> ReportMD["Formatted Markdown Report"]
    Generator --> ReportPDF["Printable Executive PDF / HTML Summary"]
    ReportPDF --> Downloader["Downloadable Candidate Evaluation Dossier"]
```

---

### 6. Component Hierarchy (React 19 Frontend)

```
App.tsx
├── Navbar
│   ├── RoomStatusBadge (Connection, Latency RTT, Role)
│   ├── LanguageSelector (Python, JavaScript, C++, Java)
│   ├── QuickActionToolbar (Run Code, Reset Code, Invite Link, End Session)
│   └── AudioVideoControls (Mic, Cam, ScreenShare, Media Settings)
├── WorkspaceGrid (Resizable Split Panels)
│   ├── LeftPanel (Context & Challenges)
│   │   ├── ProblemStatementCard (Title, Tags, Difficulty, Examples, Constraints)
│   │   ├── InterviewerChallengePicker (Search, Filter, Inject to Room) [Interviewer Only]
│   │   └── InterviewerScorecardPanel (Ratings, Notes, Rubric) [Interviewer Only]
│   ├── CenterPanel (Collaborative Code Environment)
│   │   ├── EditorHeader (Active Users, Typing Indicators, Sync Status)
│   │   ├── MonacoCodeEditor (Collaborative Syntax Highlight, Remote Cursors)
│   │   └── ExecutionTerminal (Tabs: Console Output, Custom Stdin, Test Case Runner)
│   └── RightPanel (Peer-to-Peer AV & Real-Time Chat)
│       ├── VideoGrid (Interviewer Stream + Candidate Stream + Screen Share)
│       ├── AudioMeter / NetworkQualityIndicator
│       └── ChatBox (Text Chat, Code Snippets, System Notifications)
└── SessionReportModal (Generated Post-Interview Summary, Metrics, Export Actions)
```

---

### 7. Non-Functional Requirements & Performance Budgets

| Metric | Target Budget | Strategy |
| :--- | :--- | :--- |
| **WebRTC Media Latency** | < 100 ms | Direct P2P SRTP connection via Google STUN; low-overhead Opus/VP8 codecs |
| **Signaling Latency** | < 50 ms | Lightweight binary/JSON Socket.io payloads over WebSocket |
| **Editor Sync Jitter** | Zero jumping | Differential debounced delta broadcast with client-side cursor lock |
| **Execution Timeout** | 5 seconds max | Backend Judge0 proxy enforcement with standard input timeout limit |
| **Server Cost** | $0.00 | Free Render Web Service + Free Vercel Static Hosting + Free STUN + Free Judge0 CE |
| **Security** | Zero Client Secrets | All API keys and environment variables strictly encapsulated in backend proxy |
