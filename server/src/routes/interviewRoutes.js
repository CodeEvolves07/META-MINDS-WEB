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

// POST /api/interviews - Create a new interview
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

// POST /api/interviews/:id/assign-question - Authorized Interviewer assigns question to a candidate
router.post('/:id/assign-question', (req, res) => {
  const { id } = req.params;

  if (!interviewStore.exists(id)) {
    return res.status(404).json({
      success: false,
      message: 'Interview room not found.'
    });
  }

  // 1. Authenticate user
  const tokenString = extractToken(req);
  let authUser = null;

  if (tokenString) {
    authUser = verifyToken(tokenString);
    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Invalid or expired authentication token.'
      });
    }

    // Room Authorization
    if (authUser.roomId !== id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Token is not authorized for this interview room.'
      });
    }

    // Role check: Only interviewer is authorized
    if (authUser.role !== 'interviewer') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Candidates are not authorized to assign or change questions.'
      });
    }
  } else {
    // Check fallback header
    const role = req.headers['x-user-role'] || req.body.role;
    if (role !== 'interviewer') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the interviewer can assign or change questions.'
      });
    }
  }

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

  // 2. Question exists in approved repository check
  if (!isApprovedProblem(cleanQId)) {
    return res.status(400).json({
      success: false,
      message: `Invalid question: '${cleanQId}' does not exist in the approved question repository.`
    });
  }

  // 3. Ensure candidate belongs to this interview
  interviewStore.registerCandidate(id, cleanCandId);

  // 4. Assign question to candidate
  interviewStore.assignQuestions(id, cleanCandId, [cleanQId]);

  return res.json({
    success: true,
    message: `Question '${cleanQId}' successfully assigned to candidate '${cleanCandId}'.`,
    candidateId: cleanCandId,
    assignedQuestions: [cleanQId]
  });
});

// POST /api/interviews/:id/join - Candidate joins interview room and receives signed token
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
  const token = interviewStore.registerCandidate(id, cleanName);
  const interview = interviewStore.getInterview(id, 'candidate', cleanName);

  return res.json({
    success: true,
    token,
    candidateId: cleanName,
    role: 'candidate',
    interview
  });
});

// GET /api/interviews/:id - Fetch interview info with server-side authorization
router.get('/:id', (req, res) => {
  const { id } = req.params;

  if (!interviewStore.exists(id)) {
    return res.status(404).json({
      success: false,
      message: 'Interview room not found.'
    });
  }

  const tokenString = extractToken(req);
  let authUser = null;

  if (tokenString) {
    authUser = verifyToken(tokenString);
    if (!authUser) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Invalid or expired authentication token.'
      });
    }

    // Room Authorization: verify token matches requested room ID
    if (authUser.roomId !== id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Token is not authorized for this interview room.'
      });
    }
  }

  // If authenticated via token, server-side identity & role are IMMUTABLE:
  if (authUser) {
    if (authUser.role === 'candidate') {
      // ID MANIPULATION DEFENSE: Candidate can NEVER request another candidate's resources!
      const requestedCandidateId = req.query.candidateId || req.headers['x-candidate-id'];
      if (requestedCandidateId && requestedCandidateId !== authUser.candidateId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: Access denied to another candidate\'s resources.'
        });
      }

      // ROLE SPOOFING DEFENSE: Query/header role cannot override authenticated role!
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
  }

  // Unauthenticated request fallback:
  const clientRole = req.query.role || req.headers['x-user-role'];
  const clientCandidateId = req.query.candidateId || req.headers['x-candidate-id'];

  if (clientRole === 'candidate') {
    // Return candidate-scoped view
    const interview = interviewStore.getInterview(id, 'candidate', clientCandidateId);
    return res.json({
      success: true,
      interview
    });
  } else if (clientRole === 'interviewer') {
    const interview = interviewStore.getInterview(id, 'interviewer', null);
    return res.json({
      success: true,
      interview
    });
  }

  // Default safe response (no role specified): public room metadata with ZERO private candidate data
  const interview = interviewStore.getInterview(id, 'candidate', null);
  return res.json({
    success: true,
    interview
  });
});

// PUT /api/interviews/:id/notes - Save interviewer private notes (INTERVIEWER ONLY)
router.put('/:id/notes', (req, res) => {
  const { id } = req.params;

  if (!interviewStore.exists(id)) {
    return res.status(404).json({
      success: false,
      message: 'Interview room not found.'
    });
  }

  const tokenString = extractToken(req);

  if (tokenString) {
    const authUser = verifyToken(tokenString);
    if (!authUser || authUser.roomId !== id || authUser.role !== 'interviewer') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the authorized interviewer can save private notes.'
      });
    }
  } else {
    const role = req.headers['x-user-role'] || req.body.role;
    if (role !== 'interviewer') {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the interviewer can save private notes.'
      });
    }
  }

  const { communicationRating, problemSolvingRating, technicalRating, comments, overallScore } = req.body;

  const updatedNotes = interviewStore.updateEvaluation(id, {
    communicationRating: Number(communicationRating) || 0,
    problemSolvingRating: Number(problemSolvingRating) || 0,
    technicalRating: Number(technicalRating) || 0,
    comments: comments || '',
    overallScore: Number(overallScore) || 0
  });

  return res.json({
    success: true,
    notes: updatedNotes
  });
});

// POST /api/interviews/:id/submit - Submit code
router.post('/:id/submit', (req, res) => {
  const { id } = req.params;

  if (!interviewStore.exists(id)) {
    return res.status(404).json({
      success: false,
      message: 'Interview room not found.'
    });
  }

  const tokenString = extractToken(req);
  let submittingCandidateId = req.body.candidateId || req.headers['x-candidate-id'] || 'Candidate';

  if (tokenString) {
    const authUser = verifyToken(tokenString);
    if (!authUser || authUser.roomId !== id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Token not valid for this interview room.'
      });
    }
    if (authUser.role === 'candidate') {
      submittingCandidateId = authUser.candidateId;
    }
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
  const { finalEvaluation } = req.body;

  const interview = interviewStore.endInterview(id, finalEvaluation);
  if (!interview) {
    return res.status(404).json({
      success: false,
      message: 'Interview room not found.'
    });
  }

  return res.json({
    success: true,
    interview
  });
});

// GET /api/interviews/:id/report - Final report with role and candidate scoping
router.get('/:id/report', (req, res) => {
  const { id } = req.params;

  if (!interviewStore.exists(id)) {
    return res.status(404).json({
      success: false,
      message: 'Interview report not found.'
    });
  }

  const tokenString = extractToken(req);
  let authUser = null;
  if (tokenString) {
    authUser = verifyToken(tokenString);
    if (!authUser || authUser.roomId !== id) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Invalid token for this interview report.'
      });
    }
  }

  let role = authUser?.role || req.query.role || req.headers['x-user-role'] || 'candidate';
  let candidateId = authUser?.candidateId || req.query.candidateId || req.headers['x-candidate-id'] || null;

  if (authUser?.role === 'candidate') {
    role = 'candidate';
    candidateId = authUser.candidateId;
  }

  const interview = interviewStore.getInterview(id, role, candidateId);

  return res.json({
    success: true,
    report: interview
  });
});

export default router;

