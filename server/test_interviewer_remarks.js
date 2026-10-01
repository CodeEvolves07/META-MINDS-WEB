import axios from 'axios';
import io from 'socket.io-client';

const SERVER_URL = 'http://localhost:5001';

function createSocket(opts = {}) {
  return io(SERVER_URL, {
    transports: ['websocket'],
    forceNew: true,
    ...opts
  });
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runRemarksTests() {
  console.log('================================================================');
  console.log('🧪 TEST SUITE: INTERVIEWER PER-CANDIDATE REMARKS & PRIVACY');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] (${passed + 1}) ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // SETUP: Create Interview Room with Interviewer and 3 Candidates
    // -------------------------------------------------------------
    console.log('--- SETUP: Creating interview room with 3 candidates ---');
    const createRes = await axios.post(`${SERVER_URL}/api/interviews`, {
      interviewerName: 'Lead Interviewer'
    });
    const roomId = createRes.data.interview.id;
    const interviewerToken = createRes.data.token;

    // Join Candidate A, B, C
    const [joinA, joinB, joinC] = await Promise.all([
      axios.post(`${SERVER_URL}/api/interviews/${roomId}/join`, { candidateName: 'Candidate A' }),
      axios.post(`${SERVER_URL}/api/interviews/${roomId}/join`, { candidateName: 'Candidate B' }),
      axios.post(`${SERVER_URL}/api/interviews/${roomId}/join`, { candidateName: 'Candidate C' })
    ]);

    const tokenA = joinA.data.token;
    const tokenB = joinB.data.token;
    const tokenC = joinC.data.token;

    // Interviewer admits Candidate A, B, C
    await Promise.all([
      axios.post(`${SERVER_URL}/api/interviews/${roomId}/admission-decision`, { candidateId: 'Candidate A', decision: 'ACCEPT' }, { headers: { Authorization: `Bearer ${interviewerToken}` } }),
      axios.post(`${SERVER_URL}/api/interviews/${roomId}/admission-decision`, { candidateId: 'Candidate B', decision: 'ACCEPT' }, { headers: { Authorization: `Bearer ${interviewerToken}` } }),
      axios.post(`${SERVER_URL}/api/interviews/${roomId}/admission-decision`, { candidateId: 'Candidate C', decision: 'ACCEPT' }, { headers: { Authorization: `Bearer ${interviewerToken}` } })
    ]);

    // -------------------------------------------------------------
    // TEST 1: Interviewer writes remarks for Candidate A.
    // Verify Candidate A cannot see them.
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Interviewer writes remarks for Candidate A; Candidate A cannot see them ---');
    const remarksA = {
      candidateId: 'Candidate A',
      communicationRating: 4,
      problemSolvingRating: 5,
      technicalRating: 4,
      overallScore: 8,
      comments: 'Good problem-solving approach. Needs improvement in optimization.'
    };

    const saveResA = await axios.post(`${SERVER_URL}/api/interviews/${roomId}/notes`, remarksA, {
      headers: { Authorization: `Bearer ${interviewerToken}` }
    });
    assert(saveResA.status === 200 && saveResA.data.success === true, 'Remarks for Candidate A saved successfully');

    // Candidate A fetches session data
    const candASession = await axios.post(`${SERVER_URL}/api/interviews/${roomId}/session`, {
      candidateId: 'Candidate A'
    }, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });

    assert(candASession.data.interview.privateNotes === undefined, 'Candidate A session response contains NO privateNotes');
    assert(candASession.data.interview.candidateNotes === undefined, 'Candidate A session response contains NO candidateNotes');

    // Candidate A fetches report data
    const candAReport = await axios.post(`${SERVER_URL}/api/interviews/${roomId}/report`, {
      candidateId: 'Candidate A'
    }, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    assert(candAReport.data.report.privateNotes === undefined, 'Candidate A report response contains NO privateNotes');
    assert(candAReport.data.report.candidateNotes === undefined, 'Candidate A report response contains NO candidateNotes');

    // -------------------------------------------------------------
    // TEST 2: Select Candidate B.
    // Verify Candidate B's remarks area is separate and does NOT show Candidate A's remarks.
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Candidate B remarks area is separate and does not show Candidate A remarks ---');
    const interviewerCandNotes = await axios.post(`${SERVER_URL}/api/interviews/${roomId}/candidate-notes`, {}, {
      headers: { Authorization: `Bearer ${interviewerToken}` }
    });

    assert(
      interviewerCandNotes.data.candidateNotes['Candidate A']?.comments === remarksA.comments,
      'Candidate A remarks correctly stored in candidateNotes'
    );
    assert(
      interviewerCandNotes.data.candidateNotes['Candidate B'] === undefined ||
      interviewerCandNotes.data.candidateNotes['Candidate B']?.comments !== remarksA.comments,
      'Candidate B remarks are completely separate and do NOT show Candidate A remarks'
    );

    // -------------------------------------------------------------
    // TEST 3: Write different remarks for A and B. Refresh interviewer page.
    // Verify both remain correctly associated with respective candidates.
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Write different remarks for A and B; verify persistence across refresh ---');
    const remarksB = {
      candidateId: 'Candidate B',
      communicationRating: 5,
      problemSolvingRating: 4,
      technicalRating: 5,
      overallScore: 9,
      comments: 'Strong communication and good debugging.'
    };

    await axios.post(`${SERVER_URL}/api/interviews/${roomId}/notes`, remarksB, {
      headers: { Authorization: `Bearer ${interviewerToken}` }
    });

    // Simulate page refresh / reopen interview: interviewer fetches session
    const refreshSession = await axios.post(`${SERVER_URL}/api/interviews/${roomId}/session`, {}, {
      headers: { Authorization: `Bearer ${interviewerToken}` }
    });

    const storedMap = refreshSession.data.interview.candidateNotes;
    assert(
      storedMap['Candidate A']?.comments === 'Good problem-solving approach. Needs improvement in optimization.',
      'Candidate A remarks persist across refresh: "Good problem-solving approach. Needs improvement in optimization."'
    );
    assert(
      storedMap['Candidate B']?.comments === 'Strong communication and good debugging.',
      'Candidate B remarks persist across refresh: "Strong communication and good debugging."'
    );
    assert(
      storedMap['Candidate A']?.overallScore === 8 && storedMap['Candidate B']?.overallScore === 9,
      'Ratings and scores for Candidate A and B persist independently'
    );

    // -------------------------------------------------------------
    // TEST 4: Candidate attempts to directly request Candidate A evaluation/remarks.
    // Verify backend denies access.
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Candidate attempts to directly request evaluation/remarks ---');
    try {
      await axios.post(`${SERVER_URL}/api/interviews/${roomId}/candidate-notes`, {
        candidateId: 'Candidate A'
      }, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      assert(false, 'Candidate should not be allowed to access candidate-notes endpoint');
    } catch (err) {
      assert(err.response?.status === 403, 'Candidate access to candidate-notes denied with HTTP 403');
    }

    try {
      await axios.post(`${SERVER_URL}/api/interviews/${roomId}/notes`, {
        candidateId: 'Candidate A',
        comments: 'Hacked remarks'
      }, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      assert(false, 'Candidate should not be allowed to modify notes endpoint');
    } catch (err) {
      assert(err.response?.status === 403, 'Candidate attempt to modify notes denied with HTTP 403');
    }

    // -------------------------------------------------------------
    // TEST 5: Candidate attempts to change candidateId to another candidate.
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Candidate attempts ID tampering to Candidate B ---');
    try {
      await axios.post(`${SERVER_URL}/api/interviews/${roomId}/session`, {
        candidateId: 'Candidate B'
      }, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      assert(false, 'Candidate A should be denied requesting Candidate B session');
    } catch (err) {
      assert(err.response?.status === 403, 'Candidate A requesting Candidate B denied with HTTP 403');
    }

    // -------------------------------------------------------------
    // TEST 6: Candidate attempts to change role to interviewer in headers/body.
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Candidate attempts role spoofing to interviewer ---');
    try {
      await axios.post(`${SERVER_URL}/api/interviews/${roomId}/candidate-notes`, {
        role: 'interviewer'
      }, {
        headers: {
          Authorization: `Bearer ${tokenA}`,
          'x-user-role': 'interviewer'
        }
      });
      assert(false, 'Role spoofing should be rejected');
    } catch (err) {
      assert(err.response?.status === 403, 'Role spoofing rejected with HTTP 403 based on trusted token');
    }

    // -------------------------------------------------------------
    // TEST 7: Candidate attempts to change interviewId/roomId.
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Candidate attempts to access notes in another room ---');
    const otherRoomRes = await axios.post(`${SERVER_URL}/api/interviews`, {
      interviewerName: 'Other Interviewer'
    });
    const otherRoomId = otherRoomRes.data.interview.id;

    try {
      await axios.post(`${SERVER_URL}/api/interviews/${otherRoomId}/candidate-notes`, {}, {
        headers: { Authorization: `Bearer ${tokenA}` }
      });
      assert(false, 'Cross-room notes access should be forbidden');
    } catch (err) {
      assert(err.response?.status === 403, 'Cross-room access forbidden with HTTP 403');
    }

    // -------------------------------------------------------------
    // TEST 8: Interviewer evaluates multiple candidates (A, B, C) in same room.
    // Verify each candidate has independent remarks.
    // -------------------------------------------------------------
    console.log('\n--- TEST 8: Evaluate 3 candidates; all remain completely independent ---');
    const remarksC = {
      candidateId: 'Candidate C',
      communicationRating: 3,
      problemSolvingRating: 4,
      technicalRating: 3,
      overallScore: 6,
      comments: 'Could improve explanation of the solution.'
    };

    await axios.post(`${SERVER_URL}/api/interviews/${roomId}/notes`, remarksC, {
      headers: { Authorization: `Bearer ${interviewerToken}` }
    });

    const multiNotes = await axios.post(`${SERVER_URL}/api/interviews/${roomId}/candidate-notes`, {}, {
      headers: { Authorization: `Bearer ${interviewerToken}` }
    });

    const candMap = multiNotes.data.candidateNotes;
    assert(candMap['Candidate A'].comments === 'Good problem-solving approach. Needs improvement in optimization.', 'Candidate A remarks match exactly');
    assert(candMap['Candidate B'].comments === 'Strong communication and good debugging.', 'Candidate B remarks match exactly');
    assert(candMap['Candidate C'].comments === 'Could improve explanation of the solution.', 'Candidate C remarks match exactly');
    assert(candMap['Candidate A'].overallScore === 8, 'Candidate A score = 8');
    assert(candMap['Candidate B'].overallScore === 9, 'Candidate B score = 9');
    assert(candMap['Candidate C'].overallScore === 6, 'Candidate C score = 6');

    // -------------------------------------------------------------
    // TEST 9: Candidate isolation remains completely intact.
    // -------------------------------------------------------------
    console.log('\n--- TEST 9: Candidate isolation check ---');
    const candBSession = await axios.post(`${SERVER_URL}/api/interviews/${roomId}/session`, {
      candidateId: 'Candidate B'
    }, {
      headers: { Authorization: `Bearer ${tokenB}` }
    });
    assert(candBSession.data.interview.candidateNotes === undefined, 'Candidate B receives ZERO candidateNotes');
    assert(candBSession.data.interview.privateNotes === undefined, 'Candidate B receives ZERO privateNotes');

    // -------------------------------------------------------------
    // TEST 10: WebRTC signaling integrity verified.
    // -------------------------------------------------------------
    console.log('\n--- TEST 10: WebRTC signaling integrity ---');
    const p1 = createSocket({ auth: { token: interviewerToken } });
    const p2 = createSocket({ auth: { token: tokenB } });
    let p2GotOffer = false;

    p2.on('webrtc-offer', () => { p2GotOffer = true; });
    p1.emit('join-room', { roomId, token: interviewerToken });
    p2.emit('join-room', { roomId, token: tokenB });
    await wait(300);

    p1.emit('webrtc-offer', {
      roomId,
      targetSocketId: p2.id,
      offer: { type: 'offer', sdp: 'fake_sdp' }
    });
    await wait(200);

    assert(p2GotOffer, 'WebRTC signaling packets pass peer-to-peer unaffected');
    p1.disconnect();
    p2.disconnect();

    // -------------------------------------------------------------
    // TEST 11: 5-minute join window & countdown intact.
    // -------------------------------------------------------------
    console.log('\n--- TEST 11: 5-minute join window verification ---');
    const validateRes = await axios.post(`${SERVER_URL}/api/interviews/${roomId}/validate`);
    assert(validateRes.data.success === true && validateRes.data.deadline !== undefined, '5-minute deadline countdown API intact');

    // -------------------------------------------------------------
    // TEST 12: Tab switch violation and disqualification intact.
    // -------------------------------------------------------------
    console.log('\n--- TEST 12: Screen monitoring intact ---');
    const candSocketC = createSocket({ auth: { token: tokenC } });
    let candCGotWarning = false;
    candSocketC.on('screen-violation-warning', () => { candCGotWarning = true; });
    candSocketC.emit('join-room', { roomId, token: tokenC });
    await wait(300);
    candSocketC.emit('candidate:screen-hidden');
    await wait(300);
    assert(candCGotWarning, 'Screen monitoring warning emitted on tab switch');
    candSocketC.disconnect();

    // -------------------------------------------------------------
    // TEST 13: Code execution & interactive terminal intact.
    // -------------------------------------------------------------
    console.log('\n--- TEST 13: Code execution intact ---');
    const execRes = await axios.post(`${SERVER_URL}/api/judge0/run`, {
      source_code: 'print(40 + 2)',
      language: 'python'
    });
    assert(execRes.data.result?.stdout?.trim() === '42', 'Code execution sandbox returns correct result (42)');

    // -------------------------------------------------------------
    // RESULTS SUMMARY
    // -------------------------------------------------------------
    console.log('\n================================================================');
    console.log(`📊 TEST RESULTS: ${passed} / ${total} TESTS PASSED`);
    console.log('================================================================');

    if (passed === total) {
      console.log('🎉 ALL 13 REMARKS & PRIVACY TESTS PASSED 100%!\n');
      process.exit(0);
    } else {
      console.error('❌ SOME TESTS FAILED!\n');
      process.exit(1);
    }
  } catch (err) {
    console.error('Fatal error during test run:', err);
    process.exit(1);
  }
}

runRemarksTests();
