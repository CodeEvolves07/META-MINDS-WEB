import axios from 'axios';

const BACKEND_URL = 'http://localhost:5001/api';

async function runTests() {
  console.log('====================================================');
  console.log('TESTING RUNTIME STDIN & QUESTION EXAMPLE SEPARATION');
  console.log('====================================================\n');

  let allPassed = true;

  // TEST 1: Candidate writes two-number prompt code, leaves stdin EMPTY
  // Must NOT send "3 5 1 9 2" from question sample input!
  // Request must have stdin: ""
  // When stdin is empty, Python reading input() should encounter EOFError, NOT ValueError with "3 5 1 9 2"
  console.log('--- TEST 1: Empty STDIN (Exact bug from user screenshot) ---');
  try {
    const code = `a = int(input("enter first number ="))\nb = int(input("Enter second number"))\nc = a + b\nprint("a+b=", c)`;
    const payload = {
      source_code: code,
      language: 'python',
      stdin: '' // Empty stdin
    };

    console.log('Sending payload to /api/judge0/run:', JSON.stringify(payload));
    const res = await axios.post(`${BACKEND_URL}/judge0/run`, payload);
    const result = res.data.result;
    console.log('Result received:', {
      success: result.success,
      stdout: result.stdout,
      stderr: result.stderr
    });

    // Check that "3 5 1 9 2" was NOT used
    const containsSampleInput = (result.stderr || '').includes('3 5 1 9 2') || (result.stdout || '').includes('3 5 1 9 2');
    const hasEofError = (result.stderr || '').includes('EOFError') || (result.stderr || '').includes('EOF when reading a line');

    if (!containsSampleInput && hasEofError) {
      console.log('✅ TEST 1 PASSED: Empty STDIN correctly sent as "" to runner. Genuine EOFError received, zero sample input leakage.\n');
    } else {
      console.error('❌ TEST 1 FAILED: Stdin was not handled as empty or sample input leaked!', result);
      allPassed = false;
    }
  } catch (err) {
    console.error('❌ TEST 1 ERROR:', err.message);
    allPassed = false;
  }

  // TEST 2: Candidate enters own input: "3\n5"
  console.log('--- TEST 2: Candidate Enters Own Input ("3\\n5") ---');
  try {
    const code = `a = int(input())\nb = int(input())\nprint(a + b)`;
    const payload = {
      source_code: code,
      language: 'python',
      stdin: "3\n5"
    };

    console.log('Sending payload to /api/judge0/run:', JSON.stringify(payload));
    const res = await axios.post(`${BACKEND_URL}/judge0/run`, payload);
    const result = res.data.result;
    console.log('Result received:', {
      success: result.success,
      stdout: result.stdout,
      stderr: result.stderr
    });

    if (result.success && result.stdout.trim() === '8') {
      console.log('✅ TEST 2 PASSED: Output is exactly "8". Question sample input had zero effect.\n');
    } else {
      console.error('❌ TEST 2 FAILED: Expected stdout "8", got:', result);
      allPassed = false;
    }
  } catch (err) {
    console.error('❌ TEST 2 ERROR:', err.message);
    allPassed = false;
  }

  // TEST 3: Candidate enters different input: "10\n20"
  console.log('--- TEST 3: Candidate Enters "10\\n20" (Output must be 30, never prefixed by 9) ---');
  try {
    const code = `a = int(input())\nb = int(input())\nprint(a + b)`;
    const payload = {
      source_code: code,
      language: 'python',
      stdin: "10\n20"
    };

    console.log('Sending payload to /api/judge0/run:', JSON.stringify(payload));
    const res = await axios.post(`${BACKEND_URL}/judge0/run`, payload);
    const result = res.data.result;
    console.log('Result received:', {
      success: result.success,
      stdout: result.stdout,
      stderr: result.stderr
    });

    if (result.success && result.stdout.trim() === '30' && !result.stdout.includes('9')) {
      console.log('✅ TEST 3 PASSED: Output is exactly "30". Sample output "9" was NOT included.\n');
    } else {
      console.error('❌ TEST 3 FAILED: Expected stdout "30" without "9", got:', result);
      allPassed = false;
    }
  } catch (err) {
    console.error('❌ TEST 3 ERROR:', err.message);
    allPassed = false;
  }

  // TEST 4: Array Question where Candidate manually enters: "3 5 1 9 2"
  console.log('--- TEST 4: Candidate Manually Enters Array Input "3 5 1 9 2" ---');
  try {
    const code = `nums = list(map(int, input().split()))\nprint(max(nums))`;
    const payload = {
      source_code: code,
      language: 'python',
      stdin: '3 5 1 9 2'
    };

    console.log('Sending payload to /api/judge0/run:', JSON.stringify(payload));
    const res = await axios.post(`${BACKEND_URL}/judge0/run`, payload);
    const result = res.data.result;
    console.log('Result received:', {
      success: result.success,
      stdout: result.stdout,
      stderr: result.stderr
    });

    if (result.success && result.stdout.trim() === '9') {
      console.log('✅ TEST 4 PASSED: Candidate manually entered input works as expected.\n');
    } else {
      console.error('❌ TEST 4 FAILED: Expected stdout "9", got:', result);
      allPassed = false;
    }
  } catch (err) {
    console.error('❌ TEST 4 ERROR:', err.message);
    allPassed = false;
  }

  // TEST 5: Candidate Isolation (Candidate 1 vs Candidate 2)
  console.log('--- TEST 5: Candidate Isolation Verification ---');
  try {
    // Cand 1 enters "100\n200", Cand 2 enters "5\n7"
    const [res1, res2] = await Promise.all([
      axios.post(`${BACKEND_URL}/judge0/run`, {
        source_code: `print(sum(map(int, input().split())))`,
        language: 'python',
        stdin: '100 200'
      }),
      axios.post(`${BACKEND_URL}/judge0/run`, {
        source_code: `print(sum(map(int, input().split())))`,
        language: 'python',
        stdin: '5 7'
      })
    ]);

    const stdout1 = res1.data.result.stdout.trim();
    const stdout2 = res2.data.result.stdout.trim();

    if (stdout1 === '300' && stdout2 === '12') {
      console.log('✅ TEST 5 PASSED: Candidate 1 got 300, Candidate 2 got 12. Full isolation.\n');
    } else {
      console.error('❌ TEST 5 FAILED: Isolation failed, got:', { stdout1, stdout2 });
      allPassed = false;
    }
  } catch (err) {
    console.error('❌ TEST 5 ERROR:', err.message);
    allPassed = false;
  }

  console.log('====================================================');
  if (allPassed) {
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
  } else {
    console.log('💥 SOME TESTS FAILED.');
  }
  console.log('====================================================');
}

runTests();
