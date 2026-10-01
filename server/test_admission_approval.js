import io from 'socket.io-client';
import axios from 'axios';

const BASE_URL = 'http://localhost:5001';
const API_URL = `${BASE_URL}/api`;

function createSocket() {
  return io(BASE_URL, {
    transports: ['websocket'],
    forceNew: true,
    reconnection: false
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

async function runAllSecurityTests() {
  console.log('================================================================');
  console.log('🔒 EXHAUSTIVE ADMISSION & WAITING ROOM SECURITY TEST SUITE');
  console.log('================================================================\n');

  // SETUP: Create an interview session
  const initRes = await axios.post(`${API_URL}/interviews`, {
    interviewerName: 'Sarah Interviewer'
  });
  assert(initRes.status === 201, 'Interview room created');
  const roomId = initRes.data.interview.id;
  const interviewerToken = initRes.data.token;

  // Connect Interviewer socket
  const interviewerSocket = createSocket();
  await new Promise((resolve) => interviewerSocket.on('connect', resolve));
  interviewerSocket.emit('join-room', {
    roomId,
    role: 'interviewer',
    userName: 'Sarah Interviewer',
    token: interviewerToken
  });
  await sleep(150);

  // --------------------------------------------------------------------------
  // TEST 1: Candidate requests to join.
  // Expected: Interviewer receives request. Candidate remains outside room.
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 1: Candidate requests to join ---');
  let interviewerReceivedReq = null;
  interviewerSocket.on('candidate-join-request', (req) => {
    interviewerReceivedReq = req;
  });

  const joinCandidateARes = await axios.post(`${API_URL}/interviews/${roomId}/join`, {
    candidateName: 'Candidate-Alice'
  });
  assert(joinCandidateARes.data.admissionStatus === 'PENDING', 'Join response gives PENDING admission status');
  const candidateAToken = joinCandidateARes.data.token;

  await sleep(200);
  assert(interviewerReceivedReq !== null, 'Interviewer received real-time candidate-join-request');
  assert(interviewerReceivedReq.candidateId === 'Candidate-Alice', 'Request contains Candidate-Alice id');

  // Candidate A socket connects and attempts to join room while PENDING
  const candASocket = createSocket();
  await new Promise((resolve) => candASocket.on('connect', resolve));

  let candAGotRoomState = false;
  let candAGotAdmissionStatus = null;
  candASocket.on('room-state', () => { candAGotRoomState = true; });
  candASocket.on('admission-status', (data) => { candAGotAdmissionStatus = data; });

  candASocket.emit('join-room', {
    roomId,
    role: 'candidate',
    userName: 'Candidate-Alice',
    candidateId: 'Candidate-Alice',
    token: candidateAToken
  });

  await sleep(300);
  assert(candAGotAdmissionStatus !== null && candAGotAdmissionStatus.status === 'PENDING', 'Candidate A received PENDING admission status');
  assert(candAGotRoomState === false, 'Candidate A did NOT receive room-state while PENDING (remains outside room)');

  // --------------------------------------------------------------------------
  // TEST 2: Interviewer accepts.
  // Expected: Candidate enters room successfully.
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 2: Interviewer accepts Candidate A ---');
  let candAReceivedAccepted = false;
  candASocket.on('candidate-join-accepted', () => { candAReceivedAccepted = true; });

  // Interviewer sends admission-decision ACCEPTED via API or socket
  await axios.post(
    `${API_URL}/interviews/${roomId}/admission-decision`,
    { candidateId: 'Candidate-Alice', decision: 'ACCEPTED' },
    { headers: { Authorization: `Bearer ${interviewerToken}` } }
  );

  await sleep(200);
  assert(candAReceivedAccepted === true, 'Candidate A received real-time candidate-join-accepted event');

  // Now candidate A emits join-room as ACCEPTED
  candASocket.emit('join-room', {
    roomId,
    role: 'candidate',
    userName: 'Candidate-Alice',
    candidateId: 'Candidate-Alice',
    token: candidateAToken
  });

  await sleep(300);
  assert(candAGotRoomState === true, 'Candidate A received room-state after being ACCEPTED (entered room)');

  // --------------------------------------------------------------------------
  // TEST 3: Interviewer declines.
  // Expected: Candidate receives decline message and cannot enter.
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 3: Interviewer declines Candidate B ---');
  const joinCandidateBRes = await axios.post(`${API_URL}/interviews/${roomId}/join`, {
    candidateName: 'Candidate-Bob'
  });
  const candidateBToken = joinCandidateBRes.data.token;

  const candBSocket = createSocket();
  await new Promise((resolve) => candBSocket.on('connect', resolve));
  let candBDeclined = false;
  let candBGotRoomState = false;
  candBSocket.on('candidate-join-declined', () => { candBDeclined = true; });
  candBSocket.on('room-state', () => { candBGotRoomState = true; });

  candBSocket.emit('candidate:join-request', {
    roomId,
    candidateName: 'Candidate-Bob',
    candidateId: 'Candidate-Bob'
  });
  await sleep(150);

  // Interviewer declines Candidate B
  await axios.post(
    `${API_URL}/interviews/${roomId}/admission-decision`,
    { candidateId: 'Candidate-Bob', decision: 'DECLINED' },
    { headers: { Authorization: `Bearer ${interviewerToken}` } }
  );

  await sleep(200);
  assert(candBDeclined === true, 'Candidate B received real-time candidate-join-declined event');

  // Bob tries to join-room directly anyway
  candBSocket.emit('join-room', {
    roomId,
    role: 'candidate',
    userName: 'Candidate-Bob',
    candidateId: 'Candidate-Bob',
    token: candidateBToken
  });

  await sleep(300);
  assert(candBGotRoomState === false, 'Candidate B blocked from room-state after being DECLINED');

  // --------------------------------------------------------------------------
  // TEST 4: Candidate tries to bypass approval by directly calling join-room.
  // Expected: Backend rejects the request while status != ACCEPTED.
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 4: Direct join-room bypass attempt without approval ---');
  const candCJoin = await axios.post(`${API_URL}/interviews/${roomId}/join`, { candidateName: 'Candidate-Charlie' });
  const candidateCToken = candCJoin.data.token;

  const candCSocket = createSocket();
  await new Promise((resolve) => candCSocket.on('connect', resolve));

  let candCGotRoomState = false;
  let candCGotAdmission = null;
  candCSocket.on('room-state', () => { candCGotRoomState = true; });
  candCSocket.on('admission-status', (d) => { candCGotAdmission = d; });

  // Unadmitted Candidate C directly emits join-room without prior accept
  candCSocket.emit('join-room', {
    roomId,
    role: 'candidate',
    userName: 'Candidate-Charlie',
    candidateId: 'Candidate-Charlie',
    token: candidateCToken
  });

  await sleep(300);
  assert(candCGotAdmission !== null && candCGotAdmission.status === 'PENDING', 'Backend routed bypass attempt to waiting channel as PENDING');
  assert(candCGotRoomState === false, 'Backend strictly prevented Candidate C from joining room or getting room-state');

  // --------------------------------------------------------------------------
  // TEST 5: Candidate changes candidateId.
  // Expected: No unauthorized access.
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 5: Candidate changes candidateId to Candidate-Alice ---');
  const candSpoofSocket = createSocket();
  await new Promise((resolve) => candSpoofSocket.on('connect', resolve));
  let spoofGotRoomState = false;
  candSpoofSocket.on('room-state', () => { spoofGotRoomState = true; });

  // Candidate B attempts to use Candidate-Alice's candidateId with Bob's token
  candSpoofSocket.emit('join-room', {
    roomId,
    role: 'candidate',
    userName: 'Candidate-Alice',
    candidateId: 'Candidate-Alice',
    token: candidateBToken // Bob's signed token has candidateId: 'Candidate-Bob'
  });

  await sleep(300);
  assert(spoofGotRoomState === false, 'Backend enforced immutable token claims and prevented candidateId spoofing');

  // --------------------------------------------------------------------------
  // TEST 6: Candidate changes role to interviewer.
  // Expected: No effect / unauthorized.
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 6: Candidate changes role to interviewer ---');
  const candRoleSpoof = createSocket();
  await new Promise((resolve) => candRoleSpoof.on('connect', resolve));
  let fakeInterviewerDecisionError = false;
  candRoleSpoof.on('error', () => { fakeInterviewerDecisionError = true; });

  // Candidate A socket (or arbitrary socket) tries to send admission-decision
  candRoleSpoof.emit('admission-decision', {
    roomId,
    candidateId: 'Candidate-Bob',
    decision: 'ACCEPTED'
  });

  await sleep(200);
  assert(fakeInterviewerDecisionError === true, 'Unauthorized admission-decision rejected with error event');

  // Verify Bob is still DECLINED in backend
  const bobStatusRes = await axios.post(`${API_URL}/interviews/${roomId}/admission-status`, {
    candidateId: 'Candidate-Bob'
  }, {
    headers: { Authorization: `Bearer ${interviewerToken}` }
  });
  assert(bobStatusRes.data.admissionStatus === 'DECLINED', 'Bob status remained DECLINED despite fake socket call');

  // --------------------------------------------------------------------------
  // TEST 7: Candidate sends a fake ACCEPTED status from frontend.
  // Expected: Backend ignores/rejects it.
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 7: Fake ACCEPTED status sent from frontend ---');
  let candCStillBlocked = false;
  candCSocket.emit('join-room', {
    roomId,
    role: 'candidate',
    userName: 'Candidate-Charlie',
    candidateId: 'Candidate-Charlie',
    token: candidateCToken,
    admissionStatus: 'ACCEPTED',
    status: 'ACCEPTED'
  });
  await sleep(300);
  assert(candCGotRoomState === false, 'Backend completely ignored client-supplied admissionStatus and blocked room entry');

  // --------------------------------------------------------------------------
  // TEST 8: Two candidates request simultaneously.
  // Expected: Interviewer receives two independent requests.
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 8: Two simultaneous candidate requests ---');
  const receivedReqs = [];
  const reqListener = (r) => { receivedReqs.push(r); };
  interviewerSocket.on('candidate-join-request', reqListener);

  const [daveJoinRes, eveJoinRes] = await Promise.all([
    axios.post(`${API_URL}/interviews/${roomId}/join`, { candidateName: 'Candidate-Dave' }),
    axios.post(`${API_URL}/interviews/${roomId}/join`, { candidateName: 'Candidate-Eve' })
  ]);
  const daveToken = daveJoinRes.data.token;
  const eveToken = eveJoinRes.data.token;

  await sleep(300);
  interviewerSocket.off('candidate-join-request', reqListener);

  const daveReq = receivedReqs.find((r) => r.candidateId === 'Candidate-Dave');
  const eveReq = receivedReqs.find((r) => r.candidateId === 'Candidate-Eve');
  assert(daveReq !== undefined, 'Interviewer received Candidate-Dave request');
  assert(eveReq !== undefined, 'Interviewer received Candidate-Eve request');

  // --------------------------------------------------------------------------
  // TEST 9: Interviewer accepts Candidate D but declines Candidate E.
  // Expected: D enters, E remains outside.
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 9: Accept Candidate D, decline Candidate E independently ---');
  const candDSocket = createSocket();
  const candESocket = createSocket();
  await Promise.all([
    new Promise((res) => candDSocket.on('connect', res)),
    new Promise((res) => candESocket.on('connect', res))
  ]);

  let daveAccepted = false;
  let eveDeclined = false;
  let daveRoomState = false;
  let eveRoomState = false;

  candDSocket.on('candidate-join-accepted', () => { daveAccepted = true; });
  candESocket.on('candidate-join-declined', () => { eveDeclined = true; });
  candDSocket.on('room-state', () => { daveRoomState = true; });
  candESocket.on('room-state', () => { eveRoomState = true; });

  candDSocket.emit('candidate:join-request', { roomId, candidateName: 'Candidate-Dave', candidateId: 'Candidate-Dave', token: daveToken });
  candESocket.emit('candidate:join-request', { roomId, candidateName: 'Candidate-Eve', candidateId: 'Candidate-Eve', token: eveToken });
  await sleep(150);

  // Accept D, Decline E
  await axios.post(
    `${API_URL}/interviews/${roomId}/admission-decision`,
    { candidateId: 'Candidate-Dave', decision: 'ACCEPTED' },
    { headers: { Authorization: `Bearer ${interviewerToken}` } }
  );
  await axios.post(
    `${API_URL}/interviews/${roomId}/admission-decision`,
    { candidateId: 'Candidate-Eve', decision: 'DECLINED' },
    { headers: { Authorization: `Bearer ${interviewerToken}` } }
  );

  await sleep(200);
  assert(daveAccepted === true, 'Candidate D received ACCEPTED event');
  assert(eveDeclined === true, 'Candidate E received DECLINED event');

  // Dave joins room
  candDSocket.emit('join-room', { roomId, role: 'candidate', userName: 'Candidate-Dave', candidateId: 'Candidate-Dave', token: daveToken });
  // Eve tries to join room
  candESocket.emit('join-room', { roomId, role: 'candidate', userName: 'Candidate-Eve', candidateId: 'Candidate-Eve', token: eveToken });

  await sleep(300);
  assert(daveRoomState === true, 'Candidate D entered room and received room-state');
  assert(eveRoomState === false, 'Candidate E remained blocked outside room');

  // --------------------------------------------------------------------------
  // TEST 10: Candidate refreshes while PENDING.
  // Expected: Candidate remains PENDING.
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 10: Candidate refreshes while PENDING ---');
  const frankJoinRes = await axios.post(`${API_URL}/interviews/${roomId}/join`, { candidateName: 'Candidate-Frank' });
  const frankToken = frankJoinRes.data.token;
  const statusBeforeRefresh = await axios.post(`${API_URL}/interviews/${roomId}/admission-status`, {
    candidateId: 'Candidate-Frank'
  }, {
    headers: { Authorization: `Bearer ${frankToken}` }
  });
  assert(statusBeforeRefresh.data.admissionStatus === 'PENDING', 'Candidate Frank is PENDING before refresh');

  // Emulate browser reload by checking interview info endpoint as candidate
  const interviewCandView = await axios.post(`${API_URL}/interviews/${roomId}/session`, {
    candidateId: 'Candidate-Frank'
  }, {
    headers: { Authorization: `Bearer ${frankToken}` }
  });
  assert(interviewCandView.data.interview.admissionStatus === 'PENDING', 'Candidate Frank remains PENDING after simulated page refresh');

  // --------------------------------------------------------------------------
  // TEST 11: Interviewer refreshes while candidates are PENDING.
  // Expected: Pending requests are restored from backend state.
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 11: Interviewer refreshes and restores pending requests ---');
  const pendingRes = await axios.post(`${API_URL}/interviews/${roomId}/pending-requests`, {}, {
    headers: { Authorization: `Bearer ${interviewerToken}` }
  });
  assert(Array.isArray(pendingRes.data.pendingRequests), 'pendingRequests is an array');
  const frankPending = pendingRes.data.pendingRequests.find((r) => r.candidateId === 'Candidate-Frank');
  assert(frankPending !== undefined, 'Candidate-Frank is present in restored pending requests list');

  // --------------------------------------------------------------------------
  // TEST 12: Pending candidate attempts to connect to WebRTC / interview room directly.
  // Expected: Backend refuses unauthorized room participation.
  // --------------------------------------------------------------------------
  console.log('\n--- TEST 12: Pending candidate WebRTC participation refused ---');
  let interviewerGotFrankPeer = false;
  interviewerSocket.on('existing-peer', (p) => {
    if (p.userName === 'Candidate-Frank') interviewerGotFrankPeer = true;
  });
  interviewerSocket.on('user-joined', (p) => {
    if (p.userName === 'Candidate-Frank') interviewerGotFrankPeer = true;
  });

  const candFSocket = createSocket();
  await new Promise((res) => candFSocket.on('connect', res));
  candFSocket.emit('join-room', {
    roomId,
    role: 'candidate',
    userName: 'Candidate-Frank',
    candidateId: 'Candidate-Frank',
    token: frankToken
  });

  await sleep(300);
  assert(interviewerGotFrankPeer === false, 'Interviewer did NOT receive peer or user-joined notification for pending candidate');

  // Cleanup sockets
  interviewerSocket.disconnect();
  candASocket.disconnect();
  candBSocket.disconnect();
  candCSocket.disconnect();
  candDSocket.disconnect();
  candESocket.disconnect();
  candFSocket.disconnect();
  candSpoofSocket.disconnect();
  candRoleSpoof.disconnect();

  console.log('\n================================================================');
  console.log('🎉 ALL 12 ADMISSION SECURITY TESTS PASSED WITH 100% SUCCESS!');
  console.log('================================================================\n');
}

runAllSecurityTests().catch((err) => {
  console.error('Fatal error during security test run:', err);
  process.exit(1);
});
