import io from 'socket.io-client';
import axios from 'axios';
import { generateToken } from './src/services/authService.js';

const SERVER_URL = 'http://localhost:5001';

function createSocket(opts = {}) {
  return io(SERVER_URL, {
    transports: ['websocket'],
    forceNew: true,
    ...opts
  });
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runMasterSecurityTests() {
  console.log('================================================================');
  console.log('🔒 MASTER SECURITY & AUTHENTICATION HARDENING VERIFICATION SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    // ============================================================================
    // SECTION 25: 10 API SECURITY NEGATIVE TESTS
    // ============================================================================
    console.log('----------------------------------------------------------------');
    console.log('📌 PHASE 1: SECTION 25 — 10 API SECURITY NEGATIVE TESTS');
    console.log('----------------------------------------------------------------');

    // Setup Room 1
    const createRes1 = await axios.post(`${SERVER_URL}/api/interviews`, {
      interviewerName: 'Lead Interviewer',
      candidateName: 'Candidate A'
    });
    const room1Id = createRes1.data.interview.id;
    const room1InterviewerToken = createRes1.data.token;

    // Setup Room 2 (Unrelated room)
    const createRes2 = await axios.post(`${SERVER_URL}/api/interviews`, {
      interviewerName: 'Other Interviewer',
      candidateName: 'Candidate X'
    });
    const room2Id = createRes2.data.interview.id;

    // Join Candidate A in Room 1
    const joinResA = await axios.post(`${SERVER_URL}/api/interviews/${room1Id}/join`, {
      candidateName: 'Candidate A'
    });
    const candidateAToken = joinResA.data.token;

    // Join Candidate B in Room 1
    const joinResB = await axios.post(`${SERVER_URL}/api/interviews/${room1Id}/join`, {
      candidateName: 'Candidate B'
    });
    const candidateBToken = joinResB.data.token;

    // 1. Unauthenticated POST -> protected resource = DENIED (401)
    try {
      await axios.post(`${SERVER_URL}/api/interviews/${room1Id}/session`, {});
      assert(false, 'Test 1: Unauthenticated POST should be denied');
    } catch (err) {
      assert(err.response?.status === 401, 'Test 1: Unauthenticated POST -> protected resource = 401 DENIED');
    }

    // 2. Authenticated Candidate A POST -> Candidate A resource = ALLOWED (200)
    try {
      const res = await axios.post(`${SERVER_URL}/api/interviews/${room1Id}/session`, {
        candidateId: 'Candidate A'
      }, {
        headers: { Authorization: `Bearer ${candidateAToken}` }
      });
      assert(res.status === 200 && res.data.success === true, 'Test 2: Authenticated Candidate A POST -> Candidate A resource = 200 ALLOWED');
    } catch (err) {
      assert(false, `Test 2: Authenticated Candidate A POST failed: ${err.message}`);
    }

    // 3. Candidate A POST -> Candidate B resource = DENIED (403)
    try {
      await axios.post(`${SERVER_URL}/api/interviews/${room1Id}/session`, {
        candidateId: 'Candidate B'
      }, {
        headers: { Authorization: `Bearer ${candidateAToken}` }
      });
      assert(false, 'Test 3: Candidate A POST accessing Candidate B resource should be denied');
    } catch (err) {
      assert(err.response?.status === 403, 'Test 3: Candidate A POST -> Candidate B resource = 403 DENIED');
    }

    // 4. Candidate A POST with role=interviewer = DENIED (403)
    try {
      await axios.post(`${SERVER_URL}/api/interviews/${room1Id}/pending-requests`, {
        role: 'interviewer'
      }, {
        headers: {
          Authorization: `Bearer ${candidateAToken}`,
          'x-user-role': 'interviewer'
        }
      });
      assert(false, 'Test 4: Candidate A POST with role=interviewer claim should be denied');
    } catch (err) {
      assert(err.response?.status === 403, 'Test 4: Candidate A POST with role=interviewer = 403 DENIED');
    }

    // 5. Candidate A POST with candidateId=B = DENIED (403)
    try {
      await axios.post(`${SERVER_URL}/api/interviews/${room1Id}/admission-status`, {
        candidateId: 'Candidate B'
      }, {
        headers: { Authorization: `Bearer ${candidateAToken}` }
      });
      assert(false, 'Test 5: Candidate A POST checking Candidate B admission status should be denied');
    } catch (err) {
      assert(err.response?.status === 403, 'Test 5: Candidate A POST with candidateId=B = 403 DENIED');
    }

    // 6. Candidate A POST with unauthorized interviewId = DENIED (403)
    try {
      await axios.post(`${SERVER_URL}/api/interviews/${room2Id}/session`, {
        candidateId: 'Candidate A'
      }, {
        headers: { Authorization: `Bearer ${candidateAToken}` }
      });
      assert(false, 'Test 6: Candidate A POST with unauthorized interviewId should be denied');
    } catch (err) {
      assert(err.response?.status === 403, 'Test 6: Candidate A POST with unauthorized interviewId = 403 DENIED');
    }

    // 7. Expired authentication POST -> protected resource = DENIED (401)
    const expiredToken = generateToken({
      roomId: room1Id,
      role: 'candidate',
      candidateId: 'Candidate A',
      userName: 'Candidate A',
      exp: Date.now() - 5000 // expired 5 seconds ago
    });
    try {
      await axios.post(`${SERVER_URL}/api/interviews/${room1Id}/session`, {
        candidateId: 'Candidate A'
      }, {
        headers: { Authorization: `Bearer ${expiredToken}` }
      });
      assert(false, 'Test 7: Expired token POST should be denied');
    } catch (err) {
      assert(err.response?.status === 401, 'Test 7: Expired authentication POST -> protected resource = 401 DENIED');
    }

    // 8. Interviewer POST -> authorized candidate data = ALLOWED (200)
    try {
      const res = await axios.post(`${SERVER_URL}/api/interviews/${room1Id}/session`, {}, {
        headers: { Authorization: `Bearer ${room1InterviewerToken}` }
      });
      assert(
        res.status === 200 && 
        res.data.success === true && 
        res.data.interview.candidateAdmissions !== undefined && 
        Array.isArray(res.data.interview.pendingJoinRequests), 
        'Test 8: Interviewer POST -> authorized candidate data = 200 ALLOWED'
      );
    } catch (err) {
      assert(false, `Test 8: Interviewer POST failed: ${err.message}`);
    }

    // 9. GET request attempting to retrieve protected application data = NOT EXPOSED / DENIED (405)
    try {
      await axios.get(`${SERVER_URL}/api/interviews/${room1Id}`, {
        headers: { Authorization: `Bearer ${room1InterviewerToken}` }
      });
      assert(false, 'Test 9: GET /api/interviews/:id should not return protected data');
    } catch (err) {
      assert(err.response?.status === 405, 'Test 9: GET request attempting to retrieve protected application data = 405 Method Not Allowed / DENIED');
    }

    // 10. Sensitive authentication credentials in URL = MUST NOT EXIST / rejected
    try {
      // Trying to authenticate via query string alone without Authorization header
      await axios.post(`${SERVER_URL}/api/interviews/${room1Id}/session?token=${candidateAToken}`, {});
      assert(false, 'Test 10: Authenticating via URL query parameter should be rejected');
    } catch (err) {
      assert(err.response?.status === 401, 'Test 10: Sensitive authentication credentials in URL query rejected = 401 DENIED');
    }

    // ============================================================================
    // SECTION 9: SOCKET.IO SECURITY & AUTHORIZATION TESTS
    // ============================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('📌 PHASE 2: SECTION 9 — SOCKET.IO SECURITY & AUTHORIZATION TESTS');
    console.log('----------------------------------------------------------------');

    // Test Socket 1: Unauthenticated join
    const unauthSocket = createSocket();
    let unauthRejected = false;
    unauthSocket.on('error', (err) => {
      if (err.message.includes('Unauthorized')) unauthRejected = true;
    });
    unauthSocket.emit('join-room', { roomId: room1Id, role: 'candidate', userName: 'Hacker' });
    await wait(400);
    assert(unauthRejected, 'Socket.IO: Unauthenticated join-room without token = DENIED');
    unauthSocket.disconnect();

    // Test Socket 2: Expired token
    const expiredSocket = createSocket({ auth: { token: expiredToken } });
    let expiredRejected = false;
    expiredSocket.on('error', (err) => {
      if (err.message.includes('expired') || err.message.includes('Unauthorized')) expiredRejected = true;
    });
    expiredSocket.emit('join-room', { roomId: room1Id, token: expiredToken });
    await wait(400);
    assert(expiredRejected, 'Socket.IO: Expired token join-room = DENIED');
    expiredSocket.disconnect();

    // Test Socket 3: Cross-room token join
    const crossRoomSocket = createSocket({ auth: { token: candidateAToken } });
    let crossRoomRejected = false;
    crossRoomSocket.on('error', (err) => {
      if (err.message.includes('Forbidden') || err.message.includes('not authorized')) crossRoomRejected = true;
    });
    crossRoomSocket.emit('join-room', { roomId: room2Id, token: candidateAToken });
    await wait(400);
    assert(crossRoomRejected, 'Socket.IO: Token for Room 1 attempting to join Room 2 = DENIED');
    crossRoomSocket.disconnect();

    // ============================================================================
    // SECTION 26: MULTIPLE-CANDIDATE CONCURRENCY & ISOLATION TEST (A, B, C)
    // ============================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('📌 PHASE 3: SECTION 26 — MULTIPLE-CANDIDATE CONCURRENCY & ISOLATION (A, B, C)');
    console.log('----------------------------------------------------------------');

    // Create fresh interview room for concurrency test
    const concRoomRes = await axios.post(`${SERVER_URL}/api/interviews`, {
      interviewerName: 'Master Interviewer',
      candidateName: 'Candidate A'
    });
    const cRoomId = concRoomRes.data.interview.id;
    const cInterviewerToken = concRoomRes.data.token;

    // Join Candidate A, B, C
    const [candARes, candBRes, candCRes] = await Promise.all([
      axios.post(`${SERVER_URL}/api/interviews/${cRoomId}/join`, { candidateName: 'Candidate A' }),
      axios.post(`${SERVER_URL}/api/interviews/${cRoomId}/join`, { candidateName: 'Candidate B' }),
      axios.post(`${SERVER_URL}/api/interviews/${cRoomId}/join`, { candidateName: 'Candidate C' })
    ]);

    const cTokenA = candARes.data.token;
    const cTokenB = candBRes.data.token;
    const cTokenC = candCRes.data.token;

    // Connect Interviewer socket
    const cInterviewerSocket = createSocket({ auth: { token: cInterviewerToken } });
    cInterviewerSocket.emit('join-room', { roomId: cRoomId, token: cInterviewerToken });
    await wait(300);

    // Interviewer admits Candidate A, B, C
    await Promise.all([
      axios.post(`${SERVER_URL}/api/interviews/${cRoomId}/admission-decision`, {
        candidateId: 'Candidate A',
        decision: 'ACCEPT'
      }, { headers: { Authorization: `Bearer ${cInterviewerToken}` } }),
      axios.post(`${SERVER_URL}/api/interviews/${cRoomId}/admission-decision`, {
        candidateId: 'Candidate B',
        decision: 'ACCEPT'
      }, { headers: { Authorization: `Bearer ${cInterviewerToken}` } }),
      axios.post(`${SERVER_URL}/api/interviews/${cRoomId}/admission-decision`, {
        candidateId: 'Candidate C',
        decision: 'ACCEPT'
      }, { headers: { Authorization: `Bearer ${cInterviewerToken}` } })
    ]);

    // Connect Sockets for Candidates A, B, C
    const socketA = createSocket({ auth: { token: cTokenA } });
    const socketB = createSocket({ auth: { token: cTokenB } });
    const socketC = createSocket({ auth: { token: cTokenC } });

    socketA.emit('join-room', { roomId: cRoomId, token: cTokenA });
    socketB.emit('join-room', { roomId: cRoomId, token: cTokenB });
    socketC.emit('join-room', { roomId: cRoomId, token: cTokenC });
    await wait(400);

    // Interviewer assigns distinct questions:
    // A -> two-sum
    // B -> reverse-string
    // C -> valid-palindrome
    await axios.post(`${SERVER_URL}/api/interviews/${cRoomId}/assign-question`, {
      candidateId: 'Candidate A',
      questionId: 'two-sum'
    }, { headers: { Authorization: `Bearer ${cInterviewerToken}` } });

    await axios.post(`${SERVER_URL}/api/interviews/${cRoomId}/assign-question`, {
      candidateId: 'Candidate B',
      questionId: 'reverse-string'
    }, { headers: { Authorization: `Bearer ${cInterviewerToken}` } });

    await axios.post(`${SERVER_URL}/api/interviews/${cRoomId}/assign-question`, {
      candidateId: 'Candidate C',
      questionId: 'valid-palindrome'
    }, { headers: { Authorization: `Bearer ${cInterviewerToken}` } });

    // Verify candidate-specific question assignment isolation via REST POST
    const [sessA, sessB, sessC] = await Promise.all([
      axios.post(`${SERVER_URL}/api/interviews/${cRoomId}/session`, { candidateId: 'Candidate A' }, { headers: { Authorization: `Bearer ${cTokenA}` } }),
      axios.post(`${SERVER_URL}/api/interviews/${cRoomId}/session`, { candidateId: 'Candidate B' }, { headers: { Authorization: `Bearer ${cTokenB}` } }),
      axios.post(`${SERVER_URL}/api/interviews/${cRoomId}/session`, { candidateId: 'Candidate C' }, { headers: { Authorization: `Bearer ${cTokenC}` } })
    ]);

    assert(
      sessA.data.interview.assignedQuestions['Candidate A']?.[0] === 'two-sum' &&
      !sessA.data.interview.assignedQuestions['Candidate B'] &&
      !sessA.data.interview.assignedQuestions['Candidate C'],
      'Candidate A session contains ONLY Candidate A assigned question'
    );

    assert(
      sessB.data.interview.assignedQuestions['Candidate B']?.[0] === 'reverse-string' &&
      !sessB.data.interview.assignedQuestions['Candidate A'] &&
      !sessB.data.interview.assignedQuestions['Candidate C'],
      'Candidate B session contains ONLY Candidate B assigned question'
    );

    assert(
      sessC.data.interview.assignedQuestions['Candidate C']?.[0] === 'valid-palindrome' &&
      !sessC.data.interview.assignedQuestions['Candidate A'] &&
      !sessC.data.interview.assignedQuestions['Candidate B'],
      'Candidate C session contains ONLY Candidate C assigned question'
    );

    // Real-Time Code & Socket Event Isolation Test:
    // Candidate A sends code update.
    // Interviewer MUST receive it. Candidate B and Candidate C MUST NOT receive it!
    let interviewerGotCodeUpdate = false;
    let candidateBGotCodeUpdate = false;
    let candidateCGotCodeUpdate = false;

    cInterviewerSocket.on('candidate-code-update', (data) => {
      if (data.candidateId === 'Candidate A') interviewerGotCodeUpdate = true;
    });

    socketB.on('candidate-code-update', () => { candidateBGotCodeUpdate = true; });
    socketC.on('candidate-code-update', () => { candidateCGotCodeUpdate = true; });

    socketA.emit('candidate-code-change', {
      roomId: cRoomId,
      candidateId: 'Candidate A',
      questionId: 'two-sum',
      code: 'print("A Secret Solution")',
      language: 'python'
    });

    await wait(500);

    assert(interviewerGotCodeUpdate, 'Interviewer received Candidate A real-time code update');
    assert(!candidateBGotCodeUpdate, 'Candidate B received ZERO code updates from Candidate A (ISOLATED)');
    assert(!candidateCGotCodeUpdate, 'Candidate C received ZERO code updates from Candidate A (ISOLATED)');

    // Real-Time Interactive Terminal & Stdin Isolation Test:
    let interviewerGotTerminalOutput = false;
    let interviewerGotStdin = false;
    let candidateBGotTerminalOutput = false;

    cInterviewerSocket.on('terminal-output', (data) => {
      if (data.candidateId === 'Candidate A') interviewerGotTerminalOutput = true;
    });
    cInterviewerSocket.on('terminal-stdin', (data) => {
      if (data.candidateId === 'Candidate A') interviewerGotStdin = true;
    });

    socketB.on('terminal-output', () => { candidateBGotTerminalOutput = true; });

    let activeSessionId = null;
    socketA.on('terminal-ready', (data) => {
      activeSessionId = data.sessionId;
    });

    // Run interactive terminal code for Candidate A
    socketA.emit('terminal-start', {
      roomId: cRoomId,
      candidateId: 'Candidate A',
      questionId: 'two-sum',
      code: 'x = input("Enter A: ")\nprint("Got:", x)',
      language: 'python'
    });

    await wait(800);

    assert(Boolean(activeSessionId), 'Candidate A interactive terminal session launched');

    if (activeSessionId) {
      // Candidate B attempts to inject stdin into Candidate A's session -> MUST BE BLOCKED
      socketB.emit('terminal-input', {
        roomId: cRoomId,
        sessionId: activeSessionId,
        input: 'Hacked Input\n'
      });
      await wait(300);

      // Legitimate Candidate A writes stdin
      socketA.emit('terminal-input', {
        roomId: cRoomId,
        sessionId: activeSessionId,
        input: 'Legit Input\n'
      });
      await wait(800);

      assert(interviewerGotTerminalOutput, 'Interviewer received Candidate A terminal output in real time');
      assert(interviewerGotStdin, 'Interviewer received Candidate A interactive stdin in real time');
      assert(!candidateBGotTerminalOutput, 'Candidate B received ZERO terminal output from Candidate A (ISOLATED)');
    }

    // Independent Tab-Switch Tracking & Disqualification
    // Trigger 1 screen violation for Candidate A
    socketA.emit('candidate:screen-hidden');
    await wait(300);

    const [vA1, vB1, vC1] = await Promise.all([
      axios.post(`${SERVER_URL}/api/interviews/${cRoomId}/session`, { candidateId: 'Candidate A' }, { headers: { Authorization: `Bearer ${cTokenA}` } }),
      axios.post(`${SERVER_URL}/api/interviews/${cRoomId}/session`, { candidateId: 'Candidate B' }, { headers: { Authorization: `Bearer ${cTokenB}` } }),
      axios.post(`${SERVER_URL}/api/interviews/${cRoomId}/session`, { candidateId: 'Candidate C' }, { headers: { Authorization: `Bearer ${cTokenC}` } })
    ]);

    assert(vA1.data.interview.tabViolations['Candidate A'] === 1, 'Candidate A tab violation count is 1');
    assert(!vB1.data.interview.tabViolations['Candidate B'], 'Candidate B tab violation count remains 0 (independent)');
    assert(!vC1.data.interview.tabViolations['Candidate C'], 'Candidate C tab violation count remains 0 (independent)');

    // Trigger 2nd and 3rd violation for Candidate A to disqualify
    socketA.emit('candidate:screen-visible');
    await wait(200);
    socketA.emit('candidate:screen-hidden'); // 2nd
    await wait(300);
    socketA.emit('candidate:screen-visible');
    await wait(200);

    let disqualifiedEventFired = false;
    socketA.on('candidate-disqualified', (data) => {
      if (data.disqualified === true) disqualifiedEventFired = true;
    });

    socketA.emit('candidate:screen-hidden'); // 3rd -> Disqualification
    await wait(600);

    assert(disqualifiedEventFired, 'Candidate A received disqualification notification on 3rd violation');

    // Verify Candidate A cannot rejoin (Gate check)
    try {
      await axios.post(`${SERVER_URL}/api/interviews/${cRoomId}/join`, { candidateName: 'Candidate A' });
      assert(false, 'Disqualified Candidate A should not be allowed to rejoin');
    } catch (err) {
      assert(err.response?.status === 403 && err.response?.data?.disqualified === true, 'Disqualified Candidate A -> Rejoin = 403 DENIED');
    }

    // Verify Candidates B and C remain ACCEPTED and ACTIVE
    const [candBCheck, candCCheck] = await Promise.all([
      axios.post(`${SERVER_URL}/api/interviews/${cRoomId}/admission-status`, { candidateId: 'Candidate B' }, { headers: { Authorization: `Bearer ${cTokenB}` } }),
      axios.post(`${SERVER_URL}/api/interviews/${cRoomId}/admission-status`, { candidateId: 'Candidate C' }, { headers: { Authorization: `Bearer ${cTokenC}` } })
    ]);
    assert(candBCheck.data.admissionStatus === 'ACCEPTED', 'Candidate B remains unaffected and ACCEPTED');
    assert(candCCheck.data.admissionStatus === 'ACCEPTED', 'Candidate C remains unaffected and ACCEPTED');

    // Clean up concurrency sockets
    socketA.disconnect();
    socketB.disconnect();
    socketC.disconnect();
    cInterviewerSocket.disconnect();

    // ============================================================================
    // SECTION 11: 5-MINUTE JOIN WINDOW & ACCEPTED CANDIDATE PRESERVATION
    // ============================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('📌 PHASE 4: SECTION 11 — 5-MINUTE JOIN WINDOW & PERSISTENCE TEST');
    console.log('----------------------------------------------------------------');

    // Simulate expiration of the 5-minute join window
    await axios.post(`${SERVER_URL}/api/interviews/${cRoomId}/adjust-time-for-test`, {
      elapsedMs: 6 * 60 * 1000 // 6 minutes elapsed
    });

    // New candidate D attempts to join after 5 minutes -> MUST BE DENIED
    try {
      await axios.post(`${SERVER_URL}/api/interviews/${cRoomId}/join`, { candidateName: 'Candidate D' });
      assert(false, 'Candidate D joining after 5 minutes should be rejected');
    } catch (err) {
      assert(
        err.response?.status === 403 && err.response?.data?.expired === true,
        'New Candidate D joining after 5 minutes = 403 DENIED ("Your time for joining the meeting has expired.")'
      );
    }

    // Existing accepted Candidate B attempts to fetch session after deadline -> MUST SUCCEED
    try {
      const bRes = await axios.post(`${SERVER_URL}/api/interviews/${cRoomId}/session`, {
        candidateId: 'Candidate B'
      }, {
        headers: { Authorization: `Bearer ${cTokenB}` }
      });
      assert(bRes.status === 200, 'Existing accepted Candidate B remains in interview after 5-minute deadline = ALLOWED');
    } catch (err) {
      assert(false, `Existing accepted candidate failed to access session after deadline: ${err.message}`);
    }

    // ============================================================================
    // SECTION 14 & 16: CODE EXECUTION ISOLATION & SERVER SECRET PROTECTION
    // ============================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('📌 PHASE 5: SECTION 14 & 16 — EXECUTION SANDBOX & SECRET ISOLATION');
    console.log('----------------------------------------------------------------');

    // Attempt to inspect process.env / AUTH_SECRET from within Python candidate code
    const leakCheckCode = `
import os
secret = os.environ.get('AUTH_SECRET')
print(f"AUTH_SECRET:{secret}")
`;
    const execRes = await axios.post(`${SERVER_URL}/api/judge0/run`, {
      source_code: leakCheckCode,
      language: 'python'
    });

    const execStdout = execRes.data.result?.stdout || '';
    assert(
      execStdout.includes('AUTH_SECRET:None'),
      `Candidate untrusted code execution CANNOT access AUTH_SECRET (Output: ${execStdout})`
    );

    // Test real execution calculation (Sum of numbers)
    const sumCode = `
nums = [10, 20, 30]
print(sum(nums))
`;
    const sumRes = await axios.post(`${SERVER_URL}/api/judge0/run`, {
      source_code: sumCode,
      language: 'python'
    });
    assert(
      sumRes.data.result?.stdout?.trim() === '60',
      'Normal code execution produces accurate result (sum = 60)'
    );

    // ============================================================================
    // SECTION 17 & 27: WEBRTC SIGNALING INTEGRITY & ZERO MEDIA HOP
    // ============================================================================
    console.log('\n----------------------------------------------------------------');
    console.log('📌 PHASE 6: SECTION 17 & 27 — WEBRTC SIGNALING INTEGRITY');
    console.log('----------------------------------------------------------------');

    // Create fresh peer connection simulation for WebRTC signaling
    const peer1 = createSocket({ auth: { token: cInterviewerToken } });
    const peer2 = createSocket({ auth: { token: cTokenB } });

    let offerReceived = false;
    let answerReceived = false;
    let candidateReceived = false;

    peer2.on('webrtc-offer', (data) => {
      if (data.offer?.sdp === 'fake_sdp_offer') offerReceived = true;
    });

    peer1.on('webrtc-answer', (data) => {
      if (data.answer?.sdp === 'fake_sdp_answer') answerReceived = true;
    });

    peer2.on('webrtc-ice-candidate', (data) => {
      if (data.candidate?.candidate === 'fake_ice_candidate') candidateReceived = true;
    });

    peer1.emit('join-room', { roomId: cRoomId, token: cInterviewerToken });
    peer2.emit('join-room', { roomId: cRoomId, token: cTokenB });
    await wait(300);

    peer1.emit('webrtc-offer', {
      roomId: cRoomId,
      targetSocketId: peer2.id,
      offer: { type: 'offer', sdp: 'fake_sdp_offer' }
    });
    await wait(200);

    peer2.emit('webrtc-answer', {
      roomId: cRoomId,
      targetSocketId: peer1.id,
      answer: { type: 'answer', sdp: 'fake_sdp_answer' }
    });
    await wait(200);

    peer1.emit('webrtc-ice-candidate', {
      roomId: cRoomId,
      targetSocketId: peer2.id,
      candidate: { candidate: 'fake_ice_candidate' }
    });
    await wait(200);

    assert(offerReceived, 'WebRTC: Offer successfully relayed peer-to-peer');
    assert(answerReceived, 'WebRTC: Answer successfully relayed peer-to-peer');
    assert(candidateReceived, 'WebRTC: ICE candidate successfully relayed peer-to-peer');

    peer1.disconnect();
    peer2.disconnect();

    // ============================================================================
    // SUMMARY
    // ============================================================================
    console.log('\n================================================================');
    console.log(`📊 MASTER TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

    if (failed === 0) {
      console.log('🎉 ALL SECURITY, ISOLATION & REGRESSION REQUIREMENTS VERIFIED!\n');
      process.exit(0);
    } else {
      console.error('❌ SOME TESTS FAILED!\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('Fatal error running master test suite:', error);
    process.exit(1);
  }
}

runMasterSecurityTests();
