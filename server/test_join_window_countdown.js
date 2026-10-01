import io from 'socket.io-client';
import axios from 'axios';

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

let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (!condition) {
    console.error(`❌ FAILED (${totalCount}): ${message}`);
    throw new Error(message);
  } else {
    passedCount++;
    console.log(`✅ PASSED (${passedCount}/${totalCount}): ${message}`);
  }
}

async function setRoomTimeOffset(roomId, elapsedMs) {
  const res = await axios.post(`${API_URL}/interviews/${roomId}/adjust-time-for-test`, {
    elapsedMs
  });
  return res.data;
}

function formatCountdown(seconds) {
  if (seconds === null || seconds === undefined || seconds <= 0 || isNaN(seconds)) {
    return '00:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function calculateRemainingSeconds(deadline, serverTime) {
  const offset = serverTime ? serverTime - Date.now() : 0;
  const currentEffectiveServerTime = Date.now() + offset;
  return Math.max(0, Math.floor((deadline - currentEffectiveServerTime) / 1000));
}

async function runJoinWindowCountdownTests() {
  console.log('================================================================');
  console.log('⏱️ TEST SUITE: 5-MINUTE JOIN-WINDOW COUNTDOWN VERIFICATION');
  console.log('================================================================\n');

  // SETUP: Interviewer starts/creates meeting at 10:00:00
  console.log('--- SETUP: Create new interview session at T=0 ---');
  const createRes = await axios.post(`${API_URL}/interviews`, {
    interviewerName: 'Lead Interviewer',
    candidateName: 'Candidate Alice'
  });
  assert(createRes.status === 201, 'Interview room created');
  const roomId = createRes.data.interview.id;
  const interviewerToken = createRes.data.token;
  const serverStartedAt = createRes.data.interview.meetingStartedAt;
  const serverDeadline = createRes.data.interview.meetingJoinDeadline;

  assert(serverDeadline === serverStartedAt + 5 * 60 * 1000, 'Server meetingJoinDeadline is exactly meetingStartedAt + 5 minutes');

  // Connect Interviewer socket
  const interviewerSocket = createSocket(interviewerToken);
  await new Promise((res) => interviewerSocket.on('connect', res));
  interviewerSocket.emit('join-room', {
    roomId,
    role: 'interviewer',
    userName: 'Lead Interviewer',
    token: interviewerToken
  });
  await sleep(100);

  // --------------------------------------------------------------------------
  // TEST 1: Candidate entry page displays ~05:00 at meeting start
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 1: Candidate pre-join entry page fetches server deadline at T=0 ---');
  const validateResT0 = await axios.get(`${API_URL}/interviews/${roomId}/validate`);
  assert(validateResT0.status === 200, 'Pre-join validation succeeds');
  assert(validateResT0.data.deadline === serverDeadline, 'Pre-join uses the exact server meetingJoinDeadline');
  assert(validateResT0.data.isJoinWindowExpired === false, 'isJoinWindowExpired is false at start');
  const secT0 = calculateRemainingSeconds(validateResT0.data.deadline, validateResT0.data.serverTime);
  assert(secT0 >= 298 && secT0 <= 300, `Countdown starts at approximately 05:00 (sec: ${secT0}, formatted: ${formatCountdown(secT0)})`);

  // --------------------------------------------------------------------------
  // TEST 2: Wait 30 seconds -> approximately 04:30
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: After 30s elapsed, countdown displays ~04:30 ---');
  await setRoomTimeOffset(roomId, 30 * 1000); // 30 seconds elapsed
  const validateResT30 = await axios.get(`${API_URL}/interviews/${roomId}/validate`);
  const secT30 = calculateRemainingSeconds(validateResT30.data.deadline, validateResT30.data.serverTime);
  assert(secT30 >= 268 && secT30 <= 272, `Countdown after 30s is approximately 04:30 (sec: ${secT30}, formatted: ${formatCountdown(secT30)})`);

  // --------------------------------------------------------------------------
  // TEST 3: Candidate enters interview at ~2 minutes -> sees ~03:00, NOT 05:00
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Candidate enters interview at 2 mins -> sees ~03:00, NOT 05:00 ---');
  const t3Offset = await setRoomTimeOffset(roomId, 2 * 60 * 1000); // 2 minutes elapsed
  const activeDeadlineT3 = t3Offset.meetingJoinDeadline;

  const candJoinRes = await axios.post(`${API_URL}/interviews/${roomId}/join`, {
    candidateName: 'Candidate-Alice'
  });
  assert(candJoinRes.status === 200, 'Candidate join request accepted at 2 minutes');
  const candToken = candJoinRes.data.token;

  // Interviewer approves candidate
  await axios.post(
    `${API_URL}/interviews/${roomId}/admission-decision`,
    { candidateId: 'Candidate-Alice', decision: 'ACCEPTED' },
    { headers: { Authorization: `Bearer ${interviewerToken}` } }
  );

  // Candidate fetches room state on entrance
  const candRoomRes = await axios.post(`${API_URL}/interviews/${roomId}/session`, {}, {
    headers: { Authorization: `Bearer ${candToken}` }
  });
  assert(candRoomRes.data.interview.meetingJoinDeadline === activeDeadlineT3, 'Candidate sees exact server meetingJoinDeadline');
  const candSec = calculateRemainingSeconds(candRoomRes.data.interview.meetingJoinDeadline, candRoomRes.data.interview.serverTime);
  assert(candSec >= 178 && candSec <= 182, `Candidate sees approximately 03:00 (sec: ${candSec}, formatted: ${formatCountdown(candSec)}) NOT 05:00`);

  // Connect candidate socket
  const candSocket = createSocket(candToken);
  await new Promise((res) => candSocket.on('connect', res));
  candSocket.emit('join-room', {
    roomId,
    role: 'candidate',
    userName: 'Candidate-Alice',
    candidateId: 'Candidate-Alice',
    token: candToken
  });
  await sleep(150);

  // --------------------------------------------------------------------------
  // TEST 4: Interviewer sees the same remaining deadline
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Interviewer sees exact same remaining deadline ---');
  const interviewerRoomRes = await axios.post(`${API_URL}/interviews/${roomId}/session`, {}, {
    headers: { Authorization: `Bearer ${interviewerToken}` }
  });
  assert(interviewerRoomRes.data.interview.meetingJoinDeadline === activeDeadlineT3, 'Interviewer receives same server deadline as candidate');
  const interviewerSec = calculateRemainingSeconds(interviewerRoomRes.data.interview.meetingJoinDeadline, interviewerRoomRes.data.interview.serverTime);
  assert(Math.abs(interviewerSec - candSec) <= 1, `Interviewer (${interviewerSec}s) and Candidate (${candSec}s) are synchronized within 1s`);

  // --------------------------------------------------------------------------
  // TEST 5: Candidate refreshes -> countdown continues from existing deadline
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: Candidate refreshes -> countdown continues from existing deadline ---');
  // Advance 15 more seconds (total 2m 15s elapsed)
  const t5Offset = await setRoomTimeOffset(roomId, (2 * 60 + 15) * 1000);
  const activeDeadlineT5 = t5Offset.meetingJoinDeadline;
  const candRefreshRes = await axios.post(`${API_URL}/interviews/${roomId}/session`, {}, {
    headers: { Authorization: `Bearer ${candToken}` }
  });
  assert(candRefreshRes.data.interview.meetingJoinDeadline === activeDeadlineT5, 'Candidate sees existing deadline on refresh');
  const candRefreshSec = calculateRemainingSeconds(candRefreshRes.data.interview.meetingJoinDeadline, candRefreshRes.data.interview.serverTime);
  assert(candRefreshSec >= 163 && candRefreshSec <= 167, `After refresh, Candidate sees ~02:45 (sec: ${candRefreshSec}, formatted: ${formatCountdown(candRefreshSec)}) - does NOT restart to 05:00`);

  // --------------------------------------------------------------------------
  // TEST 6: Interviewer refreshes -> countdown continues from existing deadline
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: Interviewer refreshes -> countdown continues from existing deadline ---');
  const interviewerRefreshRes = await axios.post(`${API_URL}/interviews/${roomId}/session`, {}, {
    headers: { Authorization: `Bearer ${interviewerToken}` }
  });
  const interviewerRefreshSec = calculateRemainingSeconds(interviewerRefreshRes.data.interview.meetingJoinDeadline, interviewerRefreshRes.data.interview.serverTime);
  assert(interviewerRefreshSec >= 163 && interviewerRefreshSec <= 167, `After refresh, Interviewer sees ~02:45 (sec: ${interviewerRefreshSec}) - does NOT restart`);

  // --------------------------------------------------------------------------
  // TEST 7: Countdown reaches 00:00 -> status changes to "Join window expired"
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 7: Countdown reaches 00:00 -> expired status ---');
  const t7Offset = await setRoomTimeOffset(roomId, 5 * 60 * 1000 + 1000); // 5m 1s elapsed
  const activeDeadlineT7 = t7Offset.meetingJoinDeadline;
  const expiredRoomRes = await axios.post(`${API_URL}/interviews/${roomId}/session`, {}, {
    headers: { Authorization: `Bearer ${candToken}` }
  });
  const expiredSec = calculateRemainingSeconds(expiredRoomRes.data.interview.meetingJoinDeadline, expiredRoomRes.data.interview.serverTime);
  assert(expiredSec === 0, 'Countdown remaining seconds reaches exactly 0');
  assert(formatCountdown(expiredSec) === '00:00', 'Formatted string is 00:00');
  assert(expiredRoomRes.data.interview.isJoinWindowExpired === true, 'isJoinWindowExpired is true on server');

  // Verify existing candidate is NOT disconnected
  assert(candSocket.connected === true, 'Candidate socket remains actively connected after countdown reaches 00:00');
  assert(interviewerSocket.connected === true, 'Interviewer socket remains actively connected after countdown reaches 00:00');

  // --------------------------------------------------------------------------
  // TEST 8: After expiration, a NEW candidate attempts to join -> REJECTED
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 8: After expiration, NEW candidate is rejected with existing message ---');
  let newCandRejected = false;
  let newCandMessage = '';
  try {
    await axios.post(`${API_URL}/interviews/${roomId}/join`, {
      candidateName: 'Candidate-Late'
    });
  } catch (err) {
    newCandRejected = true;
    newCandMessage = err.response?.data?.message;
    assert(err.response?.status === 403, 'HTTP 403 returned for new candidate after join window expires');
  }
  assert(newCandRejected === true, 'Late candidate entry rejected');
  assert(newCandMessage === 'Your time for joining the meeting has expired.', `Rejection message: "${newCandMessage}"`);

  // Pre-join validation for new candidate after expiration
  let validateLateRejected = false;
  let validateLateDeadline = null;
  try {
    await axios.get(`${API_URL}/interviews/${roomId}/validate`);
  } catch (err) {
    validateLateRejected = true;
    validateLateDeadline = err.response?.data?.deadline;
    assert(err.response?.status === 403, 'Validate endpoint returns 403 when expired');
    assert(err.response?.data?.expired === true, 'Validate endpoint returns expired: true');
  }
  assert(validateLateRejected === true, 'Pre-join validation marks room as expired');
  assert(validateLateDeadline === activeDeadlineT7, 'Validate error response still supplies the authoritative server deadline');

  // --------------------------------------------------------------------------
  // TEST 9: Already-admitted candidate continues using editor, execution, guidance
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 9: Already-admitted candidate continues working after expiration ---');
  // Candidate submits code
  const codeSubmitRes = await axios.post(
    `${API_URL}/interviews/${roomId}/submit`,
    {
      code: 'print("Post-deadline execution works!")',
      language: 'python',
      problemId: 'two-sum'
    },
    { headers: { Authorization: `Bearer ${candToken}` } }
  );
  assert(codeSubmitRes.status === 200, 'Code submission works uninterrupted after expiration');

  // Candidate sends code-update via socket
  let gotCodeUpdate = false;
  interviewerSocket.on('code-update', (data) => {
    if (data.code === 'def solve(): return 42') gotCodeUpdate = true;
  });
  candSocket.emit('code-change', {
    roomId,
    code: 'def solve(): return 42',
    language: 'python'
  });
  await sleep(150);
  assert(gotCodeUpdate === true, 'Socket code synchronization works uninterrupted after expiration');

  // --------------------------------------------------------------------------
  // TEST 10: Active-screen / tab monitoring continues working exactly as before
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 10: Screen violation tracking continues working uninterrupted ---');
  let candGotWarning1 = false;
  candSocket.on('screen-violation-warning', (data) => {
    if (data.violations === 1) candGotWarning1 = true;
  });

  // Candidate switches tab (Violation #1)
  candSocket.emit('candidate:screen-hidden');
  await sleep(200);
  assert(candGotWarning1 === true, 'Candidate receives Warning #1 after join window expiration');

  // --------------------------------------------------------------------------
  // TEST 11: WebRTC signaling and participant presence integrity
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 11: WebRTC signaling integrity verified ---');
  let signalReceived = false;
  candSocket.on('webrtc-offer', (data) => {
    if (data.offer?.sdp === 'v=0...') signalReceived = true;
  });

  interviewerSocket.emit('webrtc-offer', {
    roomId,
    targetSocketId: candSocket.id,
    offer: { type: 'offer', sdp: 'v=0...' }
  });
  await sleep(150);
  assert(signalReceived === true, 'WebRTC signaling packets transmit normally without interference');

  // Teardown
  candSocket.disconnect();
  interviewerSocket.disconnect();

  console.log('\n================================================================');
  console.log(`🎉 ALL ${passedCount} / ${totalCount} TESTS PASSED SUCCESSFULLY!`);
  console.log('================================================================');
}

runJoinWindowCountdownTests().catch((err) => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
