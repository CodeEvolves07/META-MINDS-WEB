import express from 'express';
import { interviewStore } from '../services/interviewStore.js';
import { extractToken, verifyToken } from '../services/authService.js';
import { isApprovedProblem, APPROVED_PROBLEMS } from '../services/problemRepository.js';

const router = express.Router();

// Helper to generate a clean 6-character alphanumeric interview ID
function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Server-Side Authentication & Authorization Guard
 * Enforces verified token, room membership, and role authorization.
 * Never trusts client-supplied headers (e.g. x-user-role) or query parameters.
 */
function authenticateRequest(req, res, roomId = null, requiredRole = null) {
  const tokenString = extractToken(req);
  if (!tokenString) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized: Authentication token is required.'
    });
    return null;
  }

  const authUser = verifyToken(tokenString);
  if (!authUser) {
    res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid or expired authentication token.'
    });
    return null;
  }

  // Room Authorization check
  if (roomId && authUser.roomId !== roomId) {
    res.status(403).json({
      success: false,
      message: 'Forbidden: Token is not authorized for this interview room.'
    });
    return null;
  }

  // Role Authorization check
  if (requiredRole && authUser.role !== requiredRole) {
    res.status(403).json({
      success: false,
      message: `Forbidden: Only ${requiredRole}s are authorized to access this resource.`
    });
    return null;
  }

  return authUser;
}

// ============================================================================
// 1. INTERVIEW CREATION & VALIDATION
// ============================================================================

// POST /api/interviews - Create a new interview room
router.post('/', (req, res) => {
  const { interviewerName, candidateName } = req.body;
  const id = generateRoomId();

  const interview = interviewStore.createInterview({
    id,
    interviewerName: interviewerName || 'Interviewer',
    candidateName: candidateName || 'Candidate',
    problemId: null // No default question: interviewer selects per candidate after joining
  });

  return res.status(201).json({
    success: true,
    interview,
    token: interview.interviewerToken
  });
});

// POST /api/interviews/:id/adjust-time-for-test - Simulate time passage for automated deadline tests
router.post('/:id/adjust-time-for-test', (req, res) => {
  const { id } = req.params;
  const interview = interviewStore.sessions.get(id);
  if (!interview) return res.status(404).json({ success: false, message: 'Room not found' });
  const elapsedMs = Number(req.body.elapsedMs) || 0;
  interview.meetingStartedAt = Date.now() - elapsedMs;
  interview.meetingJoinDeadline = interview.meetingStartedAt + 5 * 60 * 1000;
  return res.json({
    success: true,
    meetingStartedAt: interview.meetingStartedAt,
    meetingJoinDeadline: interview.meetingJoinDeadline,
    serverTime: Date.now(),
    isJoinWindowExpired: Date.now() >= interview.meetingJoinDeadline
  });
});

// POST /api/interviews/:id/validate & GET /api/interviews/:id/validate
// Public pre-join meeting check: validates room code existence and 5-minute join-window countdown
// Exposes ZERO private candidate data, code, or evaluations
const handleValidateRoom = (req, res) => {
  const { id } = req.params;
  if (!interviewStore.exists(id)) {
    return res.status(404).json({ success: false, message: 'Interview room not found.' });
  }

  const candidateId = req.body?.candidateId || req.query?.candidateId;
  if (candidateId && interviewStore.isCandidateDisqualified(id, candidateId)) {
    return res.status(403).json({
      success: false,
      disqualified: true,
      message: 'You have been disqualified from this interview and cannot rejoin.'
    });
  }

  const isExpired = interviewStore.isJoinWindowExpired(id);
  const isAccepted = candidateId ? interviewStore.isCandidateAccepted(id, candidateId) : false;

  if (isExpired && !isAccepted) {
    return res.status(403).json({
      success: false,
      expired: true,
      deadline: interviewStore.getMeetingJoinDeadline(id),
      serverTime: Date.now(),
      message: 'Your time for joining the meeting has expired.'
    });
  }

  return res.json({
    success: true,
    roomId: id,
    isJoinWindowExpired: isExpired,
    deadline: interviewStore.getMeetingJoinDeadline(id),
    serverTime: Date.now()
  });
};

router.post('/:id/validate', handleValidateRoom);
router.get('/:id/validate', handleValidateRoom);

// ============================================================================
// 2. CANDIDATE JOIN FLOW (5-Minute Window & Disqualification Gates)
// ============================================================================

// POST /api/interviews/:id/join - Candidate requests to join interview room
router.post('/:id/join', (req, res) => {
  const { id } = req.params;
  const { candidateName } = req.body;

  if (!interviewStore.exists(id)) {
    return res.status(404).json({
      success: false,
      message: 'Interview room not found.'
    });
  }

  const cleanName = (candidateName || 'Candidate').trim();

  // DISQUALIFICATION ENFORCEMENT: Disqualified candidates can never rejoin this interview
  if (interviewStore.isCandidateDisqualified(id, cleanName)) {
    return res.status(403).json({
      success: false,
      disqualified: true,
      message: 'You have been disqualified from this interview and cannot rejoin.'
    });
  }

  // 5-MINUTE JOIN WINDOW ENFORCEMENT:
  // If the 5-minute join window has expired AND the candidate was NOT already accepted:
  if (interviewStore.isJoinWindowExpired(id) && !interviewStore.isCandidateAccepted(id, cleanName)) {
    return res.status(403).json({
      success: false,
      expired: true,
      message: 'Your time for joining the meeting has expired.'
    });
  }

  const token = interviewStore.registerCandidate(id, cleanName);
  const admissionStatus = interviewStore.requestAdmission(id, cleanName);
  const interview = interviewStore.getInterview(id, 'candidate', cleanName);

  // Notify interviewers in this room in real time about join request
  const io = req.app.get('io');
  if (io) {
    const roomSockets = io.sockets.adapter.rooms.get(id);
    if (roomSockets) {
      for (const sId of roomSockets) {
        const target = io.sockets.sockets.get(sId);
        if (target && target.data?.role === 'interviewer') {
          target.emit('candidate-join-request', {
            candidateId: cleanName,
            candidateName: cleanName,
            roomId: id,
            requestedAt: new Date().toISOString()
          });
        }
      }
    }
  }

  return res.json({
    success: true,
    token,
    candidateId: cleanName,
    role: 'candidate',
    admissionStatus,
    interview
  });
});

// ============================================================================
// 3. ADMISSION STATUS & WAITING ROOM
// ============================================================================

// POST /api/interviews/:id/admission-status - Check candidate admission status (POST required)
const handleGetAdmissionStatus = (req, res) => {
  const { id } = req.params;
  if (!interviewStore.exists(id)) {
    return res.status(404).json({ success: false, message: 'Interview room not found.' });
  }

  const authUser = authenticateRequest(req, res, id);
  if (!authUser) return;

  let targetCandidateId = authUser.candidateId;
  if (authUser.role === 'interviewer') {
    targetCandidateId = req.body?.candidateId || req.query?.candidateId;
  } else if (authUser.role === 'candidate') {
    const requestedCand = req.body?.candidateId || req.query?.candidateId;
    if (requestedCand && requestedCand !== authUser.candidateId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Cannot query another candidate's admission status."
      });
    }
    targetCandidateId = authUser.candidateId;
  }

  if (!targetCandidateId) {
    return res.status(400).json({ success: false, message: 'candidateId is required.' });
  }

  const status = interviewStore.getAdmissionStatus(id, targetCandidateId) || 'PENDING';
  return res.json({
    success: true,
    candidateId: targetCandidateId,
    admissionStatus: status
  });
};

router.post('/:id/admission-status', handleGetAdmissionStatus);
router.get('/:id/admission-status', (req, res) => {
  return res.status(405).json({
    success: false,
    message: 'Method Not Allowed: Admission status must be retrieved via authenticated POST /api/interviews/:id/admission-status.'
  });
});

// POST /api/interviews/:id/pending-requests - Interviewer retrieves pending requests (POST required)
const handleGetPendingRequests = (req, res) => {
  const { id } = req.params;
  if (!interviewStore.exists(id)) {
    return res.status(404).json({ success: false, message: 'Interview room not found.' });
  }

  const authUser = authenticateRequest(req, res, id, 'interviewer');
  if (!authUser) return;

  const pending = interviewStore.getPendingJoinRequests(id);
  return res.json({
    success: true,
    pendingRequests: pending
  });
};

router.post('/:id/pending-requests', handleGetPendingRequests);
router.get('/:id/pending-requests', (req, res) => {
  return res.status(405).json({
    success: false,
    message: 'Method Not Allowed: Pending requests must be retrieved via authenticated POST /api/interviews/:id/pending-requests.'
  });
});

// POST /api/interviews/:id/admission-decision - Interviewer accepts or declines candidate
router.post('/:id/admission-decision', (req, res) => {
  const { id } = req.params;
  if (!interviewStore.exists(id)) {
    return res.status(404).json({ success: false, message: 'Interview room not found.' });
  }

  const authUser = authenticateRequest(req, res, id, 'interviewer');
  if (!authUser) return;

  const { candidateId, decision } = req.body;
  if (!candidateId || !decision) {
    return res.status(400).json({ success: false, message: 'candidateId and decision are required.' });
  }

  const normalized = (decision || '').toUpperCase();
  const willAccept = normalized === 'ACCEPT' || normalized === 'ACCEPTED';

  // DISQUALIFICATION ENFORCEMENT: Disqualified candidate can never be accepted
  if (willAccept && interviewStore.isCandidateDisqualified(id, candidateId)) {
    return res.status(403).json({
      success: false,
      disqualified: true,
      message: 'Cannot admit candidate: Candidate has been disqualified from this interview.'
    });
  }

  // 5-MINUTE JOIN WINDOW ENFORCEMENT ON PENDING CANDIDATE:
  // If the interviewer attempts to accept AFTER deadline and candidate was not already accepted:
  if (willAccept && interviewStore.isJoinWindowExpired(id) && !interviewStore.isCandidateAccepted(id, candidateId)) {
    interviewStore.setAdmissionDecision(id, candidateId, 'DECLINED');

    const io = req.app.get('io');
    if (io) {
      io.to(`waiting:${id}:${candidateId}`).emit('admission-status', {
        status: 'DECLINED',
        candidateId,
        expired: true,
        message: 'Your time for joining the meeting has expired.'
      });
      io.to(`waiting:${id}:${candidateId}`).emit('candidate-join-declined', {
        candidateId,
        roomId: id,
        expired: true,
        message: 'Your time for joining the meeting has expired.'
      });
      const pending = interviewStore.getPendingJoinRequests(id);
      const roomSockets = io.sockets.adapter.rooms.get(id);
      if (roomSockets) {
        for (const sId of roomSockets) {
          const target = io.sockets.sockets.get(sId);
          if (target && target.data?.role === 'interviewer') {
            target.emit('candidate-admission-updated', {
              candidateId,
              decision: 'DECLINED',
              pendingRequests: pending
            });
          }
        }
      }
    }

    return res.status(403).json({
      success: false,
      expired: true,
      message: 'Your time for joining the meeting has expired.'
    });
  }

  const finalDecision = interviewStore.setAdmissionDecision(id, candidateId, decision);

  const io = req.app.get('io');
  if (io) {
    // Notify waiting candidate socket on their isolated channel
    io.to(`waiting:${id}:${candidateId}`).emit('admission-status', {
      status: finalDecision,
      candidateId,
      message: finalDecision === 'ACCEPTED'
        ? 'Your request was accepted. You may now join the interview.'
        : 'Your request to join the interview was declined by the interviewer.'
    });

    if (finalDecision === 'ACCEPTED') {
      io.to(`waiting:${id}:${candidateId}`).emit('candidate-join-accepted', {
        candidateId,
        roomId: id
      });
    } else {
      io.to(`waiting:${id}:${candidateId}`).emit('candidate-join-declined', {
        candidateId,
        roomId: id
      });
    }

    // Notify all interviewers
    const pending = interviewStore.getPendingJoinRequests(id);
    const roomSockets = io.sockets.adapter.rooms.get(id);
    if (roomSockets) {
      for (const sId of roomSockets) {
        const target = io.sockets.sockets.get(sId);
        if (target && target.data?.role === 'interviewer') {
          target.emit('candidate-admission-updated', {
            candidateId,
            decision: finalDecision,
            pendingRequests: pending
          });
        }
      }
    }
  }

  return res.json({
    success: true,
    candidateId,
    admissionStatus: finalDecision
  });
});

// ============================================================================
// 4. PROTECTED INTERVIEW DATA & CANDIDATE ISOLATION
// ============================================================================

// POST /api/interviews/:id/session & POST /api/interviews/:id
// Fetch interview session data with strict server-side authentication & authorization
// Candidate receives strictly their own code/output/assignments; Interviewer receives interviewer view
const handleGetInterviewSession = (req, res) => {
  const { id } = req.params;

  if (!interviewStore.exists(id)) {
    return res.status(404).json({
      success: false,
      message: 'Interview room not found.'
    });
  }

  const authUser = authenticateRequest(req, res, id);
  if (!authUser) return;

  if (authUser.role === 'candidate') {
    // ID MANIPULATION DEFENSE: Candidate can NEVER request another candidate's resources!
    const requestedCandidateId = req.body?.candidateId || req.query?.candidateId;
    if (requestedCandidateId && requestedCandidateId !== authUser.candidateId) {
      return res.status(403).json({
        success: false,
        message: "Forbidden: Access denied to another candidate's resources."
      });
    }

    // Returns strictly candidate's own data
    const interview = interviewStore.getInterview(id, 'candidate', authUser.candidateId);
    return res.json({
      success: true,
      interview
    });
  } else if (authUser.role === 'interviewer') {
    // Interviewer authorized for this room
    const interview = interviewStore.getInterview(id, 'interviewer', null);
    return res.json({
      success: true,
      interview
    });
  }

  return res.status(403).json({
    success: false,
    message: 'Forbidden: Unknown user role.'
  });
};

router.post('/:id/session', handleGetInterviewSession);
router.post('/:id', handleGetInterviewSession);

// Prohibit GET /api/interviews/:id to satisfy Section 8 (no GET for protected application data)
router.get('/:id', (req, res) => {
  return res.status(405).json({
    success: false,
    message: 'Method Not Allowed: Protected interview session data must be retrieved via authenticated POST /api/interviews/:id/session.'
  });
});

// ============================================================================
// 5. QUESTION ASSIGNMENT & INTERVIEWER EVALUATION
// ============================================================================

// POST /api/interviews/:id/assign-question - Authorized Interviewer assigns question to a candidate
router.post('/:id/assign-question', (req, res) => {
  const { id } = req.params;

  if (!interviewStore.exists(id)) {
    return res.status(404).json({
      success: false,
      message: 'Interview room not found.'
    });
  }

  const authUser = authenticateRequest(req, res, id, 'interviewer');
  if (!authUser) return;

  const { candidateId, questionId } = req.body;

  if (!candidateId || typeof candidateId !== 'string' || !candidateId.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Candidate ID is required.'
    });
  }

  if (!questionId || typeof questionId !== 'string' || !questionId.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Question ID is required.'
    });
  }

  const cleanCandId = candidateId.trim();
  const cleanQId = questionId.trim();

  // Question exists in approved repository check
  if (!isApprovedProblem(cleanQId)) {
    return res.status(400).json({
      success: false,
      message: `Invalid question: '${cleanQId}' does not exist in the approved question repository.`
    });
  }

  // Ensure candidate belongs to this interview
  interviewStore.registerCandidate(id, cleanCandId);

  // Assign question to candidate
  interviewStore.assignQuestions(id, cleanCandId, [cleanQId]);

  return res.json({
    success: true,
    message: `Question '${cleanQId}' successfully assigned to candidate '${cleanCandId}'.`,
    candidateId: cleanCandId,
    assignedQuestions: [cleanQId]
  });
});

// POST /api/interviews/:id/notes & PUT /api/interviews/:id/notes - Save interviewer private notes
const handleSaveNotes = (req, res) => {
  const { id } = req.params;

  if (!interviewStore.exists(id)) {
    return res.status(404).json({
      success: false,
      message: 'Interview room not found.'
    });
  }

  const authUser = authenticateRequest(req, res, id, 'interviewer');
  if (!authUser) return;

  const { candidateId, communicationRating, problemSolvingRating, technicalRating, comments, remarks, overallScore } = req.body;

  const cleanCandId = (candidateId || '').trim();

  // If candidateId is provided, ensure candidate is registered in this interview
  if (cleanCandId && !interviewStore.isCandidateRegistered(id, cleanCandId)) {
    interviewStore.registerCandidate(id, cleanCandId);
  }

  const updatedNotes = interviewStore.updateEvaluation(id, {
    communicationRating: Number(communicationRating) || 0,
    problemSolvingRating: Number(problemSolvingRating) || 0,
    technicalRating: Number(technicalRating) || 0,
    comments: typeof comments === 'string' ? comments : (typeof remarks === 'string' ? remarks : ''),
    overallScore: Number(overallScore) || 0
  }, cleanCandId || null);

  return res.json({
    success: true,
    candidateId: cleanCandId || null,
    notes: updatedNotes,
    candidateNotes: interviewStore.getCandidateNotes(id)
  });
};

router.post('/:id/notes', handleSaveNotes);
router.put('/:id/notes', handleSaveNotes);
router.get('/:id/notes', (req, res) => {
  return res.status(405).json({
    success: false,
    message: 'Method Not Allowed: Private notes must be accessed via authenticated POST /api/interviews/:id/notes.'
  });
});

// POST /api/interviews/:id/candidate-notes - Interviewer fetches private candidate notes
const handleGetCandidateNotes = (req, res) => {
  const { id } = req.params;
  if (!interviewStore.exists(id)) {
    return res.status(404).json({ success: false, message: 'Interview room not found.' });
  }

  const authUser = authenticateRequest(req, res, id, 'interviewer');
  if (!authUser) return;

  const candidateId = req.body?.candidateId;
  const candidateNotes = interviewStore.getCandidateNotes(id, candidateId);

  return res.json({
    success: true,
    candidateId: candidateId || null,
    candidateNotes
  });
};

router.post('/:id/candidate-notes', handleGetCandidateNotes);
router.get('/:id/candidate-notes', (req, res) => {
  return res.status(405).json({
    success: false,
    message: 'Method Not Allowed: Candidate notes must be retrieved via authenticated POST /api/interviews/:id/candidate-notes.'
  });
});

// ============================================================================
// 6. CODE SUBMISSION, END INTERVIEW, & REPORTS
// ============================================================================

// POST /api/interviews/:id/submit - Submit code
router.post('/:id/submit', (req, res) => {
  const { id } = req.params;

  if (!interviewStore.exists(id)) {
    return res.status(404).json({
      success: false,
      message: 'Interview room not found.'
    });
  }

  const authUser = authenticateRequest(req, res, id);
  if (!authUser) return;

  let submittingCandidateId = req.body.candidateId;
  if (authUser.role === 'candidate') {
    // Immutable identity: Candidate can only submit their own work
    submittingCandidateId = authUser.candidateId;
  } else if (authUser.role === 'interviewer') {
    submittingCandidateId = submittingCandidateId || 'Candidate';
  }

  const { code, language, problemId, executionResult, testResults } = req.body;

  const submission = interviewStore.saveSubmission(id, submittingCandidateId, {
    code,
    language,
    problemId,
    executionResult,
    testResults
  });

  return res.json({
    success: true,
    submission
  });
});

// POST /api/interviews/:id/end - End interview
router.post('/:id/end', (req, res) => {
  const { id } = req.params;

  if (!interviewStore.exists(id)) {
    return res.status(404).json({
      success: false,
      message: 'Interview room not found.'
    });
  }

  const authUser = authenticateRequest(req, res, id, 'interviewer');
  if (!authUser) return;

  const { finalEvaluation } = req.body;
  const interview = interviewStore.endInterview(id, finalEvaluation);

  return res.json({
    success: true,
    interview
  });
});

// POST /api/interviews/:id/report - Final report with role and candidate scoping (POST required)
const handleGetReport = (req, res) => {
  const { id } = req.params;

  if (!interviewStore.exists(id)) {
    return res.status(404).json({
      success: false,
      message: 'Interview report not found.'
    });
  }

  const authUser = authenticateRequest(req, res, id);
  if (!authUser) return;

  let role = authUser.role;
  let candidateId = authUser.candidateId;

  if (authUser.role === 'interviewer') {
    candidateId = req.body?.candidateId || null;
  } else if (authUser.role === 'candidate') {
    role = 'candidate';
    candidateId = authUser.candidateId;
  }

  const interview = interviewStore.getInterview(id, role, candidateId);

  return res.json({
    success: true,
    report: interview
  });
};

router.post('/:id/report', handleGetReport);
router.get('/:id/report', (req, res) => {
  return res.status(405).json({
    success: false,
    message: 'Method Not Allowed: Reports must be retrieved via authenticated POST /api/interviews/:id/report.'
  });
});

export default router;
