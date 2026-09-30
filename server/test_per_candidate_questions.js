import io from 'socket.io-client';

const API_BASE = 'http://localhost:5001';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

function createSocket(token, roomId, role, userName) {
  return io(API_BASE, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runAcceptanceTest() {
  console.log('===============================================================');
  console.log('TEST SUITE: PER-CANDIDATE QUESTION SELECTION AFTER JOINING');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, testName) {
    total++;
    if (condition) {
      console.log(`  ✓ [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${testName}`);
    }
  }

  // 1. Interviewer creates/opens an interview
  console.log('Step 1: Interviewer creates interview room...');
  const createRes = await request('/api/interviews', {
    method: 'POST',
    body: JSON.stringify({ interviewerName: 'Lead Interviewer' })
  });
  assert(createRes.status === 201 && createRes.data.interview, 'Interviewer creates room successfully');
  const roomId = createRes.data.interview.id;
  const interviewerToken = createRes.data.token;

  const interviewerSocket = createSocket(interviewerToken, roomId, 'interviewer', 'Lead Interviewer');
  await new Promise((resolve) => {
    interviewerSocket.on('connect', () => {
      interviewerSocket.emit('join-room', {
        roomId,
        role: 'interviewer',
        userName: 'Lead Interviewer',
        token: interviewerToken
      });
      resolve();
    });
  });
  console.log(`  Room created with ID: ${roomId}\n`);

  // 2. Candidate A joins
  console.log('Step 2: Candidate A joins...');
  const joinARes = await request(`/api/interviews/${roomId}/join`, {
    method: 'POST',
    body: JSON.stringify({ candidateName: 'Candidate A' })
  });
  assert(joinARes.status === 200 && joinARes.data.token, 'Candidate A registers and receives token');
  const tokenA = joinARes.data.token;

  const candidateASocket = createSocket(tokenA, roomId, 'candidate', 'Candidate A');
  let candARoomState = null;
  let candAAssignedUpdates = [];
  candidateASocket.on('room-state', (state) => { candARoomState = state; });
  candidateASocket.on('assigned-questions-update', (data) => { candAAssignedUpdates.push(data); });

  await new Promise((resolve) => {
    candidateASocket.on('connect', () => {
      candidateASocket.emit('join-room', {
        roomId,
        role: 'candidate',
        userName: 'Candidate A',
        token: tokenA
      });
      setTimeout(resolve, 300);
    });
  });

  // 3. Interviewer sees: Candidate A - Question Not Assigned
  console.log('Step 3: Interviewer sees Candidate A - Question Not Assigned...');
  const checkCandAInterviewer = await request(`/api/interviews/${roomId}`, {
    headers: { Authorization: `Bearer ${interviewerToken}` }
  });
  const candAAssignedList = checkCandAInterviewer.data.interview?.assignedQuestions?.['Candidate A'] || [];
  assert(candAAssignedList.length === 0, 'Candidate A assigned questions is initially empty (Question: Not Assigned)');
  assert(candARoomState?.problemId === null, 'Candidate A initial problemId is null');

  // 4. Interviewer selects Question 1 (find-largest-element) for Candidate A
  console.log('Step 4: Interviewer assigns Question 1 (find-largest-element) to Candidate A...');
  interviewerSocket.emit('assign-questions', {
    roomId,
    candidateId: 'Candidate A',
    questionIds: ['find-largest-element']
  });
  await sleep(300);

  // 5. Candidate A sees Question 1
  console.log('Step 5: Candidate A sees Question 1...');
  assert(
    candAAssignedUpdates.length > 0 &&
    candAAssignedUpdates[candAAssignedUpdates.length - 1].assignedQuestionIds[0] === 'find-largest-element',
    'Candidate A received real-time socket update with Question 1 (find-largest-element)'
  );
  const candAGet = await request(`/api/interviews/${roomId}`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert(candAGet.data.interview.problemId === 'find-largest-element', 'Candidate A API reports assigned Question 1');

  // 6. Candidate B joins
  console.log('\nStep 6: Candidate B joins...');
  const joinBRes = await request(`/api/interviews/${roomId}/join`, {
    method: 'POST',
    body: JSON.stringify({ candidateName: 'Candidate B' })
  });
  assert(joinBRes.status === 200 && joinBRes.data.token, 'Candidate B registers and receives token');
  const tokenB = joinBRes.data.token;

  const candidateBSocket = createSocket(tokenB, roomId, 'candidate', 'Candidate B');
  let candBRoomState = null;
  let candBAssignedUpdates = [];
  candidateBSocket.on('room-state', (state) => { candBRoomState = state; });
  candidateBSocket.on('assigned-questions-update', (data) => { candBAssignedUpdates.push(data); });

  await new Promise((resolve) => {
    candidateBSocket.on('connect', () => {
      candidateBSocket.emit('join-room', {
        roomId,
        role: 'candidate',
        userName: 'Candidate B',
        token: tokenB
      });
      setTimeout(resolve, 300);
    });
  });

  // 7. Interviewer sees: Candidate B - Question Not Assigned
  console.log('Step 7: Interviewer sees Candidate B - Question Not Assigned...');
  const checkCandBInterviewer = await request(`/api/interviews/${roomId}`, {
    headers: { Authorization: `Bearer ${interviewerToken}` }
  });
  const candBAssignedList = checkCandBInterviewer.data.interview?.assignedQuestions?.['Candidate B'] || [];
  assert(candBAssignedList.length === 0, 'Candidate B assigned questions is initially empty (Question: Not Assigned)');
  assert(candBRoomState?.problemId === null, 'Candidate B initial problemId is null');

  // 8. Interviewer selects Question 2 (reverse-string) for Candidate B
  console.log('Step 8: Interviewer assigns Question 2 (reverse-string) to Candidate B...');
  const prevCandAUpdateCount = candAAssignedUpdates.length;
  interviewerSocket.emit('assign-questions', {
    roomId,
    candidateId: 'Candidate B',
    questionIds: ['reverse-string']
  });
  await sleep(300);

  // 9. Candidate B sees Question 2
  console.log('Step 9: Candidate B sees Question 2...');
  assert(
    candBAssignedUpdates.length > 0 &&
    candBAssignedUpdates[candBAssignedUpdates.length - 1].assignedQuestionIds[0] === 'reverse-string',
    'Candidate B received real-time socket update with Question 2 (reverse-string)'
  );
  const candBGet = await request(`/api/interviews/${roomId}`, {
    headers: { Authorization: `Bearer ${tokenB}` }
  });
  assert(candBGet.data.interview.problemId === 'reverse-string', 'Candidate B API reports assigned Question 2');

  // 10. Verify Candidate A STILL sees Question 1
  console.log('Step 10: Verify Candidate A STILL sees Question 1...');
  assert(candAAssignedUpdates.length === prevCandAUpdateCount, 'Candidate A did NOT receive Candidate B socket event');
  const candAGet2 = await request(`/api/interviews/${roomId}`, {
    headers: { Authorization: `Bearer ${tokenA}` }
  });
  assert(candAGet2.data.interview.problemId === 'find-largest-element', 'Candidate A STILL sees Question 1 (find-largest-element)');

  // 11. Candidate C joins
  console.log('\nStep 11: Candidate C joins...');
  const joinCRes = await request(`/api/interviews/${roomId}/join`, {
    method: 'POST',
    body: JSON.stringify({ candidateName: 'Candidate C' })
  });
  assert(joinCRes.status === 200 && joinCRes.data.token, 'Candidate C registers and receives token');
  const tokenC = joinCRes.data.token;

  const candidateCSocket = createSocket(tokenC, roomId, 'candidate', 'Candidate C');
  let candCAssignedUpdates = [];
  candidateCSocket.on('assigned-questions-update', (data) => { candCAssignedUpdates.push(data); });

  await new Promise((resolve) => {
    candidateCSocket.on('connect', () => {
      candidateCSocket.emit('join-room', {
        roomId,
        role: 'candidate',
        userName: 'Candidate C',
        token: tokenC
      });
      setTimeout(resolve, 300);
    });
  });

  // 12. Interviewer selects Question 3 (is-prime) for Candidate C
  console.log('Step 12: Interviewer assigns Question 3 (is-prime) to Candidate C via API...');
  const assignCRes = await request(`/api/interviews/${roomId}/assign-question`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${interviewerToken}` },
    body: JSON.stringify({ candidateId: 'Candidate C', questionId: 'is-prime' })
  });
  assert(assignCRes.status === 200 && assignCRes.data.success, 'Interviewer assigned Question 3 to Candidate C via REST API');

  // Also emit via socket for real-time notification
  interviewerSocket.emit('assign-questions', {
    roomId,
    candidateId: 'Candidate C',
    questionIds: ['is-prime']
  });
  await sleep(300);

  // 13. Verify: Candidate A -> Q1, Candidate B -> Q2, Candidate C -> Q3
  console.log('Step 13: Verify all 3 candidates have isolated assigned questions...');
  const candAGet3 = await request(`/api/interviews/${roomId}`, { headers: { Authorization: `Bearer ${tokenA}` } });
  const candBGet3 = await request(`/api/interviews/${roomId}`, { headers: { Authorization: `Bearer ${tokenB}` } });
  const candCGet3 = await request(`/api/interviews/${roomId}`, { headers: { Authorization: `Bearer ${tokenC}` } });

  assert(candAGet3.data.interview.problemId === 'find-largest-element', 'Candidate A -> Question 1 (find-largest-element)');
  assert(candBGet3.data.interview.problemId === 'reverse-string', 'Candidate B -> Question 2 (reverse-string)');
  assert(candCGet3.data.interview.problemId === 'is-prime', 'Candidate C -> Question 3 (is-prime)');

  // 14. Change Candidate B's question to Question 4 (binary-search)
  console.log('\nStep 14: Change Candidate B\'s question to Question 4 (binary-search)...');
  const changeBRes = await request(`/api/interviews/${roomId}/assign-question`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${interviewerToken}` },
    body: JSON.stringify({ candidateId: 'Candidate B', questionId: 'binary-search' })
  });
  assert(changeBRes.status === 200, 'Interviewer changes Candidate B question via REST API');

  interviewerSocket.emit('assign-questions', {
    roomId,
    candidateId: 'Candidate B',
    questionIds: ['binary-search']
  });
  await sleep(300);

  // 15. Verify: Candidate A -> Q1, Candidate B -> Q4, Candidate C -> Q3
  console.log('Step 15: Verify Candidate B question changed, other candidates unaffected...');
  const candAGet4 = await request(`/api/interviews/${roomId}`, { headers: { Authorization: `Bearer ${tokenA}` } });
  const candBGet4 = await request(`/api/interviews/${roomId}`, { headers: { Authorization: `Bearer ${tokenB}` } });
  const candCGet4 = await request(`/api/interviews/${roomId}`, { headers: { Authorization: `Bearer ${tokenC}` } });

  assert(candAGet4.data.interview.problemId === 'find-largest-element', 'Candidate A STILL has Question 1');
  assert(candBGet4.data.interview.problemId === 'binary-search', 'Candidate B now has Question 4 (binary-search)');
  assert(candCGet4.data.interview.problemId === 'is-prime', 'Candidate C STILL has Question 3');

  // 16. Verify Candidate A cannot retrieve Candidate B's question through backend
  console.log('\nStep 16: Verify Candidate A cannot retrieve Candidate B\'s question...');
  assert(!candAGet4.data.interview.assignedQuestions['Candidate B'], 'Candidate A payload does NOT include Candidate B assignment');
  assert(!candAGet4.data.interview.assignedQuestions['Candidate C'], 'Candidate A payload does NOT include Candidate C assignment');

  // 17. Verify Candidate B cannot retrieve Candidate A's question through backend
  console.log('Step 17: Verify Candidate B cannot retrieve Candidate A\'s question...');
  assert(!candBGet4.data.interview.assignedQuestions['Candidate A'], 'Candidate B payload does NOT include Candidate A assignment');
  assert(!candBGet4.data.interview.assignedQuestions['Candidate C'], 'Candidate B payload does NOT include Candidate C assignment');

  // 18. Verify candidate cannot use the question-assignment API
  console.log('\nStep 18: Verify candidates cannot use question-assignment API...');
  const candTamperRes = await request(`/api/interviews/${roomId}/assign-question`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${tokenA}` },
    body: JSON.stringify({ candidateId: 'Candidate A', questionId: 'fizzbuzz' })
  });
  assert(candTamperRes.status === 403, 'Candidate token is rejected with 403 Forbidden on assign-question API');

  // Verify candidate socket cannot emit assign-questions
  let socketError = null;
  candidateASocket.on('error', (err) => { socketError = err; });
  candidateASocket.emit('assign-questions', {
    roomId,
    candidateId: 'Candidate A',
    questionIds: ['fizzbuzz']
  });
  await sleep(300);
  assert(socketError !== null, 'Candidate socket assign-questions rejected with error event');

  // Verify Question 1 is still Candidate A's question
  const candAVerify = await request(`/api/interviews/${roomId}`, { headers: { Authorization: `Bearer ${tokenA}` } });
  assert(candAVerify.data.interview.problemId === 'find-largest-element', 'Candidate A question remains unchanged after tampering attempt');

  // Clean up sockets
  interviewerSocket.disconnect();
  candidateASocket.disconnect();
  candidateBSocket.disconnect();
  candidateCSocket.disconnect();

  console.log('\n===============================================================');
  console.log(`RESULTS: ${passed}/${total} TESTS PASSED (${((passed / total) * 100).toFixed(0)}%)`);
  console.log('===============================================================');

  if (passed === total) {
    console.log('✅ ALL ACCEPTANCE CRITERIA AND SECURITY CHECKS PASSED PERFECTLY!\n');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED.\n');
    process.exit(1);
  }
}

runAcceptanceTest().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
