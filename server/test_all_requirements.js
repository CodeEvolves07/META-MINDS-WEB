import io from 'socket.io-client';
import axios from 'axios';

const SERVER_URL = 'http://localhost:5001';

async function runAllTests() {
  console.log('===============================================================');
  console.log('🧪 CODE-MEET FINAL VERIFICATION TEST SUITE');
  console.log('===============================================================\n');

  // Step 1: Create an Interview Room
  console.log('Step 1: Creating interview room via API...');
  const createRes = await axios.post(`${SERVER_URL}/api/interviews`, {
    interviewerName: 'Sarah Connor',
    candidateName: 'Candidate 1',
    problemId: 'find-largest-element'
  });

  const roomId = createRes.data.interview.id;
  console.log(`✅ Room created successfully: ${roomId}\n`);

  // Step 2: Connect Interviewer and 3 Candidates via Socket.IO
  console.log('Step 2: Connecting Interviewer, Candidate 1, Candidate 2, Candidate 3...');
  
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
  console.log('✅ All 4 sockets connected to server\n');

  // Step 3: Join Room with isolated roles & candidate IDs
  console.log('Step 3: Joining room with role-based metadata...');
  
  let cand1InitialState = null;
  let cand2InitialState = null;
  let cand3InitialState = null;

  cand1Socket.on('room-state', (data) => { cand1InitialState = data; });
  cand2Socket.on('room-state', (data) => { cand2InitialState = data; });
  cand3Socket.on('room-state', (data) => { cand3InitialState = data; });

  interviewerSocket.emit('join-room', {
    roomId,
    role: 'interviewer',
    userName: 'Sarah Connor',
    candidateId: null
  });

  cand1Socket.emit('join-room', {
    roomId,
    role: 'candidate',
    userName: 'Candidate 1',
    candidateId: 'Candidate 1'
  });

  cand2Socket.emit('join-room', {
    roomId,
    role: 'candidate',
    userName: 'Candidate 2',
    candidateId: 'Candidate 2'
  });

  cand3Socket.emit('join-room', {
    roomId,
    role: 'candidate',
    userName: 'Candidate 3',
    candidateId: 'Candidate 3'
  });

  await new Promise((r) => setTimeout(r, 600));

  // REQUIREMENT 1 & 2: COMPLETELY BLANK MONACO EDITOR FOR CANDIDATES
  console.log('---------------------------------------------------------------');
  console.log('📋 VERIFICATION 1: COMPLETELY BLANK MONACO EDITOR');
  console.log('---------------------------------------------------------------');
  console.log(`Candidate 1 initial code: "${cand1InitialState?.code}"`);
  console.log(`Candidate 2 initial code: "${cand2InitialState?.code}"`);
  console.log(`Candidate 3 initial code: "${cand3InitialState?.code}"`);

  if (cand1InitialState?.code === '' && cand2InitialState?.code === '' && cand3InitialState?.code === '') {
    console.log('✅ PASS: Monaco Editor starts COMPLETELY BLANK for all candidates!');
    console.log('✅ PASS: Zero pre-written solutions, zero auto-generated answers.\n');
  } else {
    throw new Error('FAIL: Monaco Editor did not start blank!');
  }

  // REQUIREMENT 4 & 10: QUESTION ASSIGNMENT & CANDIDATE VIEW ISOLATION
  console.log('---------------------------------------------------------------');
  console.log('📋 VERIFICATION 2: QUESTION ASSIGNMENT & CANDIDATE VIEW ISOLATION');
  console.log('---------------------------------------------------------------');
  
  let cand1Assigned = null;
  let cand2Assigned = null;
  let cand3Assigned = null;

  cand1Socket.on('assigned-questions-update', (d) => { cand1Assigned = d.assignedQuestionIds; });
  cand2Socket.on('assigned-questions-update', (d) => { cand2Assigned = d.assignedQuestionIds; });
  cand3Socket.on('assigned-questions-update', (d) => { cand3Assigned = d.assignedQuestionIds; });

  // Interviewer assigns Q1, Q2, Q3 to Candidate 1
  interviewerSocket.emit('assign-questions', {
    roomId,
    candidateId: 'Candidate 1',
    questionIds: ['find-largest-element', 'reverse-string', 'is-prime']
  });

  // Interviewer assigns Q4, Q5, Q6 to Candidate 2
  interviewerSocket.emit('assign-questions', {
    roomId,
    candidateId: 'Candidate 2',
    questionIds: ['binary-search', 'two-sum', 'valid-parentheses']
  });

  // Interviewer assigns Q7, Q8, Q9 to Candidate 3
  interviewerSocket.emit('assign-questions', {
    roomId,
    candidateId: 'Candidate 3',
    questionIds: ['longest-substring', 'factorial-calc', 'max-subarray']
  });

  await new Promise((r) => setTimeout(r, 600));

  console.log('Candidate 1 Assigned:', cand1Assigned);
  console.log('Candidate 2 Assigned:', cand2Assigned);
  console.log('Candidate 3 Assigned:', cand3Assigned);

  if (
    cand1Assigned?.length === 3 && cand1Assigned.includes('reverse-string') &&
    cand2Assigned?.length === 3 && cand2Assigned.includes('two-sum') &&
    cand3Assigned?.length === 3 && cand3Assigned.includes('factorial-calc')
  ) {
    console.log('✅ PASS: Each candidate received strictly their assigned questions!');
    console.log('✅ PASS: Candidates 1, 2, 3 have completely isolated question sets.\n');
  } else {
    throw new Error('FAIL: Question assignments mismatch!');
  }

  // REQUIREMENT 3 & 4: CANDIDATE CODE VISIBILITY TO INTERVIEWER & COMPLETE CANDIDATE PRIVACY
  console.log('---------------------------------------------------------------');
  console.log('📋 VERIFICATION 3: CANDIDATE PRIVACY & INTERVIEWER REAL-TIME OBSERVATION');
  console.log('---------------------------------------------------------------');
  
  let interviewerReceivedCode = null;
  let cand2ReceivedCode = null;
  let cand3ReceivedCode = null;

  interviewerSocket.on('candidate-code-update', (data) => {
    interviewerReceivedCode = data;
  });

  cand2Socket.on('candidate-code-update', (data) => {
    cand2ReceivedCode = data;
  });

  cand3Socket.on('candidate-code-update', (data) => {
    cand3ReceivedCode = data;
  });

  const c1Code = `import sys

def solve():
    nums = list(map(int, sys.stdin.read().split()))
    print(max(nums))

solve()`;

  console.log('Candidate 1 typing code for "find-largest-element"...');
  cand1Socket.emit('candidate-code-change', {
    roomId,
    candidateId: 'Candidate 1',
    questionId: 'find-largest-element',
    code: c1Code,
    language: 'python'
  });

  await new Promise((r) => setTimeout(r, 600));

  console.log(`Interviewer received code:`, interviewerReceivedCode ? `Yes (${interviewerReceivedCode.candidateId})` : 'No');
  console.log(`Candidate 2 received Candidate 1 code:`, cand2ReceivedCode ? 'LEAKED!' : 'No (Protected)');
  console.log(`Candidate 3 received Candidate 1 code:`, cand3ReceivedCode ? 'LEAKED!' : 'No (Protected)');

  if (interviewerReceivedCode?.candidateId === 'Candidate 1' && interviewerReceivedCode.code === c1Code) {
    console.log('✅ PASS: Interviewer can see Candidate 1\'s code in real-time as they type!');
  } else {
    throw new Error('FAIL: Interviewer did not receive candidate code!');
  }

  if (cand2ReceivedCode === null && cand3ReceivedCode === null) {
    console.log('✅ PASS: Candidate 2 and Candidate 3 DID NOT receive Candidate 1\'s code (TOTAL PRIVACY ISOLATION)!\n');
  } else {
    throw new Error('FAIL: Candidate privacy breach! Candidate code leaked to other candidates!');
  }

  // REQUIREMENT 9: MULTIPLE QUESTIONS PERSISTENCE
  console.log('---------------------------------------------------------------');
  console.log('📋 VERIFICATION 4: MULTIPLE QUESTIONS PER-QUESTION PERSISTENCE');
  console.log('---------------------------------------------------------------');
  console.log('Candidate 1 switches to Question 2 (reverse-string)...');
  
  // In the application, when Candidate 1 opens Question 2:
  // It starts blank. Then candidate types Question 2 code.
  const c1Q2Code = `s = input().strip()\nprint(s[::-1])`;
  cand1Socket.emit('candidate-code-change', {
    roomId,
    candidateId: 'Candidate 1',
    questionId: 'reverse-string',
    code: c1Q2Code,
    language: 'python'
  });

  await new Promise((r) => setTimeout(r, 400));

  // Verify backend store preserved both questions independently
  const getInterviewRes = await axios.get(`${SERVER_URL}/api/interviews/${roomId}?role=interviewer`);
  const cand1Stored = getInterviewRes.data.interview.candidateCode['Candidate 1'];

  console.log('Candidate 1 Question 1 Stored Code:', cand1Stored['find-largest-element']?.code ? 'Persisted' : 'Missing');
  console.log('Candidate 1 Question 2 Stored Code:', cand1Stored['reverse-string']?.code ? 'Persisted' : 'Missing');

  if (cand1Stored['find-largest-element']?.code === c1Code && cand1Stored['reverse-string']?.code === c1Q2Code) {
    console.log('✅ PASS: Candidate\'s code persists across multiple questions without overwriting!\n');
  } else {
    throw new Error('FAIL: Question code was not persisted correctly!');
  }

  // REQUIREMENT 5, 6, 7, 8: REAL CODE EXECUTION TESTS
  console.log('---------------------------------------------------------------');
  console.log('📋 VERIFICATION 5: REAL CODE EXECUTION (JUDGE0 / NATIVE SANDBOX)');
  console.log('---------------------------------------------------------------');

  // TEST 1 — CORRECT CODE
  console.log('▶ TEST 1 — CORRECT CODE (Python find largest):');
  const run1 = await axios.post(`${SERVER_URL}/api/judge0/run`, {
    source_code: `nums = list(map(int, input().split()))\nprint(max(nums))`,
    language: 'python',
    stdin: '3 5 1 9 2'
  });
  console.log('  Result stdout:', JSON.stringify(run1.data.result.stdout));
  console.log('  Success:', run1.data.result.success);
  if (run1.data.result.stdout.trim() === '9' && run1.data.result.success) {
    console.log('  ✅ TEST 1 PASSED: Real execution executed candidate code and returned correct output 9.');
  } else {
    throw new Error('TEST 1 FAILED!');
  }

  // TEST 2 — INCORRECT CODE
  console.log('\n▶ TEST 2 — INCORRECT CODE:');
  const run2 = await axios.post(`${SERVER_URL}/api/judge0/run`, {
    source_code: `print(42)`,
    language: 'python',
    stdin: '3 5 1 9 2'
  });
  console.log('  Result stdout:', JSON.stringify(run2.data.result.stdout));
  if (run2.data.result.stdout.trim() === '42') {
    console.log('  ✅ TEST 2 PASSED: Real execution returns actual incorrect output (42), NOT fake correct output.');
  } else {
    throw new Error('TEST 2 FAILED!');
  }

  // TEST 3 — SYNTAX/COMPILATION ERROR
  console.log('\n▶ TEST 3 — SYNTAX ERROR:');
  const run3 = await axios.post(`${SERVER_URL}/api/judge0/run`, {
    source_code: `def broken_syntax( :`,
    language: 'python',
    stdin: '3 5 1 9 2'
  });
  const errOutput = run3.data.result.compile_output || run3.data.result.stderr;
  console.log('  Result error:', errOutput ? errOutput.split('\n')[0] : 'None');
  console.log('  Success:', run3.data.result.success);
  if (!run3.data.result.success && errOutput && errOutput.includes('SyntaxError')) {
    console.log('  ✅ TEST 3 PASSED: Real syntax error is accurately caught and reported.');
  } else {
    throw new Error('TEST 3 FAILED!');
  }

  // TEST 4 — EMPTY CODE
  console.log('\n▶ TEST 4 — EMPTY CODE:');
  const run4 = await axios.post(`${SERVER_URL}/api/judge0/run`, {
    source_code: `    `,
    language: 'python',
    stdin: '3 5 1 9 2'
  });
  console.log('  Result description:', run4.data.result.status.description);
  console.log('  Result stderr:', run4.data.result.stderr);
  if (run4.data.result.status.description === 'Empty Code Error') {
    console.log('  ✅ TEST 4 PASSED: Empty code returns explicit Empty Code Error; zero hidden solutions executed.');
  } else {
    throw new Error('TEST 4 FAILED!');
  }

  // TEST 5 — DIFFERENT LANGUAGES
  console.log('\n▶ TEST 5 — DIFFERENT LANGUAGES:');

  // JavaScript
  console.log('  Testing JavaScript (Node.js)...');
  const jsRun = await axios.post(`${SERVER_URL}/api/judge0/run`, {
    source_code: `const fs = require('fs'); const input = fs.readFileSync(0, 'utf-8').trim(); const nums = input.split(/\\s+/).map(Number); console.log(Math.max(...nums));`,
    language: 'javascript',
    stdin: '3 5 1 9 2'
  });
  console.log('  JavaScript stdout:', JSON.stringify(jsRun.data.result.stdout));
  if (jsRun.data.result.stdout.trim() === '9') {
    console.log('  ✅ JavaScript execution passed!');
  } else {
    throw new Error('JavaScript execution failed!');
  }

  // C++ (Wandbox GCC)
  console.log('  Testing C++ (GCC)...');
  const cppRun = await axios.post(`${SERVER_URL}/api/judge0/run`, {
    source_code: `#include <iostream>\n#include <algorithm>\nusing namespace std;\nint main() { int x, m = -1e9; while (cin >> x) m = max(m, x); cout << m; return 0; }`,
    language: 'cpp',
    stdin: '3 5 1 9 2'
  });
  console.log('  C++ stdout:', JSON.stringify(cppRun.data.result.stdout));
  if (cppRun.data.result.stdout.trim() === '9') {
    console.log('  ✅ C++ execution passed!');
  } else {
    throw new Error('C++ execution failed!');
  }

  // Java (Wandbox OpenJDK)
  console.log('  Testing Java (OpenJDK)...');
  const javaRun = await axios.post(`${SERVER_URL}/api/judge0/run`, {
    source_code: `import java.util.Scanner;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    int max = Integer.MIN_VALUE;\n    while (sc.hasNextInt()) {\n      int n = sc.nextInt();\n      if (n > max) max = n;\n    }\n    System.out.println(max);\n  }\n}`,
    language: 'java',
    stdin: '3 5 1 9 2'
  });
  console.log('  Java stdout:', JSON.stringify(javaRun.data.result.stdout));
  if (javaRun.data.result.stdout.trim() === '9') {
    console.log('  ✅ Java execution passed!');
  } else {
    throw new Error('Java execution failed!');
  }

  // Cleanup sockets
  interviewerSocket.disconnect();
  cand1Socket.disconnect();
  cand2Socket.disconnect();
  cand3Socket.disconnect();

  console.log('\n===============================================================');
  console.log('🎉 ALL REQUIREMENTS AND TEST CASES PASSED WITH 100% SUCCESS!');
  console.log('===============================================================\n');
}

runAllTests().catch((err) => {
  console.error('\n❌ Verification Failed:', err.message);
  process.exit(1);
});
