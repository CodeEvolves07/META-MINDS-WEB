import { createInterviewerToken, createCandidateToken } from './authService.js';

// In-memory interview session store with per-candidate isolation and question assignment
class InterviewStore {
  constructor() {
    this.sessions = new Map();
  }

  createInterview({ id, interviewerName, candidateName, problemId = null }) {
    const interviewerTok = createInterviewerToken(id, interviewerName || 'Interviewer');

    const interview = {
      id,
      interviewerName: interviewerName || 'Interviewer',
      candidateName: candidateName || 'Candidate',
      interviewerToken: interviewerTok,
      problemId: null, // No default problem! Questions are selected per candidate after joining
      status: 'active', // 'active' | 'completed'
      createdAt: new Date().toISOString(),
      meetingStartedAt: Date.now(),
      meetingJoinDeadline: Date.now() + 5 * 60 * 1000,
      completedAt: null,
      code: '',
      language: 'python',
      // Per-candidate isolated code storage: candidateId -> { [questionId]: { code: string, language: string, updatedAt: string } }
      candidateCode: {},
      // Per-candidate isolated output storage: candidateId -> { [questionId]: result }
      candidateOutputs: {},
      // Per-candidate assigned questions: candidateId -> string[] (problemIds)
      assignedQuestions: {},
      // Per-candidate submissions: candidateId -> submissionData
      candidateSubmissions: {},
      // Per-candidate issued auth tokens: candidateId -> token
      candidateTokens: {},
      // Registered candidates in this interview room
      registeredCandidates: [],
      // Per-candidate admission status: candidateId -> 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'DISQUALIFIED'
      candidateAdmissions: {},
      // Pending join requests awaiting interviewer approval: candidateId -> { candidateId, candidateName, roomId, requestedAt }
      pendingJoinRequests: {},
      // Per-candidate screen / tab switch violation counts: candidateId -> number
      tabViolations: {},
      // Per-candidate screen visibility state: candidateId -> 'visible' | 'hidden'
      candidateScreenStates: {},
      // Per-candidate last departure timestamp for duplicate deduplication: candidateId -> number
      // Per-candidate evaluations/remarks: candidateId -> { communicationRating, problemSolvingRating, technicalRating, comments, overallScore, updatedAt }
      candidateNotes: {},
      privateNotes: {
        communicationRating: 0,
        problemSolvingRating: 0,
        technicalRating: 0,
        comments: '',
        overallScore: 0
      },
      submission: null,
      participants: {
        interviewerJoined: false,
        candidateJoined: false
      }
    };

    this.sessions.set(id, interview);
    return interview;
  }

  getInterview(id, requesterRole = 'interviewer', requesterCandidateId = null) {
    const interview = this.sessions.get(id);
    if (!interview) return null;

    // Deep clone to avoid mutating stored state
    const safeInterview = JSON.parse(JSON.stringify(interview));

    // SECURITY & PRIVACY REQUIREMENT:
    // 1. Candidates must NEVER receive private notes or interviewer evaluations!
    // 2. Candidates must NEVER receive other candidates' code, outputs, or assignments!
    // 3. Candidates must NEVER receive internal tokens!
    if (requesterRole === 'candidate') {
      delete safeInterview.privateNotes;
      delete safeInterview.candidateNotes;
      delete safeInterview.interviewerToken;
      delete safeInterview.candidateTokens;
      delete safeInterview.registeredCandidates;

      // Filter candidateCode: keep strictly requester's code
      if (safeInterview.candidateCode) {
        const myCode = requesterCandidateId ? safeInterview.candidateCode[requesterCandidateId] : null;
        safeInterview.candidateCode = myCode ? { [requesterCandidateId]: myCode } : {};
      }

      // Filter candidateOutputs: keep strictly requester's outputs
      if (safeInterview.candidateOutputs) {
        const myOutputs = requesterCandidateId ? safeInterview.candidateOutputs[requesterCandidateId] : null;
        safeInterview.candidateOutputs = myOutputs ? { [requesterCandidateId]: myOutputs } : {};
      }

      // Filter assignedQuestions: keep strictly requester's assigned questions
      if (safeInterview.assignedQuestions) {
        const myAssigned = requesterCandidateId ? safeInterview.assignedQuestions[requesterCandidateId] : null;
        safeInterview.assignedQuestions = myAssigned ? { [requesterCandidateId]: myAssigned } : {};
      }

      // Candidate problemId is strictly their own assigned question (null if not yet assigned)
      const myAssignedList = requesterCandidateId && safeInterview.assignedQuestions ? safeInterview.assignedQuestions[requesterCandidateId] : null;
      safeInterview.problemId = (Array.isArray(myAssignedList) && myAssignedList.length > 0) ? myAssignedList[0] : null;

      // Filter candidateSubmissions: keep strictly requester's submission
      if (safeInterview.candidateSubmissions) {
        const mySub = requesterCandidateId ? safeInterview.candidateSubmissions[requesterCandidateId] : null;
        safeInterview.candidateSubmissions = mySub ? { [requesterCandidateId]: mySub } : {};
      }

      // Filter submission: only keep if belongs to requester
      if (safeInterview.submission && safeInterview.submission.candidateId !== requesterCandidateId) {
        delete safeInterview.submission;
      }

      // Candidate privacy: remove other join requests, only provide their own status
      delete safeInterview.pendingJoinRequests;
      delete safeInterview.candidateAdmissions;
      safeInterview.admissionStatus = interview.candidateAdmissions?.[requesterCandidateId] || 'PENDING';
      safeInterview.isDisqualified = interview.candidateAdmissions?.[requesterCandidateId] === 'DISQUALIFIED';
      safeInterview.tabViolations = requesterCandidateId ? { [requesterCandidateId]: interview.tabViolations?.[requesterCandidateId] || 0 } : {};
    } else if (requesterRole === 'interviewer') {
      safeInterview.pendingJoinRequests = Object.values(interview.pendingJoinRequests || {});
      safeInterview.candidateAdmissions = interview.candidateAdmissions || {};
      safeInterview.tabViolations = interview.tabViolations || {};
      safeInterview.candidateNotes = interview.candidateNotes || {};
      safeInterview.privateNotes = requesterCandidateId
        ? (interview.candidateNotes?.[requesterCandidateId] || interview.privateNotes)
        : (interview.privateNotes || {});
    }

    safeInterview.meetingStartedAt = interview.meetingStartedAt;
    safeInterview.meetingJoinDeadline = interview.meetingJoinDeadline;
    safeInterview.serverTime = Date.now();
    safeInterview.isJoinWindowExpired = Date.now() >= (interview.meetingJoinDeadline || (new Date(interview.createdAt).getTime() + 5 * 60 * 1000));

    return safeInterview;
  }

  // Check if 5-minute join window has expired for room
  isJoinWindowExpired(id) {
    const interview = this.sessions.get(id);
    if (!interview) return true;
    const deadline = interview.meetingJoinDeadline || (new Date(interview.createdAt).getTime() + 5 * 60 * 1000);
    return Date.now() >= deadline;
  }

  // Get meeting join deadline timestamp
  getMeetingJoinDeadline(id) {
    const interview = this.sessions.get(id);
    if (!interview) return null;
    return interview.meetingJoinDeadline || (new Date(interview.createdAt).getTime() + 5 * 60 * 1000);
  }

  // Check if candidate is already accepted
  isCandidateAccepted(id, candidateName) {
    const interview = this.sessions.get(id);
    if (!interview || !interview.candidateAdmissions) return false;
    return interview.candidateAdmissions[candidateName] === 'ACCEPTED';
  }

  // Check if candidate is disqualified
  isCandidateDisqualified(id, candidateName) {
    const interview = this.sessions.get(id);
    if (!interview || !interview.candidateAdmissions) return false;
    const status = interview.candidateAdmissions[candidateName];
    const count = interview.tabViolations?.[candidateName] || 0;
    return status === 'DISQUALIFIED' || count >= 3;
  }

  // Get tab violations count for a candidate
  getTabViolations(id, candidateName) {
    const interview = this.sessions.get(id);
    if (!interview || !interview.tabViolations) return 0;
    return interview.tabViolations[candidateName] || 0;
  }

  // Get all tab violations for an interview
  getAllTabViolations(id) {
    const interview = this.sessions.get(id);
    if (!interview || !interview.tabViolations) return {};
    return interview.tabViolations;
  }

  // Set candidate screen state ('visible' | 'hidden')
  setCandidateScreenState(id, candidateName, state) {
    const interview = this.sessions.get(id);
    if (!interview) return;
    if (!interview.candidateScreenStates) interview.candidateScreenStates = {};
    interview.candidateScreenStates[candidateName] = state;
  }

  // Record a screen departure violation (authoritative server counter)
  recordScreenViolation(id, candidateName) {
    const interview = this.sessions.get(id);
    if (!interview) return { success: false, error: 'Interview room not found' };

    if (!interview.tabViolations) interview.tabViolations = {};
    if (!interview.candidateScreenStates) interview.candidateScreenStates = {};
    if (!interview.lastViolationTimestamps) interview.lastViolationTimestamps = {};
    if (!interview.candidateAdmissions) interview.candidateAdmissions = {};

    // Candidate must be ACCEPTED to be monitored
    const admission = interview.candidateAdmissions[candidateName];
    if (admission !== 'ACCEPTED' && admission !== 'DISQUALIFIED') {
      return { success: false, error: 'Candidate is not an active admitted participant' };
    }

    // Already disqualified check
    if (this.isCandidateDisqualified(id, candidateName)) {
      return {
        count: interview.tabViolations[candidateName] || 3,
        disqualified: true,
        alreadyDisqualified: true
      };
    }

    // Duplicate event prevention (rapid duplicate triggers or redundant hidden events)
    const now = Date.now();
    const lastTime = interview.lastViolationTimestamps[candidateName] || 0;
    if (interview.candidateScreenStates[candidateName] === 'hidden' && (now - lastTime < 500)) {
      return {
        count: interview.tabViolations[candidateName] || 0,
        duplicate: true,
        disqualified: false
      };
    }

    // Increment server-side authoritative counter
    const currentCount = interview.tabViolations[candidateName] || 0;
    const newCount = currentCount + 1;
    interview.tabViolations[candidateName] = newCount;
    interview.candidateScreenStates[candidateName] = 'hidden';
    interview.lastViolationTimestamps[candidateName] = now;

    if (newCount >= 3) {
      interview.candidateAdmissions[candidateName] = 'DISQUALIFIED';
      return {
        count: newCount,
        disqualified: true
      };
    }

    return {
      count: newCount,
      disqualified: false
    };
  }

  // Request candidate admission (returns 'PENDING', 'ACCEPTED', 'DECLINED', 'DISQUALIFIED', or 'EXPIRED')
  requestAdmission(id, candidateName) {
    const interview = this.sessions.get(id);
    if (!interview) return null;

    if (!interview.candidateAdmissions) interview.candidateAdmissions = {};
    if (!interview.pendingJoinRequests) interview.pendingJoinRequests = {};

    const existingStatus = interview.candidateAdmissions[candidateName];
    if (existingStatus === 'DISQUALIFIED') {
      return 'DISQUALIFIED';
    }
    if (existingStatus === 'ACCEPTED' || existingStatus === 'DECLINED') {
      return existingStatus;
    }

    // 5-MINUTE JOIN WINDOW ENFORCEMENT FOR NEW CANDIDATE:
    if (this.isJoinWindowExpired(id)) {
      interview.candidateAdmissions[candidateName] = 'DECLINED';
      delete interview.pendingJoinRequests[candidateName];
      return 'EXPIRED';
    }

    interview.candidateAdmissions[candidateName] = 'PENDING';
    interview.pendingJoinRequests[candidateName] = {
      candidateId: candidateName,
      candidateName,
      roomId: id,
      requestedAt: new Date().toISOString()
    };

    return 'PENDING';
  }

  // Get admission status for candidate
  getAdmissionStatus(id, candidateName) {
    const interview = this.sessions.get(id);
    if (!interview || !interview.candidateAdmissions) return null;
    return interview.candidateAdmissions[candidateName] || null;
  }

  // Set admission decision by interviewer
  setAdmissionDecision(id, candidateName, decision) {
    const interview = this.sessions.get(id);
    if (!interview) return null;

    if (!interview.candidateAdmissions) interview.candidateAdmissions = {};
    if (!interview.pendingJoinRequests) interview.pendingJoinRequests = {};

    if (this.isCandidateDisqualified(id, candidateName)) {
      return 'DISQUALIFIED';
    }

    const normalized = (decision || '').toUpperCase();
    const finalDecision = normalized === 'ACCEPT' || normalized === 'ACCEPTED' ? 'ACCEPTED' : 'DECLINED';

    // 5-MINUTE JOIN WINDOW ENFORCEMENT ON PENDING CANDIDATE:
    // If interviewer tries to accept AFTER deadline and candidate was not already accepted:
    if (finalDecision === 'ACCEPTED') {
      if (this.isJoinWindowExpired(id) && !this.isCandidateAccepted(id, candidateName)) {
        interview.candidateAdmissions[candidateName] = 'DECLINED';
        delete interview.pendingJoinRequests[candidateName];
        return 'EXPIRED';
      }
    }

    interview.candidateAdmissions[candidateName] = finalDecision;
    delete interview.pendingJoinRequests[candidateName];

    return finalDecision;
  }

  // Get all currently pending join requests for interviewer
  getPendingJoinRequests(id) {
    const interview = this.sessions.get(id);
    if (!interview || !interview.pendingJoinRequests) return [];
    return Object.values(interview.pendingJoinRequests);
  }

  // Register candidate and generate or retrieve signed candidate token
  registerCandidate(id, candidateName) {
    const interview = this.sessions.get(id);
    if (!interview) return null;
    if (!interview.candidateTokens) interview.candidateTokens = {};
    if (!interview.registeredCandidates) interview.registeredCandidates = [];
    if (!interview.registeredCandidates.includes(candidateName)) {
      interview.registeredCandidates.push(candidateName);
    }
    if (!interview.assignedQuestions) interview.assignedQuestions = {};
    if (!interview.assignedQuestions[candidateName]) {
      interview.assignedQuestions[candidateName] = []; // Question: Not Assigned initially
    }
    if (!interview.candidateTokens[candidateName]) {
      interview.candidateTokens[candidateName] = createCandidateToken(id, candidateName);
    }
    return interview.candidateTokens[candidateName];
  }

  // Save isolated candidate code for a specific question
  saveCandidateCode(id, candidateId, questionId, code, language = 'python') {
    const interview = this.sessions.get(id);
    if (!interview) return null;

    if (!interview.candidateCode) interview.candidateCode = {};
    if (!interview.candidateCode[candidateId]) interview.candidateCode[candidateId] = {};

    interview.candidateCode[candidateId][questionId] = {
      code: code || '',
      language: language || 'python',
      updatedAt: new Date().toISOString()
    };

    return interview.candidateCode[candidateId][questionId];
  }

  // Save isolated candidate language for a specific question
  saveCandidateLanguage(id, candidateId, questionId, language) {
    const interview = this.sessions.get(id);
    if (!interview) return null;

    if (!interview.candidateCode) interview.candidateCode = {};
    if (!interview.candidateCode[candidateId]) interview.candidateCode[candidateId] = {};
    if (!interview.candidateCode[candidateId][questionId]) {
      interview.candidateCode[candidateId][questionId] = { code: '', language: 'python', updatedAt: new Date().toISOString() };
    }

    interview.candidateCode[candidateId][questionId].language = language;
    return interview.candidateCode[candidateId][questionId];
  }

  // Assign questions to a candidate
  assignQuestions(id, candidateId, questionIds) {
    const interview = this.sessions.get(id);
    if (!interview) return null;

    if (!interview.assignedQuestions) interview.assignedQuestions = {};
    if (!interview.registeredCandidates) interview.registeredCandidates = [];
    if (!interview.registeredCandidates.includes(candidateId)) {
      interview.registeredCandidates.push(candidateId);
    }

    const qIds = Array.isArray(questionIds) ? questionIds : [questionIds];
    interview.assignedQuestions[candidateId] = qIds;

    return interview.assignedQuestions[candidateId];
  }

  // Get assigned questions for candidate
  getAssignedQuestions(id, candidateId) {
    const interview = this.sessions.get(id);
    if (!interview) return [];

    if (!interview.assignedQuestions) return [];
    return interview.assignedQuestions[candidateId] || [];
  }

  // Save isolated candidate execution output for a specific question
  saveCandidateOutput(id, candidateId, questionId, result) {
    const interview = this.sessions.get(id);
    if (!interview) return null;

    if (!interview.candidateOutputs) interview.candidateOutputs = {};
    if (!interview.candidateOutputs[candidateId]) interview.candidateOutputs[candidateId] = {};

    interview.candidateOutputs[candidateId][questionId] = {
      ...result,
      updatedAt: new Date().toISOString()
    };

    return interview.candidateOutputs[candidateId][questionId];
  }

  // Get isolated candidate execution output for a specific question
  getCandidateOutput(id, candidateId, questionId) {
    const interview = this.sessions.get(id);
    if (!interview || !interview.candidateOutputs) return null;
    return interview.candidateOutputs[candidateId]?.[questionId] || null;
  }

  updateCode(id, { code, language }) {
    const interview = this.sessions.get(id);
    if (!interview) return null;
    if (code !== undefined) interview.code = code;
    if (language !== undefined) interview.language = language;
    return interview;
  }

  updateProblem(id, problemId) {
    const interview = this.sessions.get(id);
    if (!interview) return null;
    interview.problemId = problemId;
    return interview;
  }

  updateEvaluation(id, evaluationData, candidateId = null) {
    const interview = this.sessions.get(id);
    if (!interview) return null;
    if (!interview.candidateNotes) {
      interview.candidateNotes = {};
    }

    const cleanCandId = (candidateId || evaluationData?.candidateId || '').trim();

    if (cleanCandId) {
      const existing = interview.candidateNotes[cleanCandId] || {
        communicationRating: 0,
        problemSolvingRating: 0,
        technicalRating: 0,
        comments: '',
        overallScore: 0
      };
      const updated = {
        ...existing,
        ...evaluationData,
        candidateId: cleanCandId,
        updatedAt: new Date().toISOString()
      };
      interview.candidateNotes[cleanCandId] = updated;
      interview.privateNotes = updated;
      return updated;
    }

    interview.privateNotes = {
      ...interview.privateNotes,
      ...evaluationData,
      updatedAt: new Date().toISOString()
    };
    return interview.privateNotes;
  }

  getCandidateNotes(id, candidateId = null) {
    const interview = this.sessions.get(id);
    if (!interview) return null;
    if (candidateId) {
      return interview.candidateNotes?.[candidateId] || null;
    }
    return interview.candidateNotes || {};
  }

  isCandidateRegistered(id, candidateName) {
    const interview = this.sessions.get(id);
    if (!interview || !interview.registeredCandidates) return false;
    return interview.registeredCandidates.includes(candidateName);
  }

  saveSubmission(id, candidateId, submissionData) {
    const interview = this.sessions.get(id);
    if (!interview) return null;
    if (!interview.candidateSubmissions) interview.candidateSubmissions = {};
    const candId = candidateId || submissionData?.candidateId || 'Candidate';
    const record = {
      ...submissionData,
      candidateId: candId,
      submittedAt: new Date().toISOString()
    };
    interview.candidateSubmissions[candId] = record;
    interview.submission = record;
    return record;
  }

  endInterview(id, finalEvaluation) {
    const interview = this.sessions.get(id);
    if (!interview) return null;
    interview.status = 'completed';
    interview.completedAt = new Date().toISOString();
    if (finalEvaluation && typeof finalEvaluation === 'object') {
      if (finalEvaluation.candidateNotes) {
        interview.candidateNotes = {
          ...(interview.candidateNotes || {}),
          ...finalEvaluation.candidateNotes
        };
      }
      if (finalEvaluation.candidateId) {
        interview.candidateNotes = interview.candidateNotes || {};
        interview.candidateNotes[finalEvaluation.candidateId] = {
          ...(interview.candidateNotes[finalEvaluation.candidateId] || {}),
          ...finalEvaluation
        };
      }
      interview.privateNotes = {
        ...interview.privateNotes,
        ...finalEvaluation
      };
    }
    return interview;
  }

  setParticipantStatus(id, role, isJoined) {
    const interview = this.sessions.get(id);
    if (!interview) return null;
    if (role === 'interviewer') {
      interview.participants.interviewerJoined = isJoined;
    } else if (role === 'candidate') {
      interview.participants.candidateJoined = isJoined;
    }
    return interview.participants;
  }

  exists(id) {
    return this.sessions.has(id);
  }
}

export const interviewStore = new InterviewStore();
