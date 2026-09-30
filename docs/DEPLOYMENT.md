# Production Deployment Guide
## Remote Technical Interview Sandbox with WebRTC Audio & Code Run

This guide outlines step-by-step instructions to deploy the platform to **Vercel** (Frontend) and **Render** (Backend) with **zero paid server dependencies**.

---

### 1. Architectural Architecture Breakdown for Deployment

```
[Candidate / Interviewer Browsers]
           │
           ├────────────────────────────┐
           ▼                            ▼
[Vercel: React 19 Frontend]    [Render: Node.js / Express / Socket.io]
- Static SPA hosting           - WebRTC Signaling Relay
- Monaco Editor Assets         - Room State & Sync Engine
- Client WebRTC Controller     - Judge0 Secure Proxy & Sandbox
           │                            │
           └──────────────┬─────────────┘
                          ▼
            [Google Free STUN Server]
            stun:stun.l.google.com:19302
                          │
                          ▼
           [Judge0 CE Code Sandbox API]
```

---

### 2. Backend Deployment (Render)

Render provides a generous free tier for Node.js web services with native WebSocket support required by Socket.io.

#### Step 2.1: Prepare Repository
The backend code resides in the `/backend` directory.

#### Step 2.2: Create Render Web Service
1. Log in to [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** -> **Web Service**.
3. Connect your GitHub/GitLab repository.
4. Configure the service settings:
   - **Name:** `interview-sandbox-backend`
   - **Root Directory:** `backend`
   - **Environment:** `Node`
   - **Branch:** `main` (or active branch)
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** `Free`

#### Step 2.3: Configure Environment Variables
In the Render dashboard under **Environment**, add the following key-value pairs:

| Variable Name | Value | Purpose |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables Express production optimizations |
| `PORT` | `10000` | Port assigned by Render |
| `CORS_ORIGIN` | `https://your-frontend-app.vercel.app` | Allowed CORS origins for Socket.io and API |
| `JUDGE0_API_URL` | `https://ce.judge0.com` | Free Judge0 CE public API or RapidAPI endpoint |
| `JUDGE0_API_KEY` | *(Optional, if using RapidAPI)* | Header key for Judge0 authentication |
| `RATE_LIMIT_PER_MIN` | `60` | Protection against execution abuse |

Render will assign you a public URL such as `https://interview-sandbox-backend.onrender.com`.

---

### 3. Frontend Deployment (Vercel)

Vercel provides instant global CDN deployment, SSL certificates, and zero-configuration SPA routing.

#### Step 3.1: Connect Project
1. Log in to [Vercel Dashboard](https://vercel.com/).
2. Click **Add New...** -> **Project**.
3. Select your repository.

#### Step 3.2: Configure Build Settings
- **Framework Preset:** `Vite`
- **Root Directory:** `frontend`
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

#### Step 3.3: Configure Environment Variables
In Vercel's project configuration under **Environment Variables**, set:

| Variable Name | Example Value | Description |
| :--- | :--- | :--- |
| `VITE_SIGNALING_SERVER_URL` | `https://interview-sandbox-backend.onrender.com` | Backend Render URL for Socket.io signaling and proxy |
| `VITE_APP_TITLE` | `Remote Technical Interview Sandbox` | Display title |

#### Step 3.4: SPA Rewrite Rule (`vercel.json`)
The `frontend/vercel.json` file ensures that all client-side routes (e.g. `/room/:roomId`) route to `index.html`:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

### 4. Zero-Cost WebRTC STUN/TURN Optimization

To guarantee sub-100ms connection latency without incurring infrastructure costs, the client uses Google's global STUN servers:
- `stun:stun.l.google.com:19302`
- `stun:stun1.l.google.com:19302`
- `stun:stun2.l.google.com:19302`

If candidates are behind strict enterprise symmetric NATs (which block direct P2P UDP), the platform seamlessly falls back to free open TURN services (e.g., OpenRelay / Metered free tier: 50GB free per month).

---

### 5. Health Checks and Production Smoke Testing

1. **Signaling Health Check:**
   ```bash
   curl -I https://interview-sandbox-backend.onrender.com/health
   # Expected: HTTP 200 OK {"status": "ok", "rooms": 0, "uptime": ...}
   ```
2. **Code Execution Proxy Health Check:**
   ```bash
   curl -X POST https://interview-sandbox-backend.onrender.com/api/execute \
     -H "Content-Type: application/json" \
     -d '{"languageId": 71, "sourceCode": "print(\"Health Check OK\")"}'
   # Expected: {"stdout": "Health Check OK\n", "status": {"id": 3, "description": "Accepted"}}
   ```
3. **P2P Audio/Video Handshake Test:**
   - Open two browser tabs: Tab 1 as Interviewer (`?role=interviewer&room=test`), Tab 2 as Candidate (`?role=candidate&room=test`).
   - Confirm video tiles load, audio indicators register mic input, and WebRTC RTT indicator reports < 100ms.
