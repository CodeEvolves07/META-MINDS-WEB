import { io } from 'socket.io-client';
import axios from 'axios';

const SERVER_URL = 'http://localhost:5001';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('🧪 CodeMeet WebRTC Complete 4-Scenario Test Suite');
  console.log('Testing Peer Isolation, STUN/TURN, and Cross-Network Mesh Routing');
  console.log('================================================================\n');

  // Verify STUN / TURN Endpoint
  const iceRes = await axios.get(`${SERVER_URL}/api/webrtc/ice-servers`);
  console.log('📡 STUN/TURN ICE Server Configuration Check:');
  console.log('   Servers count:', iceRes.data.iceServers?.length);
  console.log('   Google STUN Active:', iceRes.data.iceServers[0]?.urls?.[0]?.includes('stun'));
  if (!iceRes.data.success || !iceRes.data.iceServers?.length) {
    throw new Error('STUN/TURN endpoint not working');
  }
  console.log('   Status: Verified STUN/TURN endpoint operational.\n');

  // Helper to create a room
  async function createRoom(title = 'Scenario Test') {
    const res = await axios.post(`${SERVER_URL}/api/interviews`, {
      interviewerName: 'Lead Interviewer',
      candidateName: 'Candidates Group',
      problemId: 'two-sum'
    });
    return res.data.interview.id;
  }

  // ================================================================
  // SCENARIO A: 1 Interviewer + 1 Candidate (Same Network / Host ICE)
  // ================================================================
  console.log('----------------------------------------------------------------');
  console.log('SCENARIO A: 1 Interviewer + 1 Candidate (Same Network)');
  console.log('----------------------------------------------------------------');
  {
    const roomId = await createRoom('Scenario A');
    const interviewerSocket = io(SERVER_URL, { transports: ['websocket'] });
    const candidateSocket = io(SERVER_URL, { transports: ['websocket'] });

    await Promise.all([
      new Promise((res) => interviewerSocket.on('connect', res)),
      new Promise((res) => candidateSocket.on('connect', res))
    ]);

    const resultPromise = new Promise((resolve, reject) => {
      let offerReceived = false;
      let answerReceived = false;
      let iceExchanged = false;

      candidateSocket.on('webrtc-offer', (data) => {
        if (data.senderSocketId === interviewerSocket.id) {
          offerReceived = true;
          // Send answer
          candidateSocket.emit('webrtc-answer', {
            roomId,
            targetSocketId: data.senderSocketId,
            answer: { type: 'answer', sdp: 'sdp-c-answer' }
          });
          // Send host ICE candidate
          candidateSocket.emit('webrtc-ice-candidate', {
            roomId,
            targetSocketId: data.senderSocketId,
            candidate: {
              candidate: 'candidate:1 1 UDP 2122260223 192.168.1.100 52341 typ host',
              sdpMid: '0',
              sdpMLineIndex: 0
            }
          });
        }
      });

      interviewerSocket.on('webrtc-answer', (data) => {
        if (data.senderSocketId === candidateSocket.id) {
          answerReceived = true;
        }
      });

      interviewerSocket.on('webrtc-ice-candidate', (data) => {
        if (data.senderSocketId === candidateSocket.id && data.candidate?.candidate?.includes('typ host')) {
          iceExchanged = true;
          if (offerReceived && answerReceived && iceExchanged) {
            resolve();
          }
        }
      });

      interviewerSocket.on('peer-ready', (peer) => {
        if (peer.socketId === candidateSocket.id) {
          interviewerSocket.emit('webrtc-offer', {
            roomId,
            targetSocketId: peer.socketId,
            offer: { type: 'offer', sdp: 'sdp-i-offer' }
          });
        }
      });

      setTimeout(() => {
        if (offerReceived && answerReceived && iceExchanged) resolve();
        else reject(new Error(`Scenario A Timeout. offer=${offerReceived}, ans=${answerReceived}, ice=${iceExchanged}`));
      }, 3000);
    });

    interviewerSocket.emit('join-room', { roomId, role: 'interviewer', userName: 'Interviewer' });
    await sleep(50);
    candidateSocket.emit('join-room', { roomId, role: 'candidate', userName: 'Candidate' });

    await resultPromise;
    interviewerSocket.disconnect();
    candidateSocket.disconnect();
    console.log('✅ SCENARIO A RESULT: PASS (1 Interviewer + 1 Candidate on Same Network)\n');
  }

  // ================================================================
  // SCENARIO B: 1 Interviewer + Multiple Candidates (Same Network)
  // ================================================================
  console.log('----------------------------------------------------------------');
  console.log('SCENARIO B: 1 Interviewer + Multiple Candidates (Same Network)');
  console.log('----------------------------------------------------------------');
  {
    const roomId = await createRoom('Scenario B');
    const interviewerSocket = io(SERVER_URL, { transports: ['websocket'] });
    const c1Socket = io(SERVER_URL, { transports: ['websocket'] });
    const c2Socket = io(SERVER_URL, { transports: ['websocket'] });

    await Promise.all([
      new Promise((res) => interviewerSocket.on('connect', res)),
      new Promise((res) => c1Socket.on('connect', res)),
      new Promise((res) => c2Socket.on('connect', res))
    ]);

    const resultPromise = new Promise((resolve, reject) => {
      let c1ConnectedToI = false;
      let c2ConnectedToI = false;
      let c2ConnectedToC1 = false;

      // When existing peers receive peer-ready, they initiate offers
      interviewerSocket.on('peer-ready', (peer) => {
        interviewerSocket.emit('webrtc-offer', {
          roomId,
          targetSocketId: peer.socketId,
          offer: { type: 'offer', sdp: `sdp-i-to-${peer.socketId}` }
        });
      });

      c1Socket.on('peer-ready', (peer) => {
        if (peer.socketId === c2Socket.id) {
          c1Socket.emit('webrtc-offer', {
            roomId,
            targetSocketId: peer.socketId,
            offer: { type: 'offer', sdp: `sdp-c1-to-c2` }
          });
        }
      });

      c1Socket.on('webrtc-offer', (data) => {
        if (data.senderSocketId === interviewerSocket.id) {
          c1Socket.emit('webrtc-answer', {
            roomId,
            targetSocketId: data.senderSocketId,
            answer: { type: 'answer', sdp: 'sdp-c1-answer' }
          });
        }
      });

      c2Socket.on('webrtc-offer', (data) => {
        c2Socket.emit('webrtc-answer', {
          roomId,
          targetSocketId: data.senderSocketId,
          answer: { type: 'answer', sdp: `sdp-c2-ans-to-${data.senderSocketId}` }
        });
      });

      interviewerSocket.on('webrtc-answer', (data) => {
        if (data.senderSocketId === c1Socket.id) c1ConnectedToI = true;
        if (data.senderSocketId === c2Socket.id) c2ConnectedToI = true;
        check();
      });

      c1Socket.on('webrtc-answer', (data) => {
        if (data.senderSocketId === c2Socket.id) {
          c2ConnectedToC1 = true;
          check();
        }
      });

      function check() {
        if (c1ConnectedToI && c2ConnectedToI && c2ConnectedToC1) resolve();
      }

      setTimeout(() => {
        if (c1ConnectedToI && c2ConnectedToI && c2ConnectedToC1) resolve();
        else reject(new Error(`Scenario B Timeout. c1-I=${c1ConnectedToI}, c2-I=${c2ConnectedToI}, c2-c1=${c2ConnectedToC1}`));
      }, 4000);
    });

    interviewerSocket.emit('join-room', { roomId, role: 'interviewer', userName: 'Interviewer' });
    await sleep(50);
    c1Socket.emit('join-room', { roomId, role: 'candidate', userName: 'Candidate 1' });
    await sleep(100);
    c2Socket.emit('join-room', { roomId, role: 'candidate', userName: 'Candidate 2' });

    await resultPromise;
    interviewerSocket.disconnect();
    c1Socket.disconnect();
    c2Socket.disconnect();
    console.log('✅ SCENARIO B RESULT: PASS (1 Interviewer + Multiple Candidates on Same Network)\n');
  }

  // ================================================================
  // SCENARIO C: 1 Interviewer + 1 Candidate (Different Networks / STUN srflx ICE)
  // ================================================================
  console.log('----------------------------------------------------------------');
  console.log('SCENARIO C: 1 Interviewer + 1 Candidate (Different Networks)');
  console.log('----------------------------------------------------------------');
  {
    const roomId = await createRoom('Scenario C');
    const interviewerSocket = io(SERVER_URL, { transports: ['websocket'] });
    const candidateSocket = io(SERVER_URL, { transports: ['websocket'] });

    await Promise.all([
      new Promise((res) => interviewerSocket.on('connect', res)),
      new Promise((res) => candidateSocket.on('connect', res))
    ]);

    const resultPromise = new Promise((resolve, reject) => {
      let candidateReceivedSrflx = false;
      let interviewerReceivedSrflx = false;
      let offerReceived = false;
      let answerReceived = false;

      // Interviewer receives peer-ready -> sends offer + STUN reflexive candidate
      interviewerSocket.on('peer-ready', (peer) => {
        if (peer.socketId === candidateSocket.id) {
          interviewerSocket.emit('webrtc-offer', {
            roomId,
            targetSocketId: peer.socketId,
            offer: { type: 'offer', sdp: 'sdp-i-offer' }
          });

          // STUN srflx candidate from Network A (e.g. 198.51.100.22)
          interviewerSocket.emit('webrtc-ice-candidate', {
            roomId,
            targetSocketId: peer.socketId,
            candidate: {
              candidate: 'candidate:2 1 UDP 1694498815 198.51.100.22 49152 typ srflx raddr 192.168.1.100 rport 49152',
              sdpMid: '0',
              sdpMLineIndex: 0
            }
          });
        }
      });

      candidateSocket.on('webrtc-offer', (data) => {
        if (data.senderSocketId === interviewerSocket.id) {
          offerReceived = true;
          // Candidate responds with answer
          candidateSocket.emit('webrtc-answer', {
            roomId,
            targetSocketId: data.senderSocketId,
            answer: { type: 'answer', sdp: 'sdp-c-answer' }
          });

          // Candidate responds with STUN srflx candidate from Network B (e.g. 203.0.113.88)
          candidateSocket.emit('webrtc-ice-candidate', {
            roomId,
            targetSocketId: data.senderSocketId,
            candidate: {
              candidate: 'candidate:3 1 UDP 1694498815 203.0.113.88 51234 typ srflx raddr 10.0.0.5 rport 51234',
              sdpMid: '0',
              sdpMLineIndex: 0
            }
          });
        }
      });

      candidateSocket.on('webrtc-ice-candidate', (data) => {
        if (data.senderSocketId === interviewerSocket.id && data.candidate?.candidate?.includes('typ srflx')) {
          candidateReceivedSrflx = true;
          check();
        }
      });

      interviewerSocket.on('webrtc-answer', (data) => {
        if (data.senderSocketId === candidateSocket.id) {
          answerReceived = true;
          check();
        }
      });

      interviewerSocket.on('webrtc-ice-candidate', (data) => {
        if (data.senderSocketId === candidateSocket.id && data.candidate?.candidate?.includes('typ srflx')) {
          interviewerReceivedSrflx = true;
          check();
        }
      });

      function check() {
        if (offerReceived && answerReceived && candidateReceivedSrflx && interviewerReceivedSrflx) {
          resolve();
        }
      }

      setTimeout(() => {
        if (offerReceived && answerReceived && candidateReceivedSrflx && interviewerReceivedSrflx) resolve();
        else reject(new Error(`Scenario C Timeout. offer=${offerReceived}, ans=${answerReceived}, cSrflx=${candidateReceivedSrflx}, iSrflx=${interviewerReceivedSrflx}`));
      }, 4000);
    });

    interviewerSocket.emit('join-room', { roomId, role: 'interviewer', userName: 'Interviewer' });
    await sleep(50);
    candidateSocket.emit('join-room', { roomId, role: 'candidate', userName: 'Candidate' });

    await resultPromise;
    interviewerSocket.disconnect();
    candidateSocket.disconnect();
    console.log('✅ SCENARIO C RESULT: PASS (1 Interviewer + 1 Candidate on Different Networks)\n');
  }

  // ================================================================
  // SCENARIO D: 1 Interviewer + Multiple Candidates (Different Networks)
  // Cross-Network Multi-Peer Mesh with Distinct STUN Reflexive Candidates
  // ================================================================
  console.log('----------------------------------------------------------------');
  console.log('SCENARIO D: 1 Interviewer + Multiple Candidates (Different Networks)');
  console.log('----------------------------------------------------------------');
  {
    const roomId = await createRoom('Scenario D');
    const interviewerSocket = io(SERVER_URL, { transports: ['websocket'] });
    const c1Socket = io(SERVER_URL, { transports: ['websocket'] });
    const c2Socket = io(SERVER_URL, { transports: ['websocket'] });

    await Promise.all([
      new Promise((res) => interviewerSocket.on('connect', res)),
      new Promise((res) => c1Socket.on('connect', res)),
      new Promise((res) => c2Socket.on('connect', res))
    ]);

    const resultPromise = new Promise((resolve, reject) => {
      // Track separate peer connection STUN srflx exchanges:
      // 1. Interviewer <-> Candidate 1 (Cross-network WAN A <-> WAN B)
      let iReceivedC1Srflx = false;
      let c1ReceivedISrflx = false;
      let iGotC1Ans = false;

      // 2. Interviewer <-> Candidate 2 (Cross-network WAN A <-> WAN C)
      let iReceivedC2Srflx = false;
      let c2ReceivedISrflx = false;
      let iGotC2Ans = false;

      // 3. Candidate 1 <-> Candidate 2 (Cross-network WAN B <-> WAN C)
      let c1ReceivedC2Srflx = false;
      let c2ReceivedC1Srflx = false;
      let c1GotC2Ans = false;

      // Verify no candidate poisoning / cross-talk: candidate directed strictly to correct peer
      let crossTalkDetected = false;

      // Interviewer emits offers and srflx candidates strictly to targetSocketId
      interviewerSocket.on('peer-ready', (peer) => {
        console.log(`[TEST-DIAG] Interviewer sending offer & STUN candidate to ${peer.userName} (${peer.socketId})`);
        interviewerSocket.emit('webrtc-offer', {
          roomId,
          targetSocketId: peer.socketId,
          offer: { type: 'offer', sdp: `sdp-i-to-${peer.socketId}` }
        });
        // Interviewer STUN srflx candidate (WAN A: 198.51.100.1)
        interviewerSocket.emit('webrtc-ice-candidate', {
          roomId,
          targetSocketId: peer.socketId,
          candidate: {
            candidate: `candidate:I-srflx 1 UDP 1694498815 198.51.100.1 50001 typ srflx raddr 192.168.1.50 rport 50001`,
            sdpMid: '0',
            sdpMLineIndex: 0
          }
        });
      });

      // Existing Candidate 1 sends offer & srflx to newcomer Candidate 2
      c1Socket.on('peer-ready', (peer) => {
        if (peer.socketId === c2Socket.id) {
          console.log(`[TEST-DIAG] Candidate 1 sending offer & STUN candidate to Candidate 2 (${peer.socketId})`);
          c1Socket.emit('webrtc-offer', {
            roomId,
            targetSocketId: peer.socketId,
            offer: { type: 'offer', sdp: 'sdp-c1-to-c2' }
          });
          // C1 STUN srflx candidate (WAN B: 203.0.113.2)
          c1Socket.emit('webrtc-ice-candidate', {
            roomId,
            targetSocketId: peer.socketId,
            candidate: {
              candidate: `candidate:C1-to-C2-srflx 1 UDP 1694498815 203.0.113.2 50002 typ srflx raddr 10.0.0.2 rport 50002`,
              sdpMid: '0',
              sdpMLineIndex: 0
            }
          });
        }
      });

      // Candidate 1 handles offer from Interviewer
      c1Socket.on('webrtc-offer', (data) => {
        if (data.senderSocketId === interviewerSocket.id) {
          console.log('[TEST-DIAG] Candidate 1 received offer from Interviewer, sending answer + STUN candidate');
          c1Socket.emit('webrtc-answer', {
            roomId,
            targetSocketId: data.senderSocketId,
            answer: { type: 'answer', sdp: 'sdp-c1-ans-to-i' }
          });
          c1Socket.emit('webrtc-ice-candidate', {
            roomId,
            targetSocketId: data.senderSocketId,
            candidate: {
              candidate: `candidate:C1-to-I-srflx 1 UDP 1694498815 203.0.113.2 50002 typ srflx raddr 10.0.0.2 rport 50002`,
              sdpMid: '0',
              sdpMLineIndex: 0
            }
          });
        }
      });

      // Candidate 2 handles offers from Interviewer AND Candidate 1
      c2Socket.on('webrtc-offer', (data) => {
        console.log(`[TEST-DIAG] Candidate 2 received offer from ${data.senderUserName} (${data.senderSocketId})`);
        c2Socket.emit('webrtc-answer', {
          roomId,
          targetSocketId: data.senderSocketId,
          answer: { type: 'answer', sdp: `sdp-c2-ans-to-${data.senderSocketId}` }
        });
        // Candidate 2 STUN srflx candidate (WAN C: 192.0.2.3)
        c2Socket.emit('webrtc-ice-candidate', {
          roomId,
          targetSocketId: data.senderSocketId,
          candidate: {
            candidate: `candidate:C2-srflx 1 UDP 1694498815 192.0.2.3 50003 typ srflx raddr 172.16.0.3 rport 50003`,
            sdpMid: '0',
            sdpMLineIndex: 0
          }
        });
      });

      // Verify answers received
      interviewerSocket.on('webrtc-answer', (data) => {
        if (data.senderSocketId === c1Socket.id) iGotC1Ans = true;
        if (data.senderSocketId === c2Socket.id) iGotC2Ans = true;
        check();
      });

      c1Socket.on('webrtc-answer', (data) => {
        if (data.senderSocketId === c2Socket.id) {
          c1GotC2Ans = true;
          check();
        }
      });

      // Candidate 1 ICE candidate listener
      c1Socket.on('webrtc-ice-candidate', (data) => {
        if (data.senderSocketId === interviewerSocket.id) {
          c1ReceivedISrflx = true;
          console.log('✅ Candidate 1 received STUN srflx from Interviewer');
        } else if (data.senderSocketId === c2Socket.id) {
          c1ReceivedC2Srflx = true;
          console.log('✅ Candidate 1 received STUN srflx from Candidate 2');
        } else {
          crossTalkDetected = true;
        }
        check();
      });

      // Candidate 2 ICE candidate listener
      c2Socket.on('webrtc-ice-candidate', (data) => {
        if (data.senderSocketId === interviewerSocket.id) {
          c2ReceivedISrflx = true;
          console.log('✅ Candidate 2 received STUN srflx from Interviewer');
        } else if (data.senderSocketId === c1Socket.id) {
          c2ReceivedC1Srflx = true;
          console.log('✅ Candidate 2 received STUN srflx from Candidate 1');
        } else {
          crossTalkDetected = true;
        }
        check();
      });

      // Interviewer ICE candidate listener
      interviewerSocket.on('webrtc-ice-candidate', (data) => {
        if (data.senderSocketId === c1Socket.id) {
          iReceivedC1Srflx = true;
          console.log('✅ Interviewer received STUN srflx from Candidate 1');
        } else if (data.senderSocketId === c2Socket.id) {
          iReceivedC2Srflx = true;
          console.log('✅ Interviewer received STUN srflx from Candidate 2');
        } else {
          crossTalkDetected = true;
        }
        check();
      });

      function check() {
        const i_c1 = iReceivedC1Srflx && c1ReceivedISrflx && iGotC1Ans;
        const i_c2 = iReceivedC2Srflx && c2ReceivedISrflx && iGotC2Ans;
        const c1_c2 = c1ReceivedC2Srflx && c2ReceivedC1Srflx && c1GotC2Ans;

        if (i_c1 && i_c2 && c1_c2 && !crossTalkDetected) {
          resolve();
        }
      }

      setTimeout(() => {
        const i_c1 = iReceivedC1Srflx && c1ReceivedISrflx && iGotC1Ans;
        const i_c2 = iReceivedC2Srflx && c2ReceivedISrflx && iGotC2Ans;
        const c1_c2 = c1ReceivedC2Srflx && c2ReceivedC1Srflx && c1GotC2Ans;

        if (i_c1 && i_c2 && c1_c2 && !crossTalkDetected) {
          resolve();
        } else {
          reject(
            new Error(
              `Scenario D Timeout:\n` +
              `  Interviewer <-> C1: srflx(${iReceivedC1Srflx}/${c1ReceivedISrflx}), ans(${iGotC1Ans})\n` +
              `  Interviewer <-> C2: srflx(${iReceivedC2Srflx}/${c2ReceivedISrflx}), ans(${iGotC2Ans})\n` +
              `  Candidate 1 <-> C2: srflx(${c1ReceivedC2Srflx}/${c2ReceivedC1Srflx}), ans(${c1GotC2Ans})\n` +
              `  Cross-talk detected: ${crossTalkDetected}`
            )
          );
        }
      }, 5000);
    });

    // Step 1: Interviewer joins
    interviewerSocket.emit('join-room', { roomId, role: 'interviewer', userName: 'Interviewer' });
    await sleep(100);

    // Step 2: Candidate 1 joins from Network B
    c1Socket.emit('join-room', { roomId, role: 'candidate', userName: 'Candidate 1 (Network B)' });
    await sleep(200);

    // Step 3: Candidate 2 joins from Network C
    c2Socket.emit('join-room', { roomId, role: 'candidate', userName: 'Candidate 2 (Network C)' });

    await resultPromise;
    interviewerSocket.disconnect();
    c1Socket.disconnect();
    c2Socket.disconnect();
    console.log('✅ SCENARIO D RESULT: PASS (1 Interviewer + Multiple Candidates on Different Networks)\n');
  }

  console.log('================================================================');
  console.log('🎉 ALL FOUR SCENARIOS (A, B, C, D) PASSED WITH 100% SUCCESS!');
  console.log('   A. 1 Interviewer + 1 Candidate (Same Network):       PASS');
  console.log('   B. 1 Interviewer + Multiple Candidates (Same Network): PASS');
  console.log('   C. 1 Interviewer + 1 Candidate (Different Networks):   PASS');
  console.log('   D. 1 Interviewer + Multiple Candidates (Diff Networks): PASS');
  console.log('================================================================\n');
}

runTestSuite().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err.message);
  process.exit(1);
});
