import io from 'socket.io-client';
import axios from 'axios';

const SERVER_URL = 'http://localhost:5001';

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSecurityAuditTests() {
  console.log('===============================================================');
  console.log('🛡️  CODEMEET FULL SECURITY AUDIT & REGRESSION TEST SUITE');
  console.log('===============================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition, message) {
    totalTests++;
    if (condition) {
      console.log(`✅ PASS: ${message}`);
      passedTests++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      throw new Error(`Test assertion failed: ${message}`);
    }
  }

  // -------------------------------------------------------------
  // SETUP: Create 2 Interview Rooms (Room 1 and Room 2)
  // -------------------------------------------------------------
  console.log('▶ Setup: Creating Room 1 and Room 2...');
  const room1Res = await axios.post(`${SERVER_URL}/api/interviews`, {
    interviewerName: 'Interviewer Alice',
    candidateName: 'Candidate Alice',
    problemId: 'find-largest-element'
  });
  const room1Id = room1Res.data.interview.id;
  const interviewerToken1 = room1Res.data.token;

  const room2Res = await axios.post(`${SERVER_URL}/api/interviews`, {
    interviewerName: 'Interviewer Bob',
    candidateName: 'Candidate Bob',
    problemId: 'reverse-string'
  });
  const room2Id = room2Res.data.interview.id;
  const interviewerToken2 = room2Res.data.token;

  assert(room1Id && interviewerToken1, 'Room 1 created with signed interviewer token');
  assert(room2Id && interviewerToken2, 'Room 2 created with signed interviewer token');

  // Candidate A and Candidate B join Room 1
  const candAJoin = await axios.post(`${SERVER_URL}/api/interviews/${room1Id}/join`, {
    candidateName: 'Candidate A'
  });
  const tokenA = candAJoin.data.token;

  const candBJoin = await axios.post(`${SERVER_URL}/api/interviews/${room1Id}/join`, {
    candidateName: 'Candidate B'
  });
  const tokenB = candBJoin.data.token;

  assert(tokenA && tokenB, 'Candidate A and Candidate B received signed auth tokens for Room 1');

  // Setup initial code and outputs for Candidate B
  const candBSocket = io(SERVER_URL, { transports: ['websocket'] });
  await new Promise((r) => candBSocket.on('connect', r));
  candBSocket.emit('join-room', {
    roomId: room1Id,
    token: tokenB,
    userName: 'Candidate B'
  });
  await sleep(200);

  // Candidate B types secret code & executes code
  candBSocket.emit('candidate-code-change', {
    roomId: room1Id,
    candidateId: 'Candidate B',
    questionId: 'find-largest-element',
    code: 'SECRET_CODE_OF_CANDIDATE_B = 12345',
    language: 'python'
  });

  candBSocket.emit('candidate-code-run-completed', {
    roomId: room1Id,
    candidateId: 'Candidate B',
    questionId: 'find-largest-element',
    result: { stdout: 'SECRET_OUTPUT_B', stderr: '', success: true }
  });

  // Interviewer assigns questions to Candidate B
  const interviewerSocket = io(SERVER_URL, { transports: ['websocket'] });
  await new Promise((r) => interviewerSocket.on('connect', r));
  interviewerSocket.emit('join-room', {
    roomId: room1Id,
    token: interviewerToken1,
    userName: 'Interviewer Alice'
  });
  await sleep(200);

  interviewerSocket.emit('assign-questions', {
    roomId: room1Id,
    candidateId: 'Candidate B',
    questionIds: ['two-sum', 'is-prime']
  });
  await sleep(200);

  // =============================================================
  // TEST 1: Candidate A changes candidateId to Candidate B
  // =============================================================
  console.log('\n--- TEST 1: Candidate A changes candidateId to Candidate B ---');
  let t1Denied = false;
  try {
    await axios.get(`${SERVER_URL}/api/interviews/${room1Id}?candidateId=Candidate%20B`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
  } catch (err) {
    if (err.response?.status === 403) {
      t1Denied = true;
    }
  }
  assert(t1Denied, 'Candidate A requesting candidateId=Candidate B returns 403 Forbidden');

  // =============================================================
  // TEST 2: Candidate A requests Candidate B\'s questions
  // =============================================================
  console.log('\n--- TEST 2: Candidate A attempts to access Candidate B\'s questions ---');
  const t2Res = await axios.get(`${SERVER_URL}/api/interviews/${room1Id}`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  const t2Questions = t2Res.data.interview.assignedQuestions;
  assert(!t2Questions['Candidate B'], 'Candidate A response does NOT contain Candidate B assigned questions');

  // =============================================================
  // TEST 3: Candidate A requests Candidate B\'s code
  // =============================================================
  console.log('\n--- TEST 3: Candidate A attempts to access Candidate B\'s code ---');
  const t3Code = t2Res.data.interview.candidateCode;
  assert(!t3Code['Candidate B'], 'Candidate A response does NOT contain Candidate B code');

  // =============================================================
  // TEST 4: Candidate A requests Candidate B\'s execution output
  // =============================================================
  console.log('\n--- TEST 4: Candidate A attempts to access Candidate B\'s execution output ---');
  const t4Outputs = t2Res.data.interview.candidateOutputs;
  assert(!t4Outputs['Candidate B'], 'Candidate A response does NOT contain Candidate B execution output');

  // =============================================================
  // TEST 5 & 6: Candidate A changes role=candidate to role=interviewer / X-user-role
  // =============================================================
  console.log('\n--- TEST 5 & 6: Candidate A attempts Role Spoofing (query & header) ---');
  const t5Res = await axios.get(`${SERVER_URL}/api/interviews/${room1Id}?role=interviewer`, {
    headers: {
      Authorization: `Bearer ${tokenA}`,
      'x-user-role': 'interviewer'
    }
  });
  assert(t5Res.data.interview.privateNotes === undefined, 'Candidate A with role=interviewer cannot access privateNotes (STILL TREATED AS CANDIDATE)');
  assert(!t5Res.data.interview.candidateCode['Candidate B'], 'Candidate A with role=interviewer cannot access Candidate B code');

  // =============================================================
  // TEST 7: Candidate A joins Socket.IO using another candidate\'s candidateId
  // =============================================================
  console.log('\n--- TEST 7: Candidate A connects to Socket.IO with forged candidateId ---');
  const candASocket = io(SERVER_URL, { transports: ['websocket'] });
  await new Promise((r) => candASocket.on('connect', r));

  let candARoomState = null;
  candASocket.on('room-state', (data) => { candARoomState = data; });

  candASocket.emit('join-room', {
    roomId: room1Id,
    token: tokenA,
    candidateId: 'Candidate B', // Attempted forge
    userName: 'Candidate B'
  });
  await sleep(300);

  assert(candARoomState !== null, 'Candidate A received room-state');
  assert(candARoomState.candidateId === 'Candidate A', 'Identity locked to Candidate A despite forged candidateId in join payload');
  assert(!candARoomState.candidateCode['Candidate B'], 'Socket room-state does NOT contain Candidate B code');

  // =============================================================
  // TEST 8: Candidate A attempts to subscribe to Candidate B\'s code
  // =============================================================
  console.log('\n--- TEST 8: Candidate A attempts to receive Candidate B code updates ---');
  let candAReceivedBCode = false;
  candASocket.on('candidate-code-update', (data) => {
    if (data.candidateId === 'Candidate B') {
      candAReceivedBCode = true;
    }
  });

  candBSocket.emit('candidate-code-change', {
    roomId: room1Id,
    candidateId: 'Candidate B',
    questionId: 'reverse-string',
    code: 's = "SECRET_STRING"',
    language: 'python'
  });
  await sleep(300);

  assert(!candAReceivedBCode, 'Candidate A DID NOT receive Candidate B real-time code update');

  // =============================================================
  // TEST 9: Candidate A attempts to receive Candidate B\'s execution result
  // =============================================================
  console.log('\n--- TEST 9: Candidate A attempts to receive Candidate B execution result ---');
  let candAReceivedBResult = false;
  candASocket.on('candidate-code-run-completed', (data) => {
    if (data.candidateId === 'Candidate B') {
      candAReceivedBResult = true;
    }
  });

  candBSocket.emit('candidate-code-run-completed', {
    roomId: room1Id,
    candidateId: 'Candidate B',
    questionId: 'reverse-string',
    result: { stdout: 'gnirtS_TERCES', stderr: '', success: true }
  });
  await sleep(300);

  assert(!candAReceivedBResult, 'Candidate A DID NOT receive Candidate B execution result');

  // =============================================================
  // TEST 10: Candidate A changes roomId to another interview
  // =============================================================
  console.log('\n--- TEST 10: Candidate A attempts to access Room 2 using Room 1 token ---');
  let t10Denied = false;
  try {
    await axios.get(`${SERVER_URL}/api/interviews/${room2Id}`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
  } catch (err) {
    if (err.response?.status === 403) {
      t10Denied = true;
    }
  }
  assert(t10Denied, 'Candidate A using Room 1 token to access Room 2 returns 403 Forbidden');

  // =============================================================
  // TEST 11: Candidate A attempts to forge assign-questions
  // =============================================================
  console.log('\n--- TEST 11: Candidate A attempts to emit assign-questions ---');
  candASocket.emit('assign-questions', {
    roomId: room1Id,
    candidateId: 'Candidate A',
    questionIds: ['all-questions-hacked']
  });
  await sleep(300);

  const t11Check = await axios.get(`${SERVER_URL}/api/interviews/${room1Id}`, {
    headers: { Authorization: `Bearer ${interviewerToken1}` }
  });
  const t11Assigned = t11Check.data.interview.assignedQuestions['Candidate A'] || [];
  assert(!t11Assigned.includes('all-questions-hacked'), 'Candidate A unauthorized assign-questions was ignored by server');

  // =============================================================
  // TEST 12: Candidate B submits code; Candidate A does NOT receive submission
  // =============================================================
  console.log('\n--- TEST 12: Candidate B code submission isolation ---');
  let candAReceivedBSubmission = false;
  let interviewerReceivedBSubmission = false;

  candASocket.on('code-submitted', () => { candAReceivedBSubmission = true; });
  interviewerSocket.on('code-submitted', () => { interviewerReceivedBSubmission = true; });

  candBSocket.emit('code-submitted', {
    roomId: room1Id,
    submission: { code: 'def solution(): return 42', language: 'python' }
  });
  await sleep(300);

  assert(!candAReceivedBSubmission, 'Candidate A did NOT receive Candidate B submission broadcast (No leak!)');
  assert(interviewerReceivedBSubmission, 'Interviewer successfully received Candidate B submission');

  // =============================================================
  // TEST 13: Submissions per-candidate isolation in store
  // =============================================================
  console.log('\n--- TEST 13: Submissions per-candidate store isolation ---');
  // Candidate A submits code
  await axios.post(`${SERVER_URL}/api/interviews/${room1Id}/submit`, {
    code: 'CANDIDATE_A_SUBMISSION',
    language: 'python',
    problemId: 'find-largest-element'
  }, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });

  // Candidate B submits code
  await axios.post(`${SERVER_URL}/api/interviews/${room1Id}/submit`, {
    code: 'CANDIDATE_B_SUBMISSION',
    language: 'python',
    problemId: 'two-sum'
  }, {
    headers: { Authorization: `Bearer ${tokenB}` }
  });

  // Interviewer checks both submissions
  const t13Check = await axios.get(`${SERVER_URL}/api/interviews/${room1Id}`, {
    headers: { Authorization: `Bearer ${interviewerToken1}` }
  });
  const subs = t13Check.data.interview.candidateSubmissions || {};
  assert(subs['Candidate A']?.code === 'CANDIDATE_A_SUBMISSION', 'Candidate A submission preserved');
  assert(subs['Candidate B']?.code === 'CANDIDATE_B_SUBMISSION', 'Candidate B submission preserved without overwrite');

  // =============================================================
  // TEST 14: Check 4 STDIN Isolation Regression
  // =============================================================
  console.log('\n--- TEST 14: Check 4 STDIN isolation verified ---');
  const runRes = await axios.post(`${SERVER_URL}/api/judge0/run`, {
    source_code: 'import sys\nprint("input_len=", len(sys.stdin.read()))',
    language: 'python',
    stdin: ''
  });
  assert(runRes.data.result.stdout.trim() === 'input_len= 0', 'Empty runtime STDIN remains completely empty (Check 4 intact)');

  // =============================================================
  // TEST 15: Check 12 Interviewer Access Intact
  // =============================================================
  console.log('\n--- TEST 15: Check 12 Interviewer Access Intact ---');
  const intViewRes = await axios.get(`${SERVER_URL}/api/interviews/${room1Id}`, {
    headers: { Authorization: `Bearer ${interviewerToken1}` }
  });
  assert(intViewRes.data.interview.candidateCode['Candidate B'] !== undefined, 'Interviewer can view Candidate B code');
  assert(intViewRes.data.interview.candidateOutputs['Candidate B'] !== undefined, 'Interviewer can view Candidate B outputs');
  assert(intViewRes.data.interview.privateNotes !== undefined, 'Interviewer can view private notes');

  // Cleanup sockets
  candASocket.disconnect();
  candBSocket.disconnect();
  interviewerSocket.disconnect();

  console.log('\n===============================================================');
  console.log(`🎉 ALL ${passedTests}/${totalTests} SECURITY AUDIT CHECKS PASSED WITH 100% SUCCESS!`);
  console.log('===============================================================\n');
}

runSecurityAuditTests().catch((err) => {
  console.error('\n❌ Security Audit Test Failed:', err);
  process.exit(1);
});
