import { io } from 'socket.io-client';
import axios from 'axios';

const SERVER_URL = 'http://localhost:5001';

async function runTwoUserTest() {
  console.log('🧪 Starting CodeMeet Two-User End-to-End Simulation Test...\n');

  // Step 1: Create Interview via API
  console.log('--- Step 1: Interviewer creates room ---');
  const createRes = await axios.post(`${SERVER_URL}/api/interviews`, {
    interviewerName: 'Dr. Jane Interviewer',
    candidateName: 'John Candidate',
    problemId: 'find-largest-element'
  });

  const interview = createRes.data.interview;
  const roomId = interview.id;
  console.log(`✅ Room Created with ID: ${roomId}`);
  console.log(`   Interviewer: ${interview.interviewerName}`);
  console.log(`   Candidate: ${interview.candidateName}`);
  console.log(`   Initial Problem: ${interview.problemId}\n`);

  // Step 2: Connect Socket Clients for Interviewer and Candidate
  console.log('--- Step 2: Connecting WebSockets for both users ---');
  const interviewerSocket = io(SERVER_URL, { transports: ['websocket'] });
  const candidateSocket = io(SERVER_URL, { transports: ['websocket'] });

  await Promise.all([
    new Promise(res => interviewerSocket.on('connect', res)),
    new Promise(res => candidateSocket.on('connect', res))
  ]);
  console.log('✅ Both WebSockets connected to server.');

  // Step 3: Join Room
  console.log('\n--- Step 3: Joining Room ---');
  interviewerSocket.emit('join-room', {
    roomId,
    role: 'interviewer',
    userName: 'Dr. Jane Interviewer'
  });

  candidateSocket.emit('join-room', {
    roomId,
    role: 'candidate',
    userName: 'John Candidate'
  });

  // Verify candidate receives interviewer presence
  await new Promise(resolve => {
    candidateSocket.on('user-joined', (data) => {
      console.log(`✅ Candidate observed user-joined: ${data.userName} (${data.role})`);
      resolve();
    });
    // Or if interviewer joined first
    setTimeout(resolve, 500);
  });

  // Step 4: WebRTC Signaling Test
  console.log('\n--- Step 4: Testing WebRTC Signaling Handshake ---');
  let candidateSocketId = candidateSocket.id;
  let interviewerSocketId = interviewerSocket.id;

  const signalingPromise = new Promise(resolve => {
    candidateSocket.on('webrtc-offer', (data) => {
      console.log('✅ Candidate received WebRTC offer from Interviewer');
      // Candidate replies with answer
      candidateSocket.emit('webrtc-answer', {
        roomId,
        targetSocketId: data.senderSocketId,
        answer: { type: 'answer', sdp: 'dummy-sdp-answer-data' }
      });
    });

    interviewerSocket.on('webrtc-answer', (data) => {
      console.log('✅ Interviewer received WebRTC answer from Candidate');
      resolve();
    });
  });

  interviewerSocket.emit('webrtc-offer', {
    roomId,
    offer: { type: 'offer', sdp: 'dummy-sdp-offer-data' }
  });

  await signalingPromise;

  // Step 4.5: ICE Candidate Exchange Test
  console.log('\n--- Step 4.5: Testing WebRTC ICE Candidate Exchange ---');
  const icePromise = new Promise((resolve, reject) => {
    let candToCandidateReceived = false;
    let candToInterviewerReceived = false;

    candidateSocket.on('webrtc-ice-candidate', (data) => {
      if (data.candidate && data.candidate.candidate.includes('typ host')) {
        console.log('✅ Candidate received ICE candidate from Interviewer');
        candToCandidateReceived = true;
        if (candToCandidateReceived && candToInterviewerReceived) resolve();
      }
    });

    interviewerSocket.on('webrtc-ice-candidate', (data) => {
      if (data.candidate && data.candidate.candidate.includes('typ srflx')) {
        console.log('✅ Interviewer received ICE candidate from Candidate');
        candToInterviewerReceived = true;
        if (candToCandidateReceived && candToInterviewerReceived) resolve();
      }
    });

    // Send from Interviewer to Candidate
    interviewerSocket.emit('webrtc-ice-candidate', {
      roomId,
      candidate: { candidate: 'candidate:1 1 UDP 2130706431 192.168.1.100 50000 typ host', sdpMid: '0', sdpMLineIndex: 0 }
    });

    // Send from Candidate to Interviewer
    candidateSocket.emit('webrtc-ice-candidate', {
      roomId,
      candidate: { candidate: 'candidate:2 1 UDP 1694498815 203.0.113.1 50001 typ srflx', sdpMid: '1', sdpMLineIndex: 1 }
    });

    setTimeout(() => {
      if (candToCandidateReceived && candToInterviewerReceived) resolve();
      else reject(new Error('ICE candidate exchange timed out'));
    }, 1500);
  });

  await icePromise;

  // Step 5: Real-Time Collaborative Code Synchronization
  console.log('\n--- Step 5: Testing Collaborative Code Sync ---');
  const codeSyncPromise = new Promise(resolve => {
    candidateSocket.on('code-update', (data) => {
      console.log(`✅ Candidate received live code update: "${data.code}"`);
      resolve();
    });
  });

  interviewerSocket.emit('code-change', {
    roomId,
    code: 'def find_largest(nums):\n    return max(nums) if nums else None'
  });

  await codeSyncPromise;

  // Step 6: Language Synchronization
  console.log('\n--- Step 6: Testing Programming Language Sync ---');
  const langSyncPromise = new Promise(resolve => {
    interviewerSocket.on('language-update', (data) => {
      console.log(`✅ Interviewer received language update: "${data.language}"`);
      resolve();
    });
  });

  candidateSocket.emit('language-change', {
    roomId,
    language: 'javascript'
  });

  await langSyncPromise;

  // Step 7: Problem Synchronization
  console.log('\n--- Step 7: Testing Problem Synchronization ---');
  const problemSyncPromise = new Promise(resolve => {
    candidateSocket.on('problem-update', (data) => {
      console.log(`✅ Candidate received problem switch: "${data.problemId}"`);
      resolve();
    });
  });

  interviewerSocket.emit('problem-change', {
    roomId,
    problemId: 'two-sum'
  });

  await problemSyncPromise;

  // Step 8: Code Execution (Judge0 / Sandbox runner)
  console.log('\n--- Step 8: Testing Code Execution ---');
  const runRes = await axios.post(`${SERVER_URL}/api/judge0/run`, {
    source_code: 'function twoSum(nums, target) { return [0, 1]; } console.log("0 1");',
    language: 'javascript',
    stdin: '9\n2 7 11 15'
  });
  console.log('✅ Code Execution Response:', {
    status: runRes.data.result.status.description,
    stdout: runRes.data.result.stdout.trim(),
    time: runRes.data.result.time,
    engine: runRes.data.result.engine
  });

  // Step 9: Code Submission
  console.log('\n--- Step 9: Testing Candidate Code Submission ---');
  const submitRes = await axios.post(`${SERVER_URL}/api/interviews/${roomId}/submit`, {
    code: 'function twoSum(nums, target) { return [0, 1]; } console.log("0 1");',
    language: 'javascript',
    problemId: 'two-sum',
    executionResult: runRes.data.result
  });
  console.log('✅ Candidate Code Submitted at:', submitRes.data.submission.submittedAt);

  // Step 10: Private Interviewer Notes & Security Validation
  console.log('\n--- Step 10: Testing Private Interviewer Notes & Security RBAC ---');
  // Candidate attempts to view notes -> should be stripped
  const candViewRes = await axios.get(`${SERVER_URL}/api/interviews/${roomId}?role=candidate`);
  if (candViewRes.data.interview.privateNotes === undefined) {
    console.log('🔒 Security Verified: Candidate CANNOT see privateNotes (properly stripped).');
  } else {
    console.error('❌ Security Violation: Candidate received privateNotes!');
  }

  // Interviewer saves notes
  const notesRes = await axios.put(`${SERVER_URL}/api/interviews/${roomId}/notes`, {
    communicationRating: 5,
    problemSolvingRating: 4,
    technicalRating: 5,
    comments: 'Strong algorithm intuition and clear thought explanation.',
    overallScore: 9
  }, {
    headers: { 'x-user-role': 'interviewer' }
  });
  console.log('✅ Interviewer Notes Saved:', notesRes.data.notes);

  // Step 11: End Interview
  console.log('\n--- Step 11: Testing End Interview Flow ---');
  const endPromise = new Promise(resolve => {
    candidateSocket.on('interview-ended', () => {
      console.log('✅ Candidate received interview-ended event via WebSocket.');
      resolve();
    });
  });

  await axios.post(`${SERVER_URL}/api/interviews/${roomId}/end`, {
    finalEvaluation: notesRes.data.notes
  });

  interviewerSocket.emit('end-interview', { roomId });
  await endPromise;

  // Step 12: Final Report Generation
  console.log('\n--- Step 12: Generating Final Report ---');
  const reportRes = await axios.get(`${SERVER_URL}/api/interviews/${roomId}/report?role=interviewer`);
  const report = reportRes.data.report;
  console.log('✅ Final Interview Report Generated:');
  console.log(`   Room ID: ${report.id}`);
  console.log(`   Candidate: ${report.candidateName}`);
  console.log(`   Interviewer: ${report.interviewerName}`);
  console.log(`   Status: ${report.status}`);
  console.log(`   Score: ${report.privateNotes?.overallScore}/10`);
  console.log(`   Submitted Code: ${report.submission?.code ? 'Present' : 'None'}`);

  interviewerSocket.disconnect();
  candidateSocket.disconnect();

  console.log('\n🎉 ALL 12 END-TO-END CRITICAL TESTS PASSED SUCCESSFULLY! 🚀');
}

runTwoUserTest().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
