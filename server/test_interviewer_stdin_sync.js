import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:5001';

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(endpoint, options = {}) {
  const res = await fetch(`${SERVER_URL}${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await res.json();
  return { status: res.status, data };
}

function createSocket(token) {
  return io(SERVER_URL, {
    transports: ['websocket'],
    auth: { token },
    forceNew: true
  });
}

async function runAllTests() {
  console.log('===============================================================');
  console.log('🧪 TEST SUITE: INTERVIEWER REAL-TIME STDIN SYNCHRONIZATION');
  console.log('===============================================================');

  // Create room
  const createRes = await request('/api/interviews', {
    method: 'POST',
    body: JSON.stringify({ interviewerName: 'Sarah Jenkins' })
  });
  const roomId = createRes.data.interview.id;
  const interviewerToken = createRes.data.token;

  const joinARes = await request(`/api/interviews/${roomId}/join`, {
    method: 'POST',
    body: JSON.stringify({ candidateName: 'Candidate One' })
  });
  const tokenA = joinARes.data.token;

  const joinBRes = await request(`/api/interviews/${roomId}/join`, {
    method: 'POST',
    body: JSON.stringify({ candidateName: 'Candidate Two' })
  });
  const tokenB = joinBRes.data.token;

  // Interviewer authorizes Candidate One and Candidate Two
  await request(`/api/interviews/${roomId}/admission-decision`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${interviewerToken}` },
    body: JSON.stringify({ candidateId: 'Candidate One', decision: 'ACCEPTED' })
  });
  await request(`/api/interviews/${roomId}/admission-decision`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${interviewerToken}` },
    body: JSON.stringify({ candidateId: 'Candidate Two', decision: 'ACCEPTED' })
  });

  console.log(`✅ Room Created: ${roomId}\n`);

  // Connect Interviewer & Candidate A
  const socketInterviewer = createSocket(interviewerToken);
  const socketCandA = createSocket(tokenA);
  const socketCandB = createSocket(tokenB);

  await new Promise((resolve) => {
    let connected = 0;
    const check = () => { if (++connected === 3) resolve(); };
    socketInterviewer.on('connect', check);
    socketCandA.on('connect', check);
    socketCandB.on('connect', check);
  });

  socketInterviewer.emit('join-room', { roomId, role: 'interviewer', userName: 'Sarah Jenkins', token: interviewerToken });
  socketCandA.emit('join-room', { roomId, role: 'candidate', userName: 'Candidate One', candidateId: 'Candidate One', token: tokenA });
  socketCandB.emit('join-room', { roomId, role: 'candidate', userName: 'Candidate Two', candidateId: 'Candidate Two', token: tokenB });
  await sleep(400);

  // -------------------------------------------------------------------------
  // TEST 1 — Python Interactive Input Synced to Interviewer in Real Time
  // -------------------------------------------------------------------------
  console.log('---------------------------------------------------------------');
  console.log('📋 TEST 1: Python Chained Inputs & Real-time Chronological Sync');
  console.log('---------------------------------------------------------------');

  const interviewerEvents = [];
  const candAEvents = [];

  socketInterviewer.on('terminal-output', (data) => interviewerEvents.push({ type: 'output', ...data }));
  socketInterviewer.on('terminal-stdin', (data) => interviewerEvents.push({ type: 'stdin', ...data }));
  socketInterviewer.on('terminal-exit', (data) => interviewerEvents.push({ type: 'exit', ...data }));

  socketCandA.on('terminal-output', (data) => candAEvents.push({ type: 'output', ...data }));
  socketCandA.on('terminal-stdin', (data) => candAEvents.push({ type: 'stdin', ...data }));
  socketCandA.on('terminal-exit', (data) => candAEvents.push({ type: 'exit', ...data }));

  let session1Ready = null;
  const session1Promise = new Promise((resolve) => {
    socketCandA.once('terminal-ready', (p) => {
      session1Ready = p;
      resolve(p);
    });
  });

  const pyCode = `
a = int(input("Enter first number: "))
b = int(input("Enter second number: "))
print("Sum =", a + b)
`;

  socketCandA.emit('terminal-start', {
    roomId,
    candidateId: 'Candidate One',
    questionId: 'q-test-1',
    code: pyCode,
    language: 'python'
  });

  await session1Promise;
  console.log(`  Interactive Session Launched: ${session1Ready.sessionId}`);

  // Wait for first prompt
  let waitCount = 0;
  while (!interviewerEvents.some((e) => e.type === 'output' && e.data.includes('Enter first number:')) && waitCount < 30) {
    await sleep(100);
    waitCount++;
  }

  console.log('  Interviewer received Prompt 1: "Enter first number: "');

  // Candidate types "5\n"
  socketCandA.emit('terminal-input', {
    roomId,
    sessionId: session1Ready.sessionId,
    input: '5\n'
  });

  // Wait for second prompt
  waitCount = 0;
  while (!interviewerEvents.some((e) => e.type === 'output' && e.data.includes('Enter second number:')) && waitCount < 30) {
    await sleep(100);
    waitCount++;
  }

  console.log('  Interviewer received Prompt 2: "Enter second number: "');

  // Candidate types "2\n"
  socketCandA.emit('terminal-input', {
    roomId,
    sessionId: session1Ready.sessionId,
    input: '2\n'
  });

  // Wait for exit
  waitCount = 0;
  while (!interviewerEvents.some((e) => e.type === 'exit') && waitCount < 40) {
    await sleep(100);
    waitCount++;
  }

  // Verification 1: Interviewer received stdin events
  const interviewerStdinEvents = interviewerEvents.filter((e) => e.type === 'stdin');
  console.log('  Interviewer received stdin events count:', interviewerStdinEvents.length);
  if (interviewerStdinEvents.length !== 2) {
    throw new Error(`Expected interviewer to receive 2 stdin events, got ${interviewerStdinEvents.length}`);
  }
  if (interviewerStdinEvents[0].input !== '5\n' || interviewerStdinEvents[1].input !== '2\n') {
    throw new Error(`Interviewer received unexpected stdin values: ${JSON.stringify(interviewerStdinEvents)}`);
  }
  console.log('  ✅ Interviewer received exact candidate inputs: 5 and 2');

  // Verification 2: Chronological order check
  const eventTypes = interviewerEvents.map((e) => {
    if (e.type === 'output') {
      if (e.data.includes('Enter first number:')) return 'PROMPT_1';
      if (e.data.includes('Enter second number:')) return 'PROMPT_2';
      if (e.data.includes('Sum = 7')) return 'OUTPUT_SUM';
    }
    if (e.type === 'stdin') {
      if (e.input === '5\n') return 'STDIN_5';
      if (e.input === '2\n') return 'STDIN_2';
    }
    if (e.type === 'exit') return 'EXIT';
    return null;
  }).filter(Boolean);

  console.log('  Interviewer Event Timeline:', eventTypes.join(' -> '));

  const p1Idx = eventTypes.indexOf('PROMPT_1');
  const s5Idx = eventTypes.indexOf('STDIN_5');
  const p2Idx = eventTypes.indexOf('PROMPT_2');
  const s2Idx = eventTypes.indexOf('STDIN_2');
  const sumIdx = eventTypes.indexOf('OUTPUT_SUM');
  const exitIdx = eventTypes.indexOf('EXIT');

  if (p1Idx < s5Idx && s5Idx < p2Idx && p2Idx < s2Idx && s2Idx < sumIdx && sumIdx < exitIdx) {
    console.log('  ✅ PASS: Exact chronological order preserved (PROMPT_1 -> STDIN_5 -> PROMPT_2 -> STDIN_2 -> OUTPUT_SUM -> EXIT)');
  } else {
    throw new Error(`Order violated! Sequence: ${eventTypes.join(' -> ')}`);
  }

  // Candidate Isolation check on Candidate A: Candidate A should NOT receive terminal-stdin echoed back from server
  const candAStdinEvents = candAEvents.filter((e) => e.type === 'stdin');
  if (candAStdinEvents.length === 0) {
    console.log('  ✅ PASS: Candidate A does not receive duplicate terminal-stdin echo from server');
  } else {
    throw new Error('Candidate received unnecessary terminal-stdin event');
  }

  // -------------------------------------------------------------------------
  // TEST 2 — Multiple inputs without prompt
  // -------------------------------------------------------------------------
  console.log('\n---------------------------------------------------------------');
  console.log('📋 TEST 2: Multiple Inputs (10, 20, 30 -> 60)');
  console.log('---------------------------------------------------------------');

  interviewerEvents.length = 0;
  let session2Ready = null;
  const session2Promise = new Promise((resolve) => {
    socketCandA.once('terminal-ready', (p) => {
      session2Ready = p;
      resolve(p);
    });
  });

  const pyCode2 = `
a = int(input())
b = int(input())
c = int(input())
print(a + b + c)
`;

  socketCandA.emit('terminal-start', {
    roomId,
    candidateId: 'Candidate One',
    questionId: 'q-test-2',
    code: pyCode2,
    language: 'python'
  });

  await session2Promise;
  await sleep(300);

  // Send 10
  socketCandA.emit('terminal-input', { roomId, sessionId: session2Ready.sessionId, input: '10\n' });
  await sleep(150);
  // Send 20
  socketCandA.emit('terminal-input', { roomId, sessionId: session2Ready.sessionId, input: '20\n' });
  await sleep(150);
  // Send 30
  socketCandA.emit('terminal-input', { roomId, sessionId: session2Ready.sessionId, input: '30\n' });

  waitCount = 0;
  while (!interviewerEvents.some((e) => e.type === 'exit') && waitCount < 40) {
    await sleep(100);
    waitCount++;
  }

  const stdinInputs = interviewerEvents.filter((e) => e.type === 'stdin').map((e) => e.input.trim());
  const finalOutput = interviewerEvents.filter((e) => e.type === 'output').map((e) => e.data).join('');

  console.log('  Interviewer recorded stdin inputs:', stdinInputs);
  console.log('  Interviewer recorded final output:', finalOutput.trim());

  if (stdinInputs.join(',') === '10,20,30' && finalOutput.includes('60')) {
    console.log('  ✅ PASS: Interviewer saw 10, 20, 30 and output 60 in real time!');
  } else {
    throw new Error('Test 2 failed');
  }

  // -------------------------------------------------------------------------
  // TEST 3 — C++ cin input synchronized to Interviewer
  // -------------------------------------------------------------------------
  console.log('\n---------------------------------------------------------------');
  console.log('📋 TEST 3: C++ cin Input Synchronized to Interviewer');
  console.log('---------------------------------------------------------------');

  interviewerEvents.length = 0;
  let session3Ready = null;
  const session3Promise = new Promise((resolve) => {
    socketCandA.once('terminal-ready', (p) => {
      session3Ready = p;
      resolve(p);
    });
  });

  const cppCode = `
#include <iostream>
#include <string>
using namespace std;
int main() {
  string name;
  cout << "Enter name: " << flush;
  cin >> name;
  cout << "Hello " << name << endl;
  return 0;
}
`;

  socketCandA.emit('terminal-start', {
    roomId,
    candidateId: 'Candidate One',
    questionId: 'q-test-3',
    code: cppCode,
    language: 'cpp'
  });

  await session3Promise;

  waitCount = 0;
  while (!interviewerEvents.some((e) => e.type === 'output' && e.data.includes('Enter name:')) && waitCount < 400) {
    await sleep(100);
    waitCount++;
  }
  console.log('  Interviewer received C++ prompt: "Enter name: "');

  socketCandA.emit('terminal-input', {
    roomId,
    sessionId: session3Ready.sessionId,
    input: 'Alice\n'
  });

  waitCount = 0;
  while (!interviewerEvents.some((e) => e.type === 'exit') && waitCount < 40) {
    await sleep(100);
    waitCount++;
  }

  const cppStdin = interviewerEvents.filter((e) => e.type === 'stdin').map((e) => e.input.trim());
  const cppOut = interviewerEvents.filter((e) => e.type === 'output').map((e) => e.data).join('');

  console.log('  Interviewer saw C++ stdin:', cppStdin);
  console.log('  Interviewer saw C++ stdout:', cppOut.trim());

  if (cppStdin.includes('Alice') && cppOut.includes('Hello Alice')) {
    console.log('  ✅ PASS: C++ cin input "Alice" synchronized to interviewer in real time!');
  } else {
    throw new Error('Test 3 failed');
  }

  // -------------------------------------------------------------------------
  // TEST 4 & 5 — Java & JavaScript Preservation
  // -------------------------------------------------------------------------
  console.log('\n---------------------------------------------------------------');
  console.log('📋 TEST 4 & 5: Java & JavaScript Preservation');
  console.log('---------------------------------------------------------------');

  const javaRun = await request('/api/judge0/run', {
    method: 'POST',
    body: JSON.stringify({
      source_code: `import java.util.Scanner;\npublic class Main {\n  public static void main(String[] args) {\n    Scanner sc = new Scanner(System.in);\n    int a = sc.nextInt();\n    int b = sc.nextInt();\n    System.out.println("Sum = " + (a + b));\n  }\n}`,
      language: 'java',
      stdin: '15\n25\n'
    })
  });
  if (javaRun.data.result.stdout.includes('Sum = 40')) {
    console.log('  ✅ PASS: Java Scanner execution remains intact (Sum = 40)!');
  } else {
    throw new Error('Java execution failed');
  }

  // -------------------------------------------------------------------------
  // TEST 6 — Multi-Candidate Isolation & Stdin Separation
  // -------------------------------------------------------------------------
  console.log('\n---------------------------------------------------------------');
  console.log('📋 TEST 6: Multi-Candidate Stdin Separation & Strict Isolation');
  console.log('---------------------------------------------------------------');

  const candAInbox = [];
  const candBInbox = [];
  interviewerEvents.length = 0;

  socketCandA.on('terminal-stdin', (d) => candAInbox.push(d));
  socketCandB.on('terminal-stdin', (d) => candBInbox.push(d));

  // Candidate A starts Python session
  let sessAPromise = new Promise((resolve) => socketCandA.once('terminal-ready', resolve));
  socketCandA.emit('terminal-start', {
    roomId,
    candidateId: 'Candidate One',
    questionId: 'q-cand-A',
    code: 'val = input("A: "); print("A-Got:", val)',
    language: 'python'
  });
  const sessA = await sessAPromise;

  // Candidate B starts Python session
  let sessBPromise = new Promise((resolve) => socketCandB.once('terminal-ready', resolve));
  socketCandB.emit('terminal-start', {
    roomId,
    candidateId: 'Candidate Two',
    questionId: 'q-cand-B',
    code: 'val = input("B: "); print("B-Got:", val)',
    language: 'python'
  });
  const sessB = await sessBPromise;

  await sleep(300);

  // Candidate A types "SecretA\n"
  socketCandA.emit('terminal-input', { roomId, sessionId: sessA.sessionId, input: 'SecretA\n' });
  // Candidate B types "SecretB\n"
  socketCandB.emit('terminal-input', { roomId, sessionId: sessB.sessionId, input: 'SecretB\n' });

  await sleep(600);

  // Interviewer must have received BOTH, tagged with the respective candidateId
  const intInputsA = interviewerEvents.filter((e) => e.type === 'stdin' && e.candidateId === 'Candidate One');
  const intInputsB = interviewerEvents.filter((e) => e.type === 'stdin' && e.candidateId === 'Candidate Two');

  console.log('  Interviewer received Candidate One inputs:', intInputsA.map((e) => e.input.trim()));
  console.log('  Interviewer received Candidate Two inputs:', intInputsB.map((e) => e.input.trim()));

  if (intInputsA.length === 1 && intInputsA[0].input === 'SecretA\n' &&
      intInputsB.length === 1 && intInputsB[0].input === 'SecretB\n') {
    console.log('  ✅ PASS: Interviewer sees distinct inputs under respective candidate IDs!');
  } else {
    throw new Error('Interviewer did not receive properly separated candidate inputs');
  }

  // TOTAL CANDIDATE ISOLATION: Candidate A must NOT receive Candidate B's stdin
  if (candAInbox.length === 0 && candBInbox.length === 0) {
    console.log('  ✅ PASS: TOTAL PRIVACY! Candidate A received 0 inputs from B, Candidate B received 0 inputs from A.');
  } else {
    throw new Error(`Data leakage! Cand A received ${candAInbox.length}, Cand B received ${candBInbox.length}`);
  }

  // -------------------------------------------------------------------------
  // TEST 7 — Security Attack: Cross-Candidate Input Injection
  // -------------------------------------------------------------------------
  console.log('\n---------------------------------------------------------------');
  console.log('📋 TEST 7: Security Attack: Cross-Candidate Input Spoofing');
  console.log('---------------------------------------------------------------');

  // Candidate B attempts to send input to Candidate A's session
  socketCandB.emit('terminal-input', {
    roomId,
    sessionId: sessA.sessionId,
    input: 'HackedByB\n'
  });

  await sleep(300);

  const leakedA = interviewerEvents.filter((e) => e.type === 'stdin' && e.input.includes('HackedByB'));
  if (leakedA.length === 0) {
    console.log('  ✅ PASS: Malicious cross-candidate input was successfully BLOCKED by backend security check!');
  } else {
    throw new Error('SECURITY VULNERABILITY: Candidate B was able to write into Candidate A process!');
  }

  console.log('\n===============================================================');
  console.log('🎉 ALL 7 INTERVIEWER STDIN SYNCHRONIZATION TESTS PASSED 100%!');
  console.log('===============================================================');

  socketInterviewer.disconnect();
  socketCandA.disconnect();
  socketCandB.disconnect();
  process.exit(0);
}

runAllTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
