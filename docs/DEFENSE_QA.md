# System Defense & Technical Evaluation Q&A
## Remote Technical Interview Sandbox with WebRTC Audio & Code Run

This document prepares software engineers, architects, and candidates for rigorous technical defense questions from engineering panels, system judges, and architecture evaluators.

---

### Question 1: How does WebRTC signaling work in this architecture, and how do you guarantee sub-100ms peer connection latency?

**Answer:**
WebRTC enables direct browser-to-browser peer-to-peer transport for audio and video, but browsers cannot locate each other directly over the public internet without an initial handshake.
In our platform:
1. **Signaling Channel:** We use Socket.io over WebSocket as the out-of-band signaling plane. When Peer A (Interviewer) and Peer B (Candidate) enter the same room ID, the signaling server exchanges Session Description Protocol (SDP) offers, answers, and Interactive Connectivity Establishment (ICE) candidate packets.
2. **Sub-100ms Handshake Optimization:**
   - We utilize Google's low-latency STUN cluster (`stun:stun.l.google.com:19302`) to resolve Reflexive ICE candidates in parallel with SDP offer generation (Trickle ICE).
   - Rather than waiting for complete candidate gathering before dispatching the SDP, we emit ICE candidates incrementally as soon as they are resolved via the signaling socket.
   - Once the candidate pair with the lowest RTT is validated via STUN binding checks, the browser immediately establishes direct SRTP (Secure Real-Time Transport Protocol) media channels. Because media travels directly between peer machines over UDP without traversing any intermediate media server or SFU, latency is strictly bounded by the direct physical network route—consistently achieving round-trip times well under 100ms on broadband networks.

---

### Question 2: Why did you choose a centralized backend proxy for Judge0 CE rather than direct client-to-Judge0 API calls?

**Answer:**
Direct client calls to a compiler API violate fundamental enterprise security and architectural constraints:
1. **Zero Secret Leakage:** If the frontend called Judge0 CE directly using an API key or bearer token, any candidate could open Chrome DevTools, inspect network requests, extract the secret key, and deplete quotas or compromise third-party billing.
2. **Abuse Mitigation & Rate Limiting:** The backend proxy implements token-bucket rate limiting (e.g. max 5 executions per minute per room) and sanitizes request sizes, stopping malicious code spam or infinite-loop DDoS attacks.
3. **Execution Timeouts & Sandboxing:** Judge0 isolates executions inside Linux `cgroups` with CPU time limits (default 5.0s), memory limits (128MB), and network disablement (`--network none`). The backend ensures that even if a student writes `while(true) {}` or `fork()`, the sandbox terminates gracefully and reports `Time Limit Exceeded` without crashing the client browser.
4. **Resilient Fallback Mode:** If the public Judge0 CE server encounters downtime or rate limits during a live interview, our backend proxy automatically detects the upstream HTTP 429/503 and switches to an internal isolated execution worker (for Python and JavaScript), ensuring the interview proceeds without interruption.

---

### Question 3: How is real-time code editor synchronization handled between the interviewer and candidate? How do you prevent cursor jumping and race conditions?

**Answer:**
Collaborative code editing requires handling concurrent typing, caret position stability, and text consistency.
1. **Operational Delta Broadcast:** When either user edits code in Monaco Editor, an `onDidChangeModelContent` event triggers. We calculate an incremental delta and broadcast it along with a monotonically increasing document version vector and the user's cursor position.
2. **Cursor Stability (Caret Preservation):** To prevent the annoying "caret jumping to line 1" bug seen in naive implementations, incoming remote changes are applied using Monaco's `model.applyEdits()`. This native Monaco API automatically recalculates and preserves local user selections and cursor positions relative to inserted or deleted text offsets.
3. **Remote Cursor Badging:** Each remote participant's cursor position is rendered using Monaco Editor's Content Widget and Glyphs API. We draw a colored vertical bar and an attached label pill ("Interviewer" in purple or "Candidate" in blue) with a smooth CSS transition.
4. **Debounced Sync:** High-frequency keystrokes are batched and transmitted at 60Hz intervals, optimizing bandwidth while ensuring perceptible real-time responsiveness (<30ms local perceptual sync).

---

### Question 4: How are Interviewer Private Notes and Problem Statements isolated from candidate snooping?

**Answer:**
1. **Role-Based State Isolation:** When a user enters the interview room, their session role is negotiated. The Interviewer panel (scorecard metrics, rubrics, private notes, challenge search library) is conditionally rendered and managed strictly within the interviewer's local React state.
2. **Zero Signal Leakage:** Private notes, scorecard ratings (1-5 for Problem Solving, Code Quality, Communication), and interviewer scratchpads are **never** emitted over the room's Socket.io broadcast channel. Socket events for private data are filtered out at the client component boundary and only saved to the interviewer's local encrypted storage or session export buffer.
3. **Problem Statement Injection:** When the interviewer selects an algorithmic challenge from the library (e.g. "LRU Cache" or "Two Sum"), an explicit `interviewer-set-problem` event is dispatched. The server validates the sender's role, updates the room's active challenge descriptor, and broadcasts the public challenge metadata (description, sample test cases, starter code) to the candidate while keeping hidden edge-case tests and solutions restricted to the interviewer.

---

### Question 5: What happens when a network connection drops or fluctuates during an active interview?

**Answer:**
The platform is designed with fault resilience at multiple layers:
1. **Socket.io Auto-Reconnection:** If the signaling connection drops, Socket.io automatically attempts exponential backoff reconnection. Upon reconnecting, the client emits `rejoin-room`, and the server immediately pushes the latest cached code state, active problem, and participant list.
2. **WebRTC ICE Restart:** If the direct peer connection degrades (detected via `peerConnection.onconnectionstatechange` or WebRTC stats reporting packet loss > 15%), an ICE restart is triggered automatically via signaling to discover alternative network routes.
3. **Local State Persistence:** The candidate's editor buffer is persisted in `localStorage` in real-time. Even in the event of an accidental browser refresh or tab crash, the candidate loses zero lines of written code upon reloading the URL.

---

### Question 6: How does the system achieve $0.00 total infrastructure operating cost?

**Answer:**
Every layer has been architected to leverage robust, production-grade free tiers:
- **Frontend:** Hosted on Vercel's Edge Network (unlimited static bandwidth, automatic SSL, global CDN).
- **Signaling Backend:** Hosted on Render's free Web Service tier (provides native WebSocket and Express support).
- **WebRTC NAT Traversal:** Powered by Google's globally distributed public STUN servers (`stun.l.google.com:19302`), requiring zero paid TURN bandwidth for standard symmetric-to-reflexive routes.
- **Code Execution:** Powered by Judge0 CE's open-source public endpoints and lightweight backend sandboxing.
- **Result:** Enterprise-grade technical interview capabilities with zero recurring cloud bills.
