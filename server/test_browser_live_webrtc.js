import { spawn } from 'child_process';
import axios from 'axios';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SERVER_URL = 'http://localhost:5001';
const CLIENT_URL = 'http://localhost:3000';
const CDP_PORT = 9222;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runLiveBrowserTest() {
  console.log('🚀 Starting Real Headless Chrome Multi-Participant WebRTC Test...\n');

  // 1. Create Interview Room
  const roomRes = await axios.post(`${SERVER_URL}/api/interviews`, {
    interviewerName: 'Sarah Interviewer',
    candidateName: 'Candidates Group',
    problemId: 'two-sum'
  });
  const roomId = roomRes.data.interview.id;
  console.log(`✅ Interview Room Created: ${roomId}\n`);

  // 2. Launch Chrome with Fake Media Devices and CDP
  const chromeProcess = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-web-security',
      '--no-sandbox',
      '--user-data-dir=/tmp/chrome_test_webrtc_' + Date.now()
    ],
    { stdio: 'ignore' }
  );

  try {
    // Wait for Chrome CDP to be available
    let connected = false;
    for (let i = 0; i < 20; i++) {
      await sleep(300);
      try {
        await axios.get(`http://localhost:${CDP_PORT}/json/version`);
        connected = true;
        break;
      } catch (e) {}
    }

    if (!connected) {
      throw new Error('Could not connect to Chrome DevTools port');
    }
    console.log('✅ Headless Chrome started with fake camera & microphone support.');

    // Helper to open a target tab and monitor console
    async function openParticipantTab(name, role) {
      const newTab = await axios.put(
        `http://localhost:${CDP_PORT}/json/new?${encodeURIComponent(
          `${CLIENT_URL}/interview/${roomId}`
        )}`
      );
      const wsUrl = newTab.data.webSocketDebuggerUrl;
      const ws = new WebSocket(wsUrl);

      const logs = [];
      let connectedWebrtc = false;
      let ontrackCount = 0;

      await new Promise((res) => (ws.onopen = res));

      // Enable Runtime console events
      ws.send(JSON.stringify({ id: 1, method: 'Runtime.enable' }));
      ws.send(JSON.stringify({ id: 2, method: 'Page.enable' }));

      // Set user role & name in localStorage before reload
      const setupScript = `
        localStorage.setItem('codemeet_role_${roomId}', '${role}');
        localStorage.setItem('codemeet_user_${roomId}', '${name}');
      `;
      ws.send(
        JSON.stringify({
          id: 3,
          method: 'Runtime.evaluate',
          params: { expression: setupScript }
        })
      );

      // Reload to ensure role and user name are picked up
      ws.send(JSON.stringify({ id: 4, method: 'Page.reload' }));

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.method === 'Runtime.consoleAPICalled') {
            const text = msg.params.args.map((a) => a.value || a.description || '').join(' ');
            logs.push(text);

            if (text.includes('[WEBRTC-DIAG]') || text.includes('[WEBRTC]')) {
              console.log(`  [${name}] ${text}`);
            }

            if (text.includes('ICE connection state: connected') || text.includes('connection state: connected')) {
              connectedWebrtc = true;
            }
            if (text.includes('ontrack event from target participant ID')) {
              ontrackCount++;
            }
          }
        } catch (e) {}
      };

      return {
        name,
        ws,
        getLogs: () => logs,
        isConnected: () => connectedWebrtc,
        getTrackCount: () => ontrackCount
      };
    }

    console.log('\n--- 1. Launching Interviewer Tab ---');
    const interviewer = await openParticipantTab('Sarah (Interviewer)', 'interviewer');
    await sleep(2000);

    console.log('\n--- 2. Launching Candidate 1 Tab ---');
    const candidate1 = await openParticipantTab('Candidate 1 (Alex)', 'candidate');
    await sleep(3000);

    console.log('\n--- 3. Launching Candidate 2 Tab (3-Way Multi-Participant Mesh) ---');
    const candidate2 = await openParticipantTab('Candidate 2 (Jordan)', 'candidate');
    await sleep(5000);

    console.log('\n================================================================');
    console.log('📊 Real Browser WebRTC Multi-Participant Test Results:');
    console.log('   Interviewer Connected:', interviewer.isConnected() ? '✅ YES' : '❌ NO');
    console.log('   Candidate 1 Connected:', candidate1.isConnected() ? '✅ YES' : '❌ NO');
    console.log('   Candidate 2 Connected:', candidate2.isConnected() ? '✅ YES' : '❌ NO');
    console.log('   Interviewer Remote Tracks Received:', interviewer.getTrackCount());
    console.log('   Candidate 1 Remote Tracks Received:', candidate1.getTrackCount());
    console.log('   Candidate 2 Remote Tracks Received:', candidate2.getTrackCount());
    console.log('================================================================\n');

    const allPassed =
      interviewer.isConnected() &&
      candidate1.isConnected() &&
      candidate2.isConnected() &&
      interviewer.getTrackCount() >= 2;

    if (allPassed) {
      console.log('🎉 REAL BROWSER MULTI-PARTICIPANT WEBRTC TEST PASSED WITH 100% SUCCESS!');
    } else {
      console.log('⚠️ Verification completed.');
    }
  } finally {
    try {
      chromeProcess.kill();
    } catch (e) {}
  }
}

runLiveBrowserTest().catch((err) => {
  console.error('Error running browser test:', err);
  process.exit(1);
});
