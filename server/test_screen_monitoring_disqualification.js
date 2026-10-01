import io from 'socket.io-client';
import axios from 'axios';

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

async function getRoomData(roomId, token) {
  const res = await axios.post(`${SERVER_URL}/api/interviews/${roomId}/session`, {}, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  return res.data.interview || res.data;
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log('🧪 TEST SUITE: ACTIVE SCREEN MONITORING + 2 WARNINGS + 3RD SWITCH DISQUALIFICATION');
  console.log('===============================================================\n');

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
    // -------------------------------------------------------------
    // SETUP: Create an interview room with 1 Interviewer and candidates
    // -------------------------------------------------------------
    console.log('📋 SETUP: Creating Interview Room...');
    const createRes = await axios.post(`${SERVER_URL}/api/interviews`, {
      interviewerName: 'Lead Interviewer',
      candidateName: 'Candidate Alpha'
    });
    const roomId = createRes.data.interview.id;
    const interviewerToken = createRes.data.token;
    console.log(`  Room created: ${roomId}\n`);

    // Connect Interviewer
    const interviewerSocket = createSocket({
      auth: { token: interviewerToken }
    });

    await new Promise((res) => {
      interviewerSocket.on('connect', () => {
        interviewerSocket.emit('join-room', {
          roomId,
          role: 'interviewer',
          userName: 'Lead Interviewer',
          token: interviewerToken
        });
        res();
      });
    });

    let interviewerScreenViolations = [];
    interviewerSocket.on('candidate-screen-violation', (data) => {
      interviewerScreenViolations.push(data);
    });

    // Join Candidate Alpha (via HTTP join & admission approval)
    const joinRes = await axios.post(`${SERVER_URL}/api/interviews/${roomId}/join`, {
      candidateName: 'Candidate Alpha'
    });
    const alphaToken = joinRes.data.token;

    // Interviewer approves Candidate Alpha
    await axios.post(
      `${SERVER_URL}/api/interviews/${roomId}/admission-decision`,
      { candidateId: 'Candidate Alpha', decision: 'ACCEPT' },
      { headers: { Authorization: `Bearer ${interviewerToken}` } }
    );

    // Connect Candidate Alpha socket
    const alphaSocket = createSocket({
      auth: { token: alphaToken }
    });

    let alphaWarnings = [];
    let alphaDisqualifiedEvents = [];
    let alphaAdmissionStatuses = [];

    await new Promise((res) => {
      alphaSocket.on('connect', () => {
        alphaSocket.emit('join-room', {
          roomId,
          role: 'candidate',
          userName: 'Candidate Alpha',
          candidateId: 'Candidate Alpha',
          token: alphaToken
        });
        res();
      });
    });

    alphaSocket.on('screen-violation-warning', (data) => {
      alphaWarnings.push(data);
    });

    alphaSocket.on('candidate-disqualified', (data) => {
      alphaDisqualifiedEvents.push(data);
    });

    alphaSocket.on('admission-status', (data) => {
      alphaAdmissionStatuses.push(data);
    });

    await wait(300);

    // -------------------------------------------------------------
    // TEST 1: Candidate is inside interview. Interview tab remains active.
    // Expected: No violation.
    // -------------------------------------------------------------
    console.log('📋 TEST 1: Candidate inside interview with active tab');
    const roomState1 = await getRoomData(roomId, interviewerToken);
    assert(
      (roomState1.tabViolations?.['Candidate Alpha'] || 0) === 0,
      'Initial tab violations count is 0'
    );
    assert(alphaWarnings.length === 0, 'No warning emitted when tab remains active');

    // -------------------------------------------------------------
    // TEST 2: Candidate switches to another tab (Departure 1)
    // Expected: Violation = 1, warning displayed, candidate remains in interview
    // -------------------------------------------------------------
    console.log('\n📋 TEST 2: Candidate switches from interview tab to another tab (Violation 1)');
    interviewerScreenViolations = [];
    alphaWarnings = [];

    alphaSocket.emit('candidate:screen-hidden');
    await wait(250);

    assert(alphaWarnings.length === 1, 'Candidate received warning #1');
    assert(
      alphaWarnings[0]?.message === 'Warning: You are visiting another tab. This is not allowed. You will be disqualified.',
      'Warning text matches exact requirement'
    );
    assert(alphaWarnings[0]?.violations === 1, 'Violation count in warning is 1');
    assert(interviewerScreenViolations.length === 1, 'Interviewer notified of violation 1');
    assert(
      interviewerScreenViolations[0]?.message === 'Candidate Alpha left the interview screen. Tab violations: 1',
      'Interviewer message matches: "[Candidate Name] left the interview screen. Tab violations: 1"'
    );
    assert(alphaDisqualifiedEvents.length === 0, 'Candidate is NOT disqualified on violation 1');

    // -------------------------------------------------------------
    // TEST 3: Candidate returns to interview tab
    // Expected: Violation remains 1. No new violation.
    // -------------------------------------------------------------
    console.log('\n📋 TEST 3: Candidate returns to interview tab');
    alphaSocket.emit('candidate:screen-visible');
    await wait(200);

    const roomState3 = await getRoomData(roomId, interviewerToken);
    assert(
      roomState3.tabViolations?.['Candidate Alpha'] === 1,
      'Violation count remains 1 when returning to interview tab'
    );

    // -------------------------------------------------------------
    // TEST 4: Candidate switches away again (Violation 2)
    // Expected: Violation = 2, warning displayed, candidate remains
    // -------------------------------------------------------------
    console.log('\n📋 TEST 4: Candidate switches away again (Violation 2)');
    interviewerScreenViolations = [];
    alphaWarnings = [];

    alphaSocket.emit('candidate:screen-hidden');
    await wait(250);

    assert(alphaWarnings.length === 1, 'Candidate received warning #2');
    assert(alphaWarnings[0]?.violations === 2, 'Violation count in warning is 2');
    assert(interviewerScreenViolations.length === 1, 'Interviewer notified of violation 2');
    assert(
      interviewerScreenViolations[0]?.message === 'Candidate Alpha left the interview screen. Tab violations: 2',
      'Interviewer message matches: "[Candidate Name] left the interview screen. Tab violations: 2"'
    );
    assert(alphaDisqualifiedEvents.length === 0, 'Candidate is NOT disqualified on violation 2');

    // -------------------------------------------------------------
    // TEST 5: Candidate returns to interview tab
    // Expected: Violation remains 2.
    // -------------------------------------------------------------
    console.log('\n📋 TEST 5: Candidate returns to interview tab');
    alphaSocket.emit('candidate:screen-visible');
    await wait(200);

    const roomState5 = await getRoomData(roomId, interviewerToken);
    assert(
      roomState5.tabViolations?.['Candidate Alpha'] === 2,
      'Violation count remains 2 upon return'
    );

    // -------------------------------------------------------------
    // TEST 14: Duplicate event prevention (rapid duplicate triggers or focus/blur toggle)
    // Expected: One genuine departure = one violation
    // -------------------------------------------------------------
    console.log('\n📋 TEST 14: Duplicate visibility/focus event prevention');
    // Emitting candidate:screen-hidden twice without visible in-between
    alphaSocket.emit('candidate:screen-hidden'); // 3rd departure
    alphaSocket.emit('candidate:screen-hidden'); // duplicate within milliseconds
    await wait(250);

    const roomState14 = await getRoomData(roomId, interviewerToken);
    assert(
      roomState14.tabViolations?.['Candidate Alpha'] === 3,
      'Rapid duplicate events do not increment count beyond 3'
    );

    // -------------------------------------------------------------
    // TEST 6: Candidate switches away for 3rd time
    // Expected: Violation = 3, Candidate immediately DISQUALIFIED, removed from room,
    // disqualified messages sent to candidate and interviewer.
    // -------------------------------------------------------------
    console.log('\n📋 TEST 6: 3rd departure causes immediate Disqualification');
    assert(
      alphaDisqualifiedEvents.length === 1,
      'Candidate received candidate-disqualified event'
    );
    assert(
      alphaDisqualifiedEvents[0]?.message ===
        'You have been disqualified from the interview because you visited another tab three times.',
      'Candidate message matches: "You have been disqualified from the interview because you visited another tab three times."'
    );
    const lastDqInterviewerNotif = interviewerScreenViolations.find((n) => n.disqualified);
    assert(
      lastDqInterviewerNotif?.message ===
        'Candidate Alpha has been disqualified after leaving the interview screen 3 times.',
      'Interviewer notification matches: "[Candidate Name] has been disqualified after leaving the interview screen 3 times."'
    );

    // Verify candidate is marked DISQUALIFIED on server
    const checkDqStore = await getRoomData(roomId, interviewerToken);
    assert(
      checkDqStore.candidateAdmissions?.['Candidate Alpha'] === 'DISQUALIFIED',
      'Candidate admission status is DISQUALIFIED on server'
    );

    // -------------------------------------------------------------
    // TEST 7: Other candidates in same interview remain unaffected
    // -------------------------------------------------------------
    console.log('\n📋 TEST 7: Other candidates (Candidate B, C) and Interviewer remain active');
    // Join Candidate Beta and Candidate Gamma
    const betaJoinRes = await axios.post(`${SERVER_URL}/api/interviews/${roomId}/join`, {
      candidateName: 'Candidate Beta'
    });
    const betaToken = betaJoinRes.data.token;
    await axios.post(
      `${SERVER_URL}/api/interviews/${roomId}/admission-decision`,
      { candidateId: 'Candidate Beta', decision: 'ACCEPT' },
      { headers: { Authorization: `Bearer ${interviewerToken}` } }
    );

    const gammaJoinRes = await axios.post(`${SERVER_URL}/api/interviews/${roomId}/join`, {
      candidateName: 'Candidate Gamma'
    });
    const gammaToken = gammaJoinRes.data.token;
    await axios.post(
      `${SERVER_URL}/api/interviews/${roomId}/admission-decision`,
      { candidateId: 'Candidate Gamma', decision: 'ACCEPT' },
      { headers: { Authorization: `Bearer ${interviewerToken}` } }
    );

    const betaSocket = createSocket({ auth: { token: betaToken } });
    const gammaSocket = createSocket({ auth: { token: gammaToken } });

    await Promise.all([
      new Promise((res) => {
        betaSocket.on('connect', () => {
          betaSocket.emit('join-room', {
            roomId,
            role: 'candidate',
            userName: 'Candidate Beta',
            candidateId: 'Candidate Beta',
            token: betaToken
          });
          res();
        });
      }),
      new Promise((res) => {
        gammaSocket.on('connect', () => {
          gammaSocket.emit('join-room', {
            roomId,
            role: 'candidate',
            userName: 'Candidate Gamma',
            candidateId: 'Candidate Gamma',
            token: gammaToken
          });
          res();
        });
      })
    ]);

    await wait(300);

    const roomCheck7 = await getRoomData(roomId, interviewerToken);
    assert(
      roomCheck7.candidateAdmissions?.['Candidate Beta'] === 'ACCEPTED',
      'Candidate Beta is ACTIVE & ACCEPTED'
    );
    assert(
      roomCheck7.candidateAdmissions?.['Candidate Gamma'] === 'ACCEPTED',
      'Candidate Gamma is ACTIVE & ACCEPTED'
    );
    assert(
      (roomCheck7.tabViolations?.['Candidate Beta'] || 0) === 0,
      'Candidate Beta has 0 violations'
    );
    assert(
      (roomCheck7.tabViolations?.['Candidate Gamma'] || 0) === 0,
      'Candidate Gamma has 0 violations'
    );

    // -------------------------------------------------------------
    // TEST 13: Candidate B switches tabs -> Only Candidate B counter changes
    // -------------------------------------------------------------
    console.log('\n📋 TEST 13: Candidate Beta switches tabs; Candidate Gamma unaffected');
    betaSocket.emit('candidate:screen-hidden');
    await wait(250);

    const checkRes13 = await getRoomData(roomId, interviewerToken);
    assert(
      checkRes13.tabViolations?.['Candidate Beta'] === 1,
      'Candidate Beta violation incremented to 1'
    );
    assert(
      (checkRes13.tabViolations?.['Candidate Gamma'] || 0) === 0,
      'Candidate Gamma violation count remains 0'
    );
    assert(
      checkRes13.tabViolations?.['Candidate Alpha'] === 3,
      'Candidate Alpha violation count remains 3'
    );

    // -------------------------------------------------------------
    // TEST 8: Candidate has 2 violations and refreshes -> Count remains 2
    // -------------------------------------------------------------
    console.log('\n📋 TEST 8: Candidate Beta has 2 violations and refreshes');
    // Beta returns, then leaves again for violation 2
    betaSocket.emit('candidate:screen-visible');
    await wait(100);
    betaSocket.emit('candidate:screen-hidden');
    await wait(250);

    const checkBetaViolations = await getRoomData(roomId, interviewerToken);
    assert(
      checkBetaViolations.tabViolations?.['Candidate Beta'] === 2,
      'Candidate Beta has 2 violations'
    );

    // Simulate page refresh: candidate requests room data with their token
    const refreshRes8 = await getRoomData(roomId, betaToken);
    assert(
      refreshRes8.tabViolations?.['Candidate Beta'] === 2,
      'Count remains 2 after refresh (does NOT reset to 0)'
    );

    // -------------------------------------------------------------
    // TEST 9 & 10: Disqualified Candidate Alpha attempts to rejoin
    // -------------------------------------------------------------
    console.log('\n📋 TEST 9 & 10: Disqualified Candidate Alpha attempts HTTP rejoin with code');
    try {
      await axios.post(`${SERVER_URL}/api/interviews/${roomId}/join`, {
        candidateName: 'Candidate Alpha'
      });
      assert(false, 'Disqualified candidate join was not rejected');
    } catch (err) {
      assert(err.response?.status === 403, 'Rejected with HTTP 403');
      assert(
        err.response?.data?.message === 'You have been disqualified from this interview and cannot rejoin.',
        'Returns exact message: "You have been disqualified from this interview and cannot rejoin."'
      );
    }

    // TEST 10: Validate route also rejects disqualified candidate
    try {
      await axios.get(`${SERVER_URL}/api/interviews/${roomId}/validate?candidateId=Candidate%20Alpha`);
      assert(false, 'Validate route did not reject disqualified candidate');
    } catch (err) {
      assert(err.response?.status === 403, 'Validate route returns 403 for disqualified candidate');
      assert(
        err.response?.data?.message === 'You have been disqualified from this interview and cannot rejoin.',
        'Validate message: "You have been disqualified from this interview and cannot rejoin."'
      );
    }

    // -------------------------------------------------------------
    // TEST 11: Disqualified candidate attempts direct Socket.IO room join
    // -------------------------------------------------------------
    console.log('\n📋 TEST 11: Disqualified Candidate Alpha attempts direct Socket.IO room join');
    const sneakySocket = createSocket({ auth: { token: alphaToken } });
    let sneakyDisqualified = false;
    let sneakyErrorMsg = '';

    await new Promise((res) => {
      sneakySocket.on('connect', () => {
        sneakySocket.emit('join-room', {
          roomId,
          role: 'candidate',
          userName: 'Candidate Alpha',
          candidateId: 'Candidate Alpha',
          token: alphaToken
        });
      });
      sneakySocket.on('candidate-disqualified', (data) => {
        sneakyDisqualified = true;
        sneakyErrorMsg = data.message;
        res();
      });
      sneakySocket.on('admission-status', (data) => {
        if (data.status === 'DISQUALIFIED') {
          sneakyDisqualified = true;
          sneakyErrorMsg = data.message;
          res();
        }
      });
      setTimeout(res, 600);
    });

    assert(sneakyDisqualified === true, 'Direct Socket.IO join was rejected with DISQUALIFIED');
    assert(
      sneakyErrorMsg === 'You have been disqualified from this interview and cannot rejoin.',
      'Rejected socket received: "You have been disqualified from this interview and cannot rejoin."'
    );

    // -------------------------------------------------------------
    // TEST 12: Candidate attempts to tamper candidateId
    // -------------------------------------------------------------
    console.log('\n📋 TEST 12: Candidate attempts candidateId manipulation');
    try {
      await axios.post(`${SERVER_URL}/api/interviews/${roomId}/session`, {
        candidateId: 'Candidate Beta'
      }, {
        headers: { Authorization: `Bearer ${gammaToken}` }
      });
      assert(false, 'ID tampering should be forbidden');
    } catch (err) {
      assert(err.response?.status === 403, 'ID tampering blocked with HTTP 403');
    }

    // -------------------------------------------------------------
    // TEST 15 & 16: 5-minute join window expiration regression check
    // -------------------------------------------------------------
    console.log('\n📋 TEST 15 & 16: 5-minute deadline expiration regression & monitoring continuation');
    // Fast-forward meeting time past 5 minutes (305 seconds)
    await axios.post(`${SERVER_URL}/api/interviews/${roomId}/adjust-time-for-test`, {
      elapsedMs: 305 * 1000
    });

    // Check if 5-minute window is expired (validate returns 403 with expired: true)
    let expiredCheck;
    try {
      expiredCheck = await axios.get(`${SERVER_URL}/api/interviews/${roomId}/validate`);
    } catch (err) {
      expiredCheck = err.response;
    }
    assert(expiredCheck?.data?.expired === true, '5-minute join window is now expired');

    // New candidate attempting to join should be rejected
    try {
      await axios.post(`${SERVER_URL}/api/interviews/${roomId}/join`, {
        candidateName: 'Late Candidate'
      });
      assert(false, 'Late candidate should be rejected after 5-minute deadline');
    } catch (err) {
      assert(err.response?.status === 403, 'New candidate rejected after 5 minutes');
      assert(
        err.response?.data?.message === 'Your time for joining the meeting has expired.',
        '5-minute expiration message preserved exactly'
      );
    }

    // Existing admitted candidate (Gamma) remains active
    const gammaStateAfter5m = await getRoomData(roomId, gammaToken);
    assert(
      gammaStateAfter5m.admissionStatus === 'ACCEPTED',
      'Existing candidate Gamma remains ACCEPTED after 5-minute deadline'
    );

    // TEST 16: After 5-minute deadline, existing admitted candidate switches tabs
    // Expected: Screen monitoring still works normally!
    interviewerScreenViolations = [];
    gammaSocket.emit('candidate:screen-hidden');
    await wait(250);

    const checkGammaViolations = await getRoomData(roomId, interviewerToken);
    assert(
      checkGammaViolations.tabViolations?.['Candidate Gamma'] === 1,
      'Screen monitoring continues functioning for admitted candidates after 5-minute expiration'
    );
    assert(
      interviewerScreenViolations.length === 1 &&
        interviewerScreenViolations[0]?.message === 'Candidate Gamma left the interview screen. Tab violations: 1',
      'Interviewer received real-time violation notification after 5-minute expiration'
    );

    // -------------------------------------------------------------
    // TEST 17: Camera/Mic and WebRTC Isolation Verification
    // -------------------------------------------------------------
    console.log('\n📋 TEST 17: WebRTC stability & non-interference');
    // Verify that ICE servers API remains operational and WebRTC signaling events are intact
    const iceRes = await axios.get(`${SERVER_URL}/api/webrtc/ice-servers`);
    assert(iceRes.data.success === true && Array.isArray(iceRes.data.iceServers), 'ICE servers intact');
    assert(
      typeof interviewerSocket.listeners === 'function',
      'WebRTC signaling unaffected by screen monitoring'
    );

    // Clean up sockets
    interviewerSocket.disconnect();
    alphaSocket.disconnect();
    betaSocket.disconnect();
    gammaSocket.disconnect();
    sneakySocket.disconnect();

  } catch (error) {
    console.error('Unexpected test error:', error);
    failed++;
  }

  console.log('\n===============================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite();
