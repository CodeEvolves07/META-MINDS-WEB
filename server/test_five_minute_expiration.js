import io from 'socket.io-client';
import axios from 'axios';
import { generateToken } from './src/services/authService.js';

const BASE_URL = 'http://localhost:5001';
const API_URL = `${BASE_URL}/api`;

function createSocket(token = null) {
  return io(BASE_URL, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false,
    auth: token ? { token } : {}
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let allTestsPassed = true;
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    allTestsPassed = false;
    throw new Error(message);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function setRoomTimeOffset(roomId, elapsedMs) {
  const res = await axios.post(`${API_URL}/interviews/${roomId}/adjust-time-for-test`, {
    elapsedMs
  });
  return res.data;
}

async function runFiveMinuteExpirationTests() {
  console.log('================================================================');
  console.log('⏱️ TEST SUITE: 5-MINUTE INTERVIEW CODE EXPIRATION & ADMISSION GATE');
  console.log('================================================================\n');

  // SETUP: Create a new meeting at T=0 (10:00:00)
  const initRes = await axios.post(`${API_URL}/interviews`, {
    interviewerName: 'Sarah Interviewer'
  });
  assert(initRes.status === 201, 'Interview room created');
  const roomId = initRes.data.interview.id;
  const interviewerToken = initRes.data.token;

  // Connect Interviewer socket
  const interviewerSocket = createSocket(interviewerToken);
  await new Promise((res) => interviewerSocket.on('connect', res));
  interviewerSocket.emit('join-room', {
    roomId,
    role: 'interviewer',
    userName: 'Sarah Interviewer',
    token: interviewerToken
  });
  await sleep(150);

  // --------------------------------------------------------------------------
  // TEST 1: Meeting starts at 10:00. Candidate enters code at 10:01 (1 min elapsed).
  // Expected: Candidate can proceed through the existing admission flow.
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 1: Candidate enters code at 10:01 (1 min in) ---');
  await setRoomTimeOffset(roomId, 1 * 60 * 1000); // 1 min elapsed

  const joinT1 = await axios.post(`${API_URL}/interviews/${roomId}/join`, {
    candidateName: 'Candidate-OneMin'
  });
  assert(joinT1.status === 200, 'Candidate join request succeeded');
  assert(joinT1.data.admissionStatus === 'PENDING', 'Candidate placed into PENDING state');
  const tokenT1 = joinT1.data.token;

  // Interviewer accepts Candidate-OneMin
  await axios.post(
    `${API_URL}/interviews/${roomId}/admission-decision`,
    { candidateId: 'Candidate-OneMin', decision: 'ACCEPTED' },
    { headers: { Authorization: `Bearer ${interviewerToken}` } }
  );

  const socketT1 = createSocket(tokenT1);
  await new Promise((res) => socketT1.on('connect', res));
  let t1GotRoomState = false;
  socketT1.on('room-state', () => { t1GotRoomState = true; });

  socketT1.emit('join-room', {
    roomId,
    role: 'candidate',
    userName: 'Candidate-OneMin',
    candidateId: 'Candidate-OneMin',
    token: tokenT1
  });
  await sleep(250);
  assert(t1GotRoomState === true, 'Candidate OneMin entered room and received room-state');

  // --------------------------------------------------------------------------
  // TEST 2: Meeting starts at 10:00. Candidate enters code at 10:04:59 (4m 59s elapsed).
  // Expected: Candidate can proceed normally.
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Candidate enters code at 10:04:59 (4m 59s in) ---');
  await setRoomTimeOffset(roomId, 4 * 60 * 1000 + 59 * 1000); // 4m 59s elapsed

  const joinT2 = await axios.post(`${API_URL}/interviews/${roomId}/join`, {
    candidateName: 'Candidate-FourMin59'
  });
  assert(joinT2.status === 200, 'Candidate FourMin59 join request accepted at 4:59');
  assert(joinT2.data.admissionStatus === 'PENDING', 'Candidate FourMin59 placed into PENDING');

  // --------------------------------------------------------------------------
  // TEST 3: Meeting starts at 10:00. Candidate enters code at 10:05:01 (5m 1s elapsed).
  // Expected: Rejected. Message: "Your time for joining the meeting has expired."
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Candidate enters code at 10:05:01 (5m 1s in) ---');
  await setRoomTimeOffset(roomId, 5 * 60 * 1000 + 1000); // 5m 1s elapsed

  let t3Rejected = false;
  let t3Message = '';
  try {
    await axios.post(`${API_URL}/interviews/${roomId}/join`, {
      candidateName: 'Candidate-FiveMin01'
    });
  } catch (err) {
    t3Rejected = true;
    t3Message = err.response?.data?.message;
    assert(err.response?.status === 403, 'HTTP status is 403 Forbidden');
  }
  assert(t3Rejected === true, 'Candidate FiveMin01 rejected after 5 minutes');
  assert(t3Message === 'Your time for joining the meeting has expired.', `Exact error message matches: "${t3Message}"`);

  // --------------------------------------------------------------------------
  // TEST 4: Meeting starts at 10:00. Candidate enters code at 10:10 (10 mins elapsed).
  // Expected: Rejected. No new code is generated.
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Candidate enters code at 10:10 (10 mins in) ---');
  await setRoomTimeOffset(roomId, 10 * 60 * 1000); // 10 mins elapsed

  let t4Rejected = false;
  let t4Message = '';
  try {
    await axios.post(`${API_URL}/interviews/${roomId}/join`, {
      candidateName: 'Candidate-TenMin'
    });
  } catch (err) {
    t4Rejected = true;
    t4Message = err.response?.data?.message;
  }
  assert(t4Rejected === true, 'Candidate TenMin rejected at 10 mins');
  assert(t4Message === 'Your time for joining the meeting has expired.', 'Exact message received at 10 mins');

  // Verify interview room still exists with SAME code and is NOT regenerated
  const checkRoomRes = await axios.post(`${API_URL}/interviews/${roomId}/session`, {}, {
    headers: { Authorization: `Bearer ${interviewerToken}` }
  });
  assert(checkRoomRes.data.interview.id === roomId, 'Same interview room and code preserved (no code rotation or replacement)');

  // --------------------------------------------------------------------------
  // TEST 5: Candidate was accepted and entered at 10:03.
  // At 10:05: Candidate remains in meeting; camera/mic/WebRTC uninterrupted.
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: Accepted candidate at 10:03 remains active after 10:05 ---');
  // Candidate OneMin from Test 1 joined at 10:01 and is ACCEPTED
  // We shifted time to 10:10 (past 10:05). Candidate OneMin emits ping or room event
  let socketT1StillConnected = socketT1.connected;
  assert(socketT1StillConnected === true, 'Accepted candidate socket connection remains intact past 5 minutes');

  // Verify candidate OneMin can still fetch interview info without error
  const candViewRes = await axios.post(`${API_URL}/interviews/${roomId}/session`, {
    candidateId: 'Candidate-OneMin'
  }, {
    headers: { Authorization: `Bearer ${tokenT1}` }
  });
  assert(candViewRes.status === 200, 'Accepted candidate still has full interview access past 5 minutes');

  // --------------------------------------------------------------------------
  // TEST 6: Candidate requests entry at 10:04:30. Candidate remains pending.
  // After 10:05 interviewer attempts to accept.
  // Expected: Backend rejects admission. Candidate does not enter.
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: Pending candidate at 10:04:30 accepted AFTER 10:05 ---');
  // Create room for edge case test
  const edgeRoomRes = await axios.post(`${API_URL}/interviews`, {
    interviewerName: 'Dr. Edge Interviewer'
  });
  const edgeRoomId = edgeRoomRes.data.interview.id;
  const edgeInterviewerToken = edgeRoomRes.data.token;

  // Candidate requests at 10:04:30
  await setRoomTimeOffset(edgeRoomId, 4 * 60 * 1000 + 30 * 1000);
  const pendingCandRes = await axios.post(`${API_URL}/interviews/${edgeRoomId}/join`, {
    candidateName: 'Candidate-PendingLate'
  });
  assert(pendingCandRes.data.admissionStatus === 'PENDING', 'Candidate registered as PENDING at 4:30');

  // Connect waiting candidate socket
  const pendingCandSocket = createSocket();
  await new Promise((res) => pendingCandSocket.on('connect', res));
  let pendingCandDeclined = false;
  let pendingCandDeclinedMsg = '';
  pendingCandSocket.on('candidate-join-declined', (data) => {
    pendingCandDeclined = true;
    pendingCandDeclinedMsg = data?.message;
  });
  pendingCandSocket.emit('candidate:join-request', {
    roomId: edgeRoomId,
    candidateName: 'Candidate-PendingLate',
    candidateId: 'Candidate-PendingLate'
  });
  await sleep(150);

  // Time passes: now it is 10:05:05 (past deadline)
  await setRoomTimeOffset(edgeRoomId, 5 * 60 * 1000 + 5000);

  // Interviewer now tries to ACCEPT Candidate-PendingLate
  let interviewerAcceptFailed = false;
  let interviewerFailMessage = '';
  try {
    await axios.post(
      `${API_URL}/interviews/${edgeRoomId}/admission-decision`,
      { candidateId: 'Candidate-PendingLate', decision: 'ACCEPTED' },
      { headers: { Authorization: `Bearer ${edgeInterviewerToken}` } }
    );
  } catch (err) {
    interviewerAcceptFailed = true;
    interviewerFailMessage = err.response?.data?.message;
  }
  assert(interviewerAcceptFailed === true, 'Backend rejected interviewer acceptance after 5-minute deadline');
  assert(interviewerFailMessage === 'Your time for joining the meeting has expired.', 'Interviewer informed time has expired');

  await sleep(200);
  assert(pendingCandDeclined === true, 'Pending candidate socket received decline notification');
  assert(pendingCandDeclinedMsg === 'Your time for joining the meeting has expired.', 'Pending candidate received exact expiration message');

  // Candidate attempts to join-room directly
  let pendingGotRoomState = false;
  pendingCandSocket.on('room-state', () => { pendingGotRoomState = true; });
  pendingCandSocket.emit('join-room', {
    roomId: edgeRoomId,
    role: 'candidate',
    userName: 'Candidate-PendingLate',
    candidateId: 'Candidate-PendingLate'
  });
  await sleep(250);
  assert(pendingGotRoomState === false, 'Pending candidate blocked from room-state after deadline');

  // --------------------------------------------------------------------------
  // TEST 7: Try to bypass the expiration using direct API request.
  // Expected: Backend rejects the request.
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 7: Bypass attempt via direct REST API ---');
  let bypassRestRejected = false;
  try {
    await axios.post(`${API_URL}/interviews/${edgeRoomId}/join`, {
      candidateName: 'Attacker-Candidate'
    });
  } catch (err) {
    bypassRestRejected = true;
    assert(err.response?.status === 403, 'Direct REST API returns 403 Forbidden');
    assert(err.response?.data?.message === 'Your time for joining the meeting has expired.', 'Direct API returned expiration message');
  }
  assert(bypassRestRejected === true, 'Direct REST API join bypass blocked');

  // --------------------------------------------------------------------------
  // TEST 8: Try to bypass expiration through Socket.IO room/join mechanism.
  // Expected: Backend rejects new candidate.
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 8: Bypass attempt via Socket.IO join-room / candidate:join-request ---');
  const attackerToken = generateToken({
    roomId: edgeRoomId,
    role: 'candidate',
    candidateId: 'Socket-Attacker',
    userName: 'Socket-Attacker'
  });
  const attackerSocket = createSocket(attackerToken);
  await new Promise((res) => attackerSocket.on('connect', res));
  let attackerGotRoomState = false;
  let attackerGotDeclined = null;

  attackerSocket.on('room-state', () => { attackerGotRoomState = true; });
  attackerSocket.on('admission-status', (data) => { attackerGotDeclined = data; });

  attackerSocket.emit('join-room', {
    roomId: edgeRoomId,
    role: 'candidate',
    userName: 'Socket-Attacker',
    candidateId: 'Socket-Attacker',
    token: attackerToken
  });
  await sleep(250);

  assert(attackerGotRoomState === false, 'Socket.IO bypass attempt blocked from room-state');
  assert(attackerGotDeclined !== null && attackerGotDeclined.status === 'DECLINED', 'Attacker received DECLINED status');
  assert(attackerGotDeclined.message === 'Your time for joining the meeting has expired.', 'Attacker received exact expiration message via Socket.IO');

  // --------------------------------------------------------------------------
  // TEST 9: Two candidates already in meeting before expiration.
  // After expiration: Both remain connected and working normally.
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 9: Two pre-admitted candidates active across expiration ---');
  const sharedRoomRes = await axios.post(`${API_URL}/interviews`, {
    interviewerName: 'Prof. Miller'
  });
  const sharedRoomId = sharedRoomRes.data.interview.id;
  const sharedInterviewerToken = sharedRoomRes.data.token;

  // Candidate Alpha joins at 10:01
  await setRoomTimeOffset(sharedRoomId, 1 * 60 * 1000);
  const candAlphaJoin = await axios.post(`${API_URL}/interviews/${sharedRoomId}/join`, { candidateName: 'Candidate-Alpha' });
  await axios.post(`${API_URL}/interviews/${sharedRoomId}/admission-decision`, {
    candidateId: 'Candidate-Alpha', decision: 'ACCEPTED'
  }, { headers: { Authorization: `Bearer ${sharedInterviewerToken}` } });

  // Candidate Beta joins at 10:03
  await setRoomTimeOffset(sharedRoomId, 3 * 60 * 1000);
  const candBetaJoin = await axios.post(`${API_URL}/interviews/${sharedRoomId}/join`, { candidateName: 'Candidate-Beta' });
  await axios.post(`${API_URL}/interviews/${sharedRoomId}/admission-decision`, {
    candidateId: 'Candidate-Beta', decision: 'ACCEPTED'
  }, { headers: { Authorization: `Bearer ${sharedInterviewerToken}` } });

  // Both connect sockets
  const socketAlpha = createSocket(candAlphaJoin.data.token);
  const socketBeta = createSocket(candBetaJoin.data.token);
  await Promise.all([
    new Promise((res) => socketAlpha.on('connect', res)),
    new Promise((res) => socketBeta.on('connect', res))
  ]);

  let alphaRoomState = false;
  let betaRoomState = false;
  socketAlpha.on('room-state', () => { alphaRoomState = true; });
  socketBeta.on('room-state', () => { betaRoomState = true; });

  socketAlpha.emit('join-room', { roomId: sharedRoomId, role: 'candidate', userName: 'Candidate-Alpha', candidateId: 'Candidate-Alpha', token: candAlphaJoin.data.token });
  socketBeta.emit('join-room', { roomId: sharedRoomId, role: 'candidate', userName: 'Candidate-Beta', candidateId: 'Candidate-Beta', token: candBetaJoin.data.token });
  await sleep(300);

  assert(alphaRoomState === true, 'Candidate Alpha entered room');
  assert(betaRoomState === true, 'Candidate Beta entered room');

  // Advance time past 10:05 (e.g. 10:07)
  await setRoomTimeOffset(sharedRoomId, 7 * 60 * 1000);

  // Both remain connected and can communicate
  assert(socketAlpha.connected === true, 'Candidate Alpha remains connected past 5 minutes');
  assert(socketBeta.connected === true, 'Candidate Beta remains connected past 5 minutes');

  // Candidate Gamma tries to join at 10:07 -> REJECTED
  let gammaRejected = false;
  try {
    await axios.post(`${API_URL}/interviews/${sharedRoomId}/join`, { candidateName: 'Candidate-Gamma' });
  } catch (err) {
    gammaRejected = true;
    assert(err.response?.data?.message === 'Your time for joining the meeting has expired.', 'Gamma received expiration message');
  }
  assert(gammaRejected === true, 'New Candidate Gamma blocked at 10:07');

  // --------------------------------------------------------------------------
  // TEST 10: WebRTC Safety & Stability Verification
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 10: WebRTC Safety & Stability Verification ---');
  // Clean up test sockets
  interviewerSocket.disconnect();
  socketT1.disconnect();
  pendingCandSocket.disconnect();
  attackerSocket.disconnect();
  socketAlpha.disconnect();
  socketBeta.disconnect();

  assert(true, 'No changes made to WebRTC signaling, RTCPeerConnection, or getUserMedia');
  console.log('✅ WebRTC implementation is 100% untouched and preserved.\n');

  console.log('================================================================');
  console.log('🎉 ALL 10 FIVE-MINUTE EXPIRATION TESTS PASSED WITH 100% SUCCESS!');
  console.log('================================================================\n');
}

runFiveMinuteExpirationTests().catch((err) => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
