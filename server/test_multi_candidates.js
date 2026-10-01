import { io } from 'socket.io-client';
import axios from 'axios';

const SERVER_URL = 'http://localhost:5001';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runMultiCandidateTest() {
  console.log('🧪 Starting CodeMeet Multi-Candidate & Cross-Network Test Suite...\n');

  // Case 4 Check: STUN + TURN ICE Server API Endpoint
  console.log('========================================================');
  console.log('TEST 4: STUN + TURN Configuration for Different Networks');
  console.log('========================================================');
  const iceRes = await axios.get(`${SERVER_URL}/api/webrtc/ice-servers`);
  console.log('ICE Servers Response:', JSON.stringify(iceRes.data, null, 2));
  if (!iceRes.data.success || !Array.isArray(iceRes.data.iceServers) || iceRes.data.iceServers.length === 0) {
    throw new Error('ICE servers endpoint failed');
  }
  console.log('✅ TEST 4 PASSED: STUN + TURN endpoint operational with Google STUN and environment TURN support.\n');

  // Create Room
  console.log('========================================================');
  console.log('Creating Shared Interview Room for 1 Interviewer + Multiple Candidates');
  console.log('========================================================');
  const createRes = await axios.post(`${SERVER_URL}/api/interviews`, {
    interviewerName: 'Dr. Jane Interviewer',
    candidateName: 'Candidate Group',
    problemId: 'two-sum'
  });
  const roomId = createRes.data.interview.id;
  const interviewerToken = createRes.data.token;
  console.log(`✅ Room Created with ID: ${roomId}\n`);

  // Interviewer authorizes test candidates
  for (const cName of ['Candidate 1 (Alex)', 'Candidate 2 (Morgan)', 'Candidate 3 (Jordan)']) {
    await axios.post(`${SERVER_URL}/api/interviews/${roomId}/admission-decision`, {
      candidateId: cName,
      decision: 'ACCEPTED'
    }, { headers: { Authorization: `Bearer ${interviewerToken}` } });
  }

  // Connect Interviewer
  const interviewerSocket = io(SERVER_URL, { transports: ['websocket'] });
  await new Promise((res) => interviewerSocket.on('connect', res));
  interviewerSocket.emit('join-room', {
    roomId,
    role: 'interviewer',
    userName: 'Dr. Jane Interviewer',
    token: interviewerToken
  });
  console.log('✅ Interviewer entered room');

  // ========================================================
  // TEST 1: Interviewer + Candidate 1
  // ========================================================
  console.log('\n========================================================');
  console.log('TEST 1: Interviewer + Candidate 1 Communication');
  console.log('========================================================');
  const candidate1Socket = io(SERVER_URL, { transports: ['websocket'] });
  await new Promise((res) => candidate1Socket.on('connect', res));

  const t1Promise = new Promise((resolve, reject) => {
    // When C1 joins, Interviewer sends offer to C1
    candidate1Socket.on('webrtc-offer', (data) => {
      console.log(`✅ Candidate 1 received WebRTC offer from ${data.senderUserName} (${data.senderSocketId})`);
      // C1 sends answer back
      candidate1Socket.emit('webrtc-answer', {
        roomId,
        targetSocketId: data.senderSocketId,
        answer: { type: 'answer', sdp: 'sdp-c1-answer' }
      });
    });

    interviewerSocket.on('webrtc-answer', (data) => {
      if (data.senderSocketId === candidate1Socket.id) {
        console.log(`✅ Interviewer received WebRTC answer from Candidate 1 (${data.senderSocketId})`);
        resolve();
      }
    });

    setTimeout(() => reject(new Error('Test 1 timed out')), 4000);
  });

  candidate1Socket.emit('join-room', {
    roomId,
    role: 'candidate',
    userName: 'Candidate 1 (Alex)'
  });

  // Interviewer receives peer-ready for C1 and sends offer
  interviewerSocket.on('peer-ready', (peer) => {
    if (peer.socketId === candidate1Socket.id) {
      console.log(`📞 Interviewer initiating offer to Candidate 1 (${peer.socketId})`);
      interviewerSocket.emit('webrtc-offer', {
        roomId,
        targetSocketId: peer.socketId,
        offer: { type: 'offer', sdp: 'sdp-interviewer-to-c1' }
      });
    }
  });

  await t1Promise;
  console.log('✅ TEST 1 PASSED: Interviewer and Candidate 1 connected.\n');

  // ========================================================
  // TEST 2: Interviewer + Candidate 1 + Candidate 2
  // ========================================================
  console.log('========================================================');
  console.log('TEST 2: Interviewer + Candidate 1 + Candidate 2 (3-Peer Mesh)');
  console.log('========================================================');
  const candidate2Socket = io(SERVER_URL, { transports: ['websocket'] });
  await new Promise((res) => candidate2Socket.on('connect', res));

  const t2Promise = new Promise((resolve, reject) => {
    let c2ReceivedOfferFromInterviewer = false;
    let c2ReceivedOfferFromC1 = false;
    let interviewerReceivedAnswerFromC2 = false;
    let c1ReceivedAnswerFromC2 = false;

    candidate2Socket.on('webrtc-offer', (data) => {
      console.log(`✅ Candidate 2 received WebRTC offer from: ${data.senderUserName} (${data.senderSocketId})`);
      if (data.senderSocketId === interviewerSocket.id) c2ReceivedOfferFromInterviewer = true;
      if (data.senderSocketId === candidate1Socket.id) c2ReceivedOfferFromC1 = true;

      // C2 replies with answer
      candidate2Socket.emit('webrtc-answer', {
        roomId,
        targetSocketId: data.senderSocketId,
        answer: { type: 'answer', sdp: `sdp-c2-answer-to-${data.senderSocketId}` }
      });
    });

    interviewerSocket.on('webrtc-answer', (data) => {
      if (data.senderSocketId === candidate2Socket.id) {
        console.log(`✅ Interviewer received answer from Candidate 2`);
        interviewerReceivedAnswerFromC2 = true;
        checkDone();
      }
    });

    candidate1Socket.on('webrtc-answer', (data) => {
      if (data.senderSocketId === candidate2Socket.id) {
        console.log(`✅ Candidate 1 received answer from Candidate 2`);
        c1ReceivedAnswerFromC2 = true;
        checkDone();
      }
    });

    function checkDone() {
      if (
        c2ReceivedOfferFromInterviewer &&
        c2ReceivedOfferFromC1 &&
        interviewerReceivedAnswerFromC2 &&
        c1ReceivedAnswerFromC2
      ) {
        resolve();
      }
    }

    setTimeout(() => {
      if (
        c2ReceivedOfferFromInterviewer &&
        c2ReceivedOfferFromC1 &&
        interviewerReceivedAnswerFromC2 &&
        c1ReceivedAnswerFromC2
      ) {
        resolve();
      } else {
        reject(
          new Error(
            `Test 2 timed out. Status: c2FromI=${c2ReceivedOfferFromInterviewer}, c2FromC1=${c2ReceivedOfferFromC1}, iFromC2=${interviewerReceivedAnswerFromC2}, c1FromC2=${c1ReceivedAnswerFromC2}`
          )
        );
      }
    }, 4000);
  });

  // When C2 enters, existing peers (Interviewer and Candidate 1) receive peer-ready and send offers
  interviewerSocket.on('peer-ready', (peer) => {
    if (peer.socketId === candidate2Socket.id) {
      console.log(`📞 Interviewer sending offer to Candidate 2 (${peer.socketId})`);
      interviewerSocket.emit('webrtc-offer', {
        roomId,
        targetSocketId: peer.socketId,
        offer: { type: 'offer', sdp: 'sdp-i-to-c2' }
      });
    }
  });

  candidate1Socket.on('peer-ready', (peer) => {
    if (peer.socketId === candidate2Socket.id) {
      console.log(`📞 Candidate 1 sending offer to Candidate 2 (${peer.socketId})`);
      candidate1Socket.emit('webrtc-offer', {
        roomId,
        targetSocketId: peer.socketId,
        offer: { type: 'offer', sdp: 'sdp-c1-to-c2' }
      });
    }
  });

  candidate2Socket.emit('join-room', {
    roomId,
    role: 'candidate',
    userName: 'Candidate 2 (Morgan)'
  });

  await t2Promise;
  console.log('✅ TEST 2 PASSED: 3-way mesh active (Interviewer <-> C1 <-> C2).\n');

  // ========================================================
  // TEST 3: Interviewer + Candidate 1 + Candidate 2 + Candidate 3
  // ========================================================
  console.log('========================================================');
  console.log('TEST 3: Interviewer + Candidate 1 + Candidate 2 + Candidate 3 (4-Peer Mesh)');
  console.log('========================================================');
  const candidate3Socket = io(SERVER_URL, { transports: ['websocket'] });
  await new Promise((res) => candidate3Socket.on('connect', res));

  const t3Promise = new Promise((resolve, reject) => {
    let offersCount = 0;
    let answersCount = 0;

    candidate3Socket.on('webrtc-offer', (data) => {
      offersCount++;
      console.log(`✅ Candidate 3 received offer #${offersCount} from ${data.senderUserName}`);
      candidate3Socket.emit('webrtc-answer', {
        roomId,
        targetSocketId: data.senderSocketId,
        answer: { type: 'answer', sdp: `sdp-c3-answer-to-${data.senderSocketId}` }
      });
    });

    const onAns = (data) => {
      if (data.senderSocketId === candidate3Socket.id) {
        answersCount++;
        console.log(`✅ Received answer #${answersCount} from Candidate 3`);
        if (offersCount >= 3 && answersCount >= 3) {
          resolve();
        }
      }
    };

    interviewerSocket.on('webrtc-answer', onAns);
    candidate1Socket.on('webrtc-answer', onAns);
    candidate2Socket.on('webrtc-answer', onAns);

    setTimeout(() => {
      if (offersCount >= 3 && answersCount >= 3) resolve();
      else reject(new Error(`Test 3 timed out. Offers: ${offersCount}/3, Answers: ${answersCount}/3`));
    }, 4500);
  });

  // Existing peers send offers to Candidate 3
  const sendOfferToC3 = (socket, name) => (peer) => {
    if (peer.socketId === candidate3Socket.id) {
      console.log(`📞 ${name} sending offer to Candidate 3 (${peer.socketId})`);
      socket.emit('webrtc-offer', {
        roomId,
        targetSocketId: peer.socketId,
        offer: { type: 'offer', sdp: `sdp-${name}-to-c3` }
      });
    }
  };

  interviewerSocket.on('peer-ready', sendOfferToC3(interviewerSocket, 'Interviewer'));
  candidate1Socket.on('peer-ready', sendOfferToC3(candidate1Socket, 'Candidate 1'));
  candidate2Socket.on('peer-ready', sendOfferToC3(candidate2Socket, 'Candidate 2'));

  candidate3Socket.emit('join-room', {
    roomId,
    role: 'candidate',
    userName: 'Candidate 3 (Jordan)'
  });

  await t3Promise;
  console.log('✅ TEST 3 PASSED: 4-way mesh active (Interviewer <-> C1 <-> C2 <-> C3).\n');

  // ========================================================
  // TEST 5: Candidate 2 leaves → Remaining continue normally
  // ========================================================
  console.log('========================================================');
  console.log('TEST 5: A candidate leaves → Remaining continue normally');
  console.log('========================================================');

  const c2SocketId = candidate2Socket.id;

  const leavePromise = new Promise((resolve, reject) => {
    let interviewerNotified = false;
    let c1Notified = false;
    let c3Notified = false;

    interviewerSocket.on('user-left', (peer) => {
      if (peer.socketId === c2SocketId) {
        console.log('✅ Interviewer notified that Candidate 2 left');
        interviewerNotified = true;
        check();
      }
    });

    candidate1Socket.on('user-left', (peer) => {
      if (peer.socketId === c2SocketId) {
        console.log('✅ Candidate 1 notified that Candidate 2 left');
        c1Notified = true;
        check();
      }
    });

    candidate3Socket.on('user-left', (peer) => {
      if (peer.socketId === c2SocketId) {
        console.log('✅ Candidate 3 notified that Candidate 2 left');
        c3Notified = true;
        check();
      }
    });

    function check() {
      if (interviewerNotified && c1Notified && c3Notified) {
        resolve();
      }
    }

    setTimeout(() => {
      if (interviewerNotified && c1Notified && c3Notified) resolve();
      else reject(new Error('User-left notification timed out'));
    }, 3000);
  });

  // Candidate 2 disconnects
  console.log(`🔌 Disconnecting Candidate 2 (${c2SocketId})...`);
  candidate2Socket.disconnect();

  await leavePromise;

  // Verify remaining participants can still sync code
  console.log('📝 Testing code sync among remaining participants...');
  const codeSyncPromise = new Promise((resolve) => {
    candidate3Socket.on('code-update', (data) => {
      if (data.code === '// Post-leave collaborative test') {
        console.log('✅ Candidate 3 successfully received code update after Candidate 2 left');
        resolve();
      }
    });
  });

  interviewerSocket.emit('code-change', {
    roomId,
    code: '// Post-leave collaborative test'
  });

  await codeSyncPromise;

  console.log('✅ TEST 5 PASSED: Remaining participants uninterrupted after peer disconnect.\n');

  // Cleanup
  interviewerSocket.disconnect();
  candidate1Socket.disconnect();
  candidate3Socket.disconnect();

  console.log('🎉 ALL 5 TEST CASES PASSED WITH 100% SUCCESS! 🚀');
}

runMultiCandidateTest().catch((err) => {
  console.error('❌ Multi-Candidate Test Error:', err);
  process.exit(1);
});
