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
    }

    return safeInterview;
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

  updateEvaluation(id, evaluationData) {
    const interview = this.sessions.get(id);
    if (!interview) return null;
    interview.privateNotes = {
      ...interview.privateNotes,
      ...evaluationData
    };
    return interview.privateNotes;
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
    if (finalEvaluation) {
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
