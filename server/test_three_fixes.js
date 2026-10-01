import io from 'socket.io-client';
import axios from 'axios';

const SERVER_URL = 'http://localhost:5001';

async function runThreeFixesVerification() {
  console.log('===============================================================');
  console.log('🧪 VERIFYING THE 3 REQUESTED FIXES');
  console.log('===============================================================\n');

  // -------------------------------------------------------------
  // TEST 2 — USER INPUT (STDIN) VIA CODE EXECUTION SERVICE
  // -------------------------------------------------------------
  console.log('---------------------------------------------------------------');
  console.log('📋 TEST 2: USER INPUT (STDIN) EXECUTION');
  console.log('---------------------------------------------------------------');

  // Case A: string input (Trisha)
  console.log('▶ Case A: name = input(); print("Hello", name) with input "Trisha"');
  const resA = await axios.post(`${SERVER_URL}/api/judge0/run`, {
    source_code: `name = input()\nprint("Hello", name)`,
    language: 'python',
    stdin: 'Trisha'
  });

  console.log('  Result stdout:', JSON.stringify(resA.data.result.stdout));
  console.log('  Success:', resA.data.result.success);
  if (resA.data.result.stdout.trim() === 'Hello Trisha') {
    console.log('  ✅ Case A PASSED: Program received stdin "Trisha" and produced "Hello Trisha".');
  } else {
    throw new Error(`Case A FAILED: Expected "Hello Trisha", got ${JSON.stringify(resA.data.result.stdout)}`);
  }

  // Case B: multi-line numeric input (10, 20)
  console.log('\n▶ Case B: a = int(input()); b = int(input()); print(a + b) with input "10\\n20"');
  const resB = await axios.post(`${SERVER_URL}/api/judge0/run`, {
    source_code: `a = int(input())\nb = int(input())\nprint(a + b)`,
    language: 'python',
    stdin: "10\n20"
  });

  console.log('  Result stdout:', JSON.stringify(resB.data.result.stdout));
  console.log('  Success:', resB.data.result.success);
  if (resB.data.result.stdout.trim() === '30') {
    console.log('  ✅ Case B PASSED: Program received multi-line stdin 10 and 20, produced 30.');
  } else {
    throw new Error(`Case B FAILED: Expected "30", got ${JSON.stringify(resB.data.result.stdout)}`);
  }

  // Case C: prompt input: name = input("Enter your name: "); print("Hello", name)
  console.log('\n▶ Case C: name = input("Enter your name: "); print("Hello", name)');
  const resC = await axios.post(`${SERVER_URL}/api/judge0/run`, {
    source_code: `name = input("Enter your name: ")\nprint("Hello", name)`,
    language: 'python',
    stdin: 'Trisha'
  });
  console.log('  Result stdout:', JSON.stringify(resC.data.result.stdout));
  if (resC.data.result.stdout.includes('Hello Trisha')) {
    console.log('  ✅ Case C PASSED: Prompt-based input works seamlessly.');
  } else {
    throw new Error(`Case C FAILED: Expected Hello Trisha in stdout`);
  }

  // -------------------------------------------------------------
  // TEST 3 — MULTIPLE CANDIDATES OUTPUT ISOLATION & PRIVACY
  // -------------------------------------------------------------
  console.log('\n---------------------------------------------------------------');
  console.log('📋 TEST 3: MULTIPLE CANDIDATES OUTPUT ISOLATION & PRIVACY');
  console.log('---------------------------------------------------------------');

  // Step 1: Create room
  const createRes = await axios.post(`${SERVER_URL}/api/interviews`, {
    interviewerName: 'Interviewer Alice',
    candidateName: 'Candidate 1',
    problemId: 'find-largest-element'
  });
  const roomId = createRes.data.interview.id;
  console.log(`Created interview room: ${roomId}`);

  // Step 2: Sockets for Interviewer, Candidate 1, Candidate 2, Candidate 3
  const interviewerSocket = io(SERVER_URL, { transports: ['websocket'] });
  const cand1Socket = io(SERVER_URL, { transports: ['websocket'] });
  const cand2Socket = io(SERVER_URL, { transports: ['websocket'] });
  const cand3Socket = io(SERVER_URL, { transports: ['websocket'] });

  await Promise.all([
    new Promise((resolve) => interviewerSocket.on('connect', resolve)),
    new Promise((resolve) => cand1Socket.on('connect', resolve)),
    new Promise((resolve) => cand2Socket.on('connect', resolve)),
    new Promise((resolve) => cand3Socket.on('connect', resolve))
  ]);

  interviewerSocket.emit('join-room', { roomId, role: 'interviewer', userName: 'Interviewer Alice' });
  cand1Socket.emit('join-room', { roomId, role: 'candidate', userName: 'Candidate 1', candidateId: 'Candidate 1' });
  cand2Socket.emit('join-room', { roomId, role: 'candidate', userName: 'Candidate 2', candidateId: 'Candidate 2' });
  cand3Socket.emit('join-room', { roomId, role: 'candidate', userName: 'Candidate 3', candidateId: 'Candidate 3' });

  await new Promise((r) => setTimeout(r, 500));

  // Set up listeners on all 4 sockets
  const interviewerOutputsReceived = [];
  const cand1OutputsReceived = [];
  const cand2OutputsReceived = [];
  const cand3OutputsReceived = [];

  interviewerSocket.on('candidate-code-run-completed', (data) => {
    interviewerOutputsReceived.push(data);
  });
  cand1Socket.on('candidate-code-run-completed', (data) => {
    cand1OutputsReceived.push(data);
  });
  cand2Socket.on('candidate-code-run-completed', (data) => {
    cand2OutputsReceived.push(data);
  });
  cand3Socket.on('candidate-code-run-completed', (data) => {
    cand3OutputsReceived.push(data);
  });

  // Action 1: Candidate 1 runs program -> "Candidate 1 output"
  console.log('\n▶ Candidate 1 runs code producing "Candidate 1 output"...');
  cand1Socket.emit('candidate-code-run-completed', {
    roomId,
    candidateId: 'Candidate 1',
    questionId: 'find-largest-element',
    result: { stdout: 'Candidate 1 output', success: true }
  });

  await new Promise((r) => setTimeout(r, 400));

  // Action 2: Candidate 2 runs program -> "Candidate 2 output"
  console.log('▶ Candidate 2 runs code producing "Candidate 2 output"...');
  cand2Socket.emit('candidate-code-run-completed', {
    roomId,
    candidateId: 'Candidate 2',
    questionId: 'reverse-string',
    result: { stdout: 'Candidate 2 output', success: true }
  });

  await new Promise((r) => setTimeout(r, 400));

  // Action 3: Candidate 3 runs program -> "Candidate 3 output"
  console.log('▶ Candidate 3 runs code producing "Candidate 3 output"...');
  cand3Socket.emit('candidate-code-run-completed', {
    roomId,
    candidateId: 'Candidate 3',
    questionId: 'is-prime',
    result: { stdout: 'Candidate 3 output', success: true }
  });

  await new Promise((r) => setTimeout(r, 500));

  console.log('\nResults Verification:');
  console.log('Candidate 1 received:', cand1OutputsReceived.map((o) => `${o.candidateId}: ${o.result.stdout}`));
  console.log('Candidate 2 received:', cand2OutputsReceived.map((o) => `${o.candidateId}: ${o.result.stdout}`));
  console.log('Candidate 3 received:', cand3OutputsReceived.map((o) => `${o.candidateId}: ${o.result.stdout}`));
  console.log('Interviewer received:', interviewerOutputsReceived.map((o) => `${o.candidateId}: ${o.result.stdout}`));

  // Verify Candidate 1 received ONLY their own output
  const c1HasOnlySelf = cand1OutputsReceived.length === 1 && cand1OutputsReceived[0].candidateId === 'Candidate 1';
  if (!c1HasOnlySelf) {
    throw new Error('FAIL: Candidate 1 received outputs belonging to other candidates or did not receive their own!');
  }
  console.log('✅ Candidate 1 saw ONLY Candidate 1 output!');

  // Verify Candidate 2 received ONLY their own output
  const c2HasOnlySelf = cand2OutputsReceived.length === 1 && cand2OutputsReceived[0].candidateId === 'Candidate 2';
  if (!c2HasOnlySelf) {
    throw new Error('FAIL: Candidate 2 received outputs belonging to other candidates or did not receive their own!');
  }
  console.log('✅ Candidate 2 saw ONLY Candidate 2 output!');

  // Verify Candidate 3 received ONLY their own output
  const c3HasOnlySelf = cand3OutputsReceived.length === 1 && cand3OutputsReceived[0].candidateId === 'Candidate 3';
  if (!c3HasOnlySelf) {
    throw new Error('FAIL: Candidate 3 received outputs belonging to other candidates or did not receive their own!');
  }
  console.log('✅ Candidate 3 saw ONLY Candidate 3 output!');

  // Verify Interviewer received all 3 outputs
  if (interviewerOutputsReceived.length === 3) {
    console.log('✅ Interviewer received all 3 candidates\' outputs in real-time!');
  } else {
    throw new Error('FAIL: Interviewer did not receive all candidates\' outputs!');
  }

  // Verify API-level isolation: Candidate 2 queries API to try to get Candidate 1 output
  console.log('\n▶ Verifying API-level isolation (REST endpoint privacy check)...');
  const cand2ApiRes = await axios.get(`${SERVER_URL}/api/interviews/${roomId}?role=candidate&candidateId=Candidate%202`);
  const cand2OutputsInApi = cand2ApiRes.data.interview.candidateOutputs;

  console.log('Candidate 2 API candidateOutputs:', Object.keys(cand2OutputsInApi || {}));
  if (!cand2OutputsInApi['Candidate 1'] && !cand2OutputsInApi['Candidate 3']) {
    console.log('✅ API Security Verified: Candidate 2 cannot see Candidate 1 or Candidate 3 outputs via API!');
  } else {
    throw new Error('FAIL: API security breached! Other candidate outputs exposed in API response!');
  }

  // Cleanup
  interviewerSocket.disconnect();
  cand1Socket.disconnect();
  cand2Socket.disconnect();
  cand3Socket.disconnect();

  console.log('\n===============================================================');
  console.log('🎉 ALL TESTS PASSED WITH 100% SUCCESS!');
  console.log('===============================================================\n');
}

runThreeFixesVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err.message);
  process.exit(1);
});
