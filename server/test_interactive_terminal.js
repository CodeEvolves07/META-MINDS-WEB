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

function createSocket(token) {
  return io(API_BASE, {
    auth: { token },
    transports: ['websocket'],
    forceNew: true
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runInteractiveTerminalTests() {
  console.log('===============================================================');
  console.log('🧪 TEST SUITE: REAL-TIME INTERACTIVE TERMINAL RUNTIME INPUT');
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

  // Setup: Create room and join candidates
  console.log('Setup: Creating interview room and connecting participants...');
  const createRes = await request('/api/interviews', {
    method: 'POST',
    body: JSON.stringify({ interviewerName: 'Tech Lead' })
  });
  const roomId = createRes.data.interview.id;
  const interviewerToken = createRes.data.token;

  const joinARes = await request(`/api/interviews/${roomId}/join`, {
    method: 'POST',
    body: JSON.stringify({ candidateName: 'Candidate A' })
  });
  const tokenA = joinARes.data.token;

  const joinBRes = await request(`/api/interviews/${roomId}/join`, {
    method: 'POST',
    body: JSON.stringify({ candidateName: 'Candidate B' })
  });
  const tokenB = joinBRes.data.token;

  const socketA = createSocket(tokenA);
  const socketB = createSocket(tokenB);
  const socketInterviewer = createSocket(interviewerToken);

  await Promise.all([
    new Promise((resolve) => {
      socketA.on('connect', () => {
        socketA.emit('join-room', { roomId, role: 'candidate', userName: 'Candidate A', token: tokenA });
        resolve();
      });
    }),
    new Promise((resolve) => {
      socketB.on('connect', () => {
        socketB.emit('join-room', { roomId, role: 'candidate', userName: 'Candidate B', token: tokenB });
        resolve();
      });
    }),
    new Promise((resolve) => {
      socketInterviewer.on('connect', () => {
        socketInterviewer.emit('join-room', { roomId, role: 'interviewer', userName: 'Tech Lead', token: interviewerToken });
        resolve();
      });
    })
  ]);

  await sleep(400);
  console.log('  Participants connected.\n');

  // ===============================================================
  // TEST 1 — Python interactive input (Square calculator)
  // num = int(input("Enter a number: "))
  // print("Square =", num * num)
  // User types: 5 -> Expected: Square = 25. No EOFError.
  // ===============================================================
  console.log('---------------------------------------------------------------');
  console.log('TEST 1: Python interactive input (Square calculator)');
  console.log('---------------------------------------------------------------');
  {
    let terminalOutput = '';
    let sessionId = null;
    let processExited = false;

    const onOutput = (data) => {
      if (data.candidateId === 'Candidate A') terminalOutput += data.data;
    };
    const onExit = (data) => {
      if (data.candidateId === 'Candidate A') processExited = true;
    };

    socketA.on('terminal-output', onOutput);
    socketA.on('terminal-exit', onExit);
    socketA.on('terminal-ready', (d) => { sessionId = d.sessionId; });

    const pySquareCode = `num = int(input("Enter a number: "))\nprint("Square =", num * num)\n`;

    socketA.emit('terminal-start', {
      roomId,
      questionId: 'test-q1',
      code: pySquareCode,
      language: 'python',
      candidateId: 'Candidate A'
    });

    // Wait for the prompt to appear in stdout
    for (let i = 0; i < 20; i++) {
      if (terminalOutput.includes('Enter a number:')) break;
      await sleep(100);
    }

    assert(terminalOutput.includes('Enter a number:'), 'Terminal received prompt "Enter a number:" while program waits');
    assert(!terminalOutput.includes('EOFError'), 'Zero EOFError while waiting for input');
    assert(!processExited, 'Process remained alive and waiting for input');

    // Candidate types 5 and presses Enter
    socketA.emit('terminal-input', {
      roomId,
      sessionId,
      input: '5\n'
    });

    // Wait for process to output answer and finish
    for (let i = 0; i < 20; i++) {
      if (terminalOutput.includes('Square = 25')) break;
      await sleep(100);
    }

    assert(terminalOutput.includes('Square = 25'), 'Process received "5\\n" through stdin and computed "Square = 25"');
    assert(!terminalOutput.includes('EOFError'), 'Finished execution without any EOFError');

    socketA.off('terminal-output', onOutput);
    socketA.off('terminal-exit', onExit);
  }

  // ===============================================================
  // TEST 2 — Multiple inputs
  // a = int(input("Enter first number: "))
  // b = int(input("Enter second number: "))
  // print("Sum =", a + b)
  // Expected: 9 then 5 -> Sum = 14
  // ===============================================================
  console.log('\n---------------------------------------------------------------');
  console.log('TEST 2: Multiple inputs in sequence');
  console.log('---------------------------------------------------------------');
  {
    let terminalOutput = '';
    let sessionId = null;
    let processExited = false;

    const onOutput = (data) => {
      if (data.candidateId === 'Candidate A') terminalOutput += data.data;
    };
    const onExit = (data) => {
      if (data.candidateId === 'Candidate A') processExited = true;
    };

    socketA.on('terminal-output', onOutput);
    socketA.on('terminal-exit', onExit);
    socketA.on('terminal-ready', (d) => { sessionId = d.sessionId; });

    const pyMultiInputCode = `a = int(input("Enter first number: "))\nb = int(input("Enter second number: "))\nprint("Sum =", a + b)\n`;

    socketA.emit('terminal-start', {
      roomId,
      questionId: 'test-q2',
      code: pyMultiInputCode,
      language: 'python',
      candidateId: 'Candidate A'
    });

    // Wait for first prompt
    for (let i = 0; i < 20; i++) {
      if (terminalOutput.includes('Enter first number:')) break;
      await sleep(100);
    }
    assert(terminalOutput.includes('Enter first number:'), 'Prompt 1 "Enter first number:" displayed in real time');

    // Send first input: 9
    socketA.emit('terminal-input', {
      roomId,
      sessionId,
      input: '9\n'
    });

    // Wait for second prompt
    for (let i = 0; i < 20; i++) {
      if (terminalOutput.includes('Enter second number:')) break;
      await sleep(100);
    }
    assert(terminalOutput.includes('Enter second number:'), 'Prompt 2 "Enter second number:" displayed after first input');

    // Send second input: 5
    socketA.emit('terminal-input', {
      roomId,
      sessionId,
      input: '5\n'
    });

    // Wait for sum
    for (let i = 0; i < 20; i++) {
      if (terminalOutput.includes('Sum = 14')) break;
      await sleep(100);
    }
    assert(terminalOutput.includes('Sum = 14'), 'Final result "Sum = 14" calculated correctly');

    socketA.off('terminal-output', onOutput);
    socketA.off('terminal-exit', onExit);
  }

  // ===============================================================
  // TEST 3 — String input
  // name = input("Enter your name: ")
  // print("Hello", name)
  // ===============================================================
  console.log('\n---------------------------------------------------------------');
  console.log('TEST 3: String input');
  console.log('---------------------------------------------------------------');
  {
    let terminalOutput = '';
    let sessionId = null;

    const onOutput = (data) => {
      if (data.candidateId === 'Candidate A') terminalOutput += data.data;
    };

    socketA.on('terminal-output', onOutput);
    socketA.on('terminal-ready', (d) => { sessionId = d.sessionId; });

    const pyStringCode = `name = input("Enter your name: ")\nprint("Hello", name)\n`;

    socketA.emit('terminal-start', {
      roomId,
      questionId: 'test-q3',
      code: pyStringCode,
      language: 'python',
      candidateId: 'Candidate A'
    });

    for (let i = 0; i < 20; i++) {
      if (terminalOutput.includes('Enter your name:')) break;
      await sleep(100);
    }
    assert(terminalOutput.includes('Enter your name:'), 'String prompt received in real time');

    socketA.emit('terminal-input', {
      roomId,
      sessionId,
      input: 'Shatabdi\n'
    });

    for (let i = 0; i < 20; i++) {
      if (terminalOutput.includes('Hello Shatabdi')) break;
      await sleep(100);
    }
    assert(terminalOutput.includes('Hello Shatabdi'), 'Program processed string input and printed "Hello Shatabdi"');

    socketA.off('terminal-output', onOutput);
  }

  // ===============================================================
  // TEST 4 — Existing non-interactive code (no input())
  // ===============================================================
  console.log('\n---------------------------------------------------------------');
  console.log('TEST 4: Non-interactive code (runs to completion without input)');
  console.log('---------------------------------------------------------------');
  {
    let terminalOutput = '';
    let exitCode = null;

    const onOutput = (data) => {
      if (data.candidateId === 'Candidate A') terminalOutput += data.data;
    };
    const onExit = (data) => {
      if (data.candidateId === 'Candidate A') exitCode = data.exitCode;
    };

    socketA.on('terminal-output', onOutput);
    socketA.on('terminal-exit', onExit);

    const nonInteractiveCode = `print("Non-interactive run")\nfor i in range(3):\n    print("Count:", i)\n`;

    socketA.emit('terminal-start', {
      roomId,
      questionId: 'test-q4',
      code: nonInteractiveCode,
      language: 'python',
      candidateId: 'Candidate A'
    });

    for (let i = 0; i < 20; i++) {
      if (exitCode !== null) break;
      await sleep(100);
    }

    assert(terminalOutput.includes('Non-interactive run') && terminalOutput.includes('Count: 2'), 'Non-interactive code produces complete output');
    assert(exitCode === 0, 'Non-interactive code exits with code 0 automatically');

    socketA.off('terminal-output', onOutput);
    socketA.off('terminal-exit', onExit);
  }

  // ===============================================================
  // TEST 5 — Compilation / Syntax Error
  // ===============================================================
  console.log('\n---------------------------------------------------------------');
  console.log('TEST 5: Syntax / Compilation error handling');
  console.log('---------------------------------------------------------------');
  {
    let terminalOutput = '';
    let exitCode = null;

    const onOutput = (data) => {
      if (data.candidateId === 'Candidate A') terminalOutput += data.data;
    };
    const onExit = (data) => {
      if (data.candidateId === 'Candidate A') exitCode = data.exitCode;
    };

    socketA.on('terminal-output', onOutput);
    socketA.on('terminal-exit', onExit);

    const syntaxErrorCode = `def broken_func(\n    print "missing parens"\n`;

    socketA.emit('terminal-start', {
      roomId,
      questionId: 'test-q5',
      code: syntaxErrorCode,
      language: 'python',
      candidateId: 'Candidate A'
    });

    for (let i = 0; i < 20; i++) {
      if (exitCode !== null) break;
      await sleep(100);
    }

    assert(terminalOutput.includes('SyntaxError') || terminalOutput.includes('invalid syntax'), 'SyntaxError reported accurately in terminal');
    assert(exitCode !== 0, 'Exited with non-zero exit code on SyntaxError');

    socketA.off('terminal-output', onOutput);
    socketA.off('terminal-exit', onExit);
  }

  // ===============================================================
  // TEST 6 — Runtime Error (e.g., ZeroDivisionError or NameError)
  // ===============================================================
  console.log('\n---------------------------------------------------------------');
  console.log('TEST 6: Genuine Runtime Error reporting');
  console.log('---------------------------------------------------------------');
  {
    let terminalOutput = '';
    let exitCode = null;

    const onOutput = (data) => {
      if (data.candidateId === 'Candidate A') terminalOutput += data.data;
    };
    const onExit = (data) => {
      if (data.candidateId === 'Candidate A') exitCode = data.exitCode;
    };

    socketA.on('terminal-output', onOutput);
    socketA.on('terminal-exit', onExit);

    const runtimeErrorCode = `a = 10\nb = 0\nprint(a / b)\n`;

    socketA.emit('terminal-start', {
      roomId,
      questionId: 'test-q6',
      code: runtimeErrorCode,
      language: 'python',
      candidateId: 'Candidate A'
    });

    for (let i = 0; i < 20; i++) {
      if (exitCode !== null) break;
      await sleep(100);
    }

    assert(terminalOutput.includes('ZeroDivisionError'), 'ZeroDivisionError accurately reported in terminal');
    assert(exitCode !== 0, 'Exited with non-zero exit code on Runtime Error');

    socketA.off('terminal-output', onOutput);
    socketA.off('terminal-exit', onExit);
  }

  // ===============================================================
  // TEST 7 — Two Candidates Isolation
  // Candidate A starts interactive execution.
  // Candidate B starts interactive execution.
  // - A cannot send input to B's process.
  // - B cannot send input to A's process.
  // - A cannot see B's terminal output.
  // - B cannot see A's terminal output.
  // ===============================================================
  console.log('\n---------------------------------------------------------------');
  console.log('TEST 7: Two candidates execution isolation');
  console.log('---------------------------------------------------------------');
  {
    let candAOutputs = '';
    let candBOutputs = '';
    let sessionAId = null;
    let sessionBId = null;

    socketA.on('terminal-ready', (d) => { sessionAId = d.sessionId; });
    socketB.on('terminal-ready', (d) => { sessionBId = d.sessionId; });

    socketA.on('terminal-output', (d) => { candAOutputs += d.data; });
    socketB.on('terminal-output', (d) => { candBOutputs += d.data; });

    // Candidate A runs code asking for A's secret
    socketA.emit('terminal-start', {
      roomId,
      questionId: 'cand-a-prob',
      code: `x = input("CandA Prompt: ")\nprint("CandA Result:", x)\n`,
      language: 'python',
      candidateId: 'Candidate A'
    });

    // Candidate B runs code asking for B's secret
    socketB.emit('terminal-start', {
      roomId,
      questionId: 'cand-b-prob',
      code: `y = input("CandB Prompt: ")\nprint("CandB Result:", y)\n`,
      language: 'python',
      candidateId: 'Candidate B'
    });

    for (let i = 0; i < 20; i++) {
      if (candAOutputs.includes('CandA Prompt:') && candBOutputs.includes('CandB Prompt:')) break;
      await sleep(100);
    }

    assert(candAOutputs.includes('CandA Prompt:'), 'Candidate A received prompt for A');
    assert(candBOutputs.includes('CandB Prompt:'), 'Candidate B received prompt for B');
    assert(!candAOutputs.includes('CandB Prompt:'), 'Candidate A DID NOT receive Candidate B prompt (Output Isolated)');
    assert(!candBOutputs.includes('CandA Prompt:'), 'Candidate B DID NOT receive Candidate A prompt (Output Isolated)');

    // Attempt tampering: Candidate A attempts to send input to Candidate B's process!
    socketA.emit('terminal-input', {
      roomId,
      sessionId: sessionBId,
      input: 'HACKED_BY_A\n'
    });
    await sleep(200);

    // Verify Candidate B's process was NOT affected by Candidate A's input attempt
    assert(!candBOutputs.includes('HACKED_BY_A'), 'Candidate A CANNOT send input to Candidate B process (Cross-input blocked)');

    // Legitimate candidate inputs
    socketA.emit('terminal-input', { roomId, sessionId: sessionAId, input: 'SecretA\n' });
    socketB.emit('terminal-input', { roomId, sessionId: sessionBId, input: 'SecretB\n' });

    for (let i = 0; i < 20; i++) {
      if (candAOutputs.includes('CandA Result: SecretA') && candBOutputs.includes('CandB Result: SecretB')) break;
      await sleep(100);
    }

    assert(candAOutputs.includes('CandA Result: SecretA'), 'Candidate A received own result');
    assert(candBOutputs.includes('CandB Result: SecretB'), 'Candidate B received own result');
    assert(!candAOutputs.includes('SecretB'), 'Candidate A never received Candidate B secret');
    assert(!candBOutputs.includes('SecretA'), 'Candidate B never received Candidate A secret');
  }

  // ===============================================================
  // TEST 8 — Question sample input separation
  // Verify that question sampleInput is NOT automatically injected into runtime stdin.
  // ===============================================================
  console.log('\n---------------------------------------------------------------');
  console.log('TEST 8: Question sample input separation');
  console.log('---------------------------------------------------------------');
  {
    // Question "Find Largest Element" has sampleInput "3 5 1 9 2"
    let terminalOutput = '';
    let sessionId = null;

    const onOutput = (data) => {
      if (data.candidateId === 'Candidate A') terminalOutput += data.data;
    };
    socketA.on('terminal-output', onOutput);
    socketA.on('terminal-ready', (d) => { sessionId = d.sessionId; });

    const pySeparationCode = `val = input("Input Request: ")\nprint("Got val:", val)\n`;

    socketA.emit('terminal-start', {
      roomId,
      questionId: 'find-largest-element',
      code: pySeparationCode,
      language: 'python',
      candidateId: 'Candidate A'
    });

    for (let i = 0; i < 20; i++) {
      if (terminalOutput.includes('Input Request:')) break;
      await sleep(100);
    }

    assert(terminalOutput.includes('Input Request:'), 'Process is waiting for user input');
    assert(!terminalOutput.includes('3 5 1 9 2'), 'Question sampleInput "3 5 1 9 2" was NOT automatically fed into process');

    // Candidate types their own custom input
    socketA.emit('terminal-input', {
      roomId,
      sessionId,
      input: 'my_custom_input_42\n'
    });

    for (let i = 0; i < 20; i++) {
      if (terminalOutput.includes('Got val: my_custom_input_42')) break;
      await sleep(100);
    }

    assert(terminalOutput.includes('Got val: my_custom_input_42'), 'Candidate manual input used cleanly, completely separate from question samples');
  }

  // Clean up sockets
  socketA.disconnect();
  socketB.disconnect();
  socketInterviewer.disconnect();

  console.log('\n===============================================================');
  console.log(`RESULTS: ${passed}/${total} TESTS PASSED (${((passed / total) * 100).toFixed(0)}%)`);
  console.log('===============================================================');

  if (passed === total) {
    console.log('✅ ALL 8 INTERACTIVE TERMINAL TESTS PASSED WITH 100% SUCCESS!\n');
    process.exit(0);
  } else {
    console.error('❌ SOME TESTS FAILED.\n');
    process.exit(1);
  }
}

runInteractiveTerminalTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
