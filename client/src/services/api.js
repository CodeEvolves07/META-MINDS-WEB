import axios from 'axios';

const API_BASE = '/api';

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Attach authenticated session token if available in localStorage
apiClient.interceptors.request.use((config) => {
  const match = config.url?.match(/\/interviews\/([A-Za-z0-9]+)/);
  if (match && match[1]) {
    const roomId = match[1];
    const token = localStorage.getItem(`codemeet_token_${roomId}`);
    if (token && !config.headers['Authorization']) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});

export const api = {
  // Create a new interview session (Issues signed interviewer token)
  createInterview: async ({ interviewerName, candidateName, problemId }) => {
    const res = await apiClient.post('/interviews', {
      interviewerName,
      candidateName,
      problemId
    });
    return res.data;
  },

  // Candidate joins interview session (Issues signed candidate token & requests admission)
  joinInterview: async (roomId, candidateName) => {
    const res = await apiClient.post(`/interviews/${roomId}/join`, {
      candidateName
    });
    return res.data;
  },

  // Validate interview code and check deadline (Public room check - no private candidate data)
  validateInterview: async (roomId, candidateId = null) => {
    const res = await apiClient.post(`/interviews/${roomId}/validate`, {
      candidateId
    });
    return res.data;
  },

  // Get candidate admission status (POST required)
  getAdmissionStatus: async (roomId, candidateId = null) => {
    const res = await apiClient.post(`/interviews/${roomId}/admission-status`, {
      candidateId
    });
    return res.data;
  },

  // Interviewer gets pending admission requests (POST required)
  getPendingRequests: async (roomId) => {
    const res = await apiClient.post(`/interviews/${roomId}/pending-requests`);
    return res.data;
  },

  // Interviewer decides admission (ACCEPT | DECLINE)
  decideAdmission: async (roomId, candidateId, decision) => {
    const res = await apiClient.post(`/interviews/${roomId}/admission-decision`, {
      candidateId,
      decision
    });
    return res.data;
  },

  // Fetch interview details (POST required)
  getInterview: async (roomId, role = 'candidate', candidateId = null, token = null) => {
    const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};
    const res = await apiClient.post(`/interviews/${roomId}/session`, {
      candidateId
    }, {
      headers: {
        ...authHeaders
      }
    });
    return res.data;
  },

  // Interviewer assigns question to candidate (INTERVIEWER ONLY)
  assignQuestion: async (roomId, candidateId, questionId) => {
    const res = await apiClient.post(`/interviews/${roomId}/assign-question`, {
      candidateId,
      questionId
    });
    return res.data;
  },

  // Save interviewer private notes (INTERVIEWER ONLY - POST)
  saveNotes: async (roomId, notesData) => {
    const res = await apiClient.post(`/interviews/${roomId}/notes`, notesData);
    return res.data;
  },

  // Get candidate private notes (INTERVIEWER ONLY - POST)
  getCandidateNotes: async (roomId, candidateId = null) => {
    const res = await apiClient.post(`/interviews/${roomId}/candidate-notes`, {
      candidateId
    });
    return res.data;
  },

  // Submit candidate code
  submitCode: async (roomId, submissionData) => {
    const res = await apiClient.post(`/interviews/${roomId}/submit`, submissionData);
    return res.data;
  },

  // End interview
  endInterview: async (roomId, finalEvaluation) => {
    const res = await apiClient.post(`/interviews/${roomId}/end`, { finalEvaluation });
    return res.data;
  },

  // Get final report (POST required)
  getReport: async (roomId, role = 'candidate', candidateId = null) => {
    const res = await apiClient.post(`/interviews/${roomId}/report`, {
      candidateId
    });
    return res.data;
  },

  // Run code via Judge0 CE API or sandbox
  runCode: async ({ source_code, language, stdin = '' }) => {
    const res = await apiClient.post('/judge0/run', {
      source_code,
      language,
      stdin: typeof stdin === 'string' ? stdin : ''
    });
    return res.data;
  },

  // Fetch STUN & TURN ICE servers from backend
  getIceServers: async () => {
    try {
      const res = await apiClient.get('/webrtc/ice-servers');
      return res.data?.iceServers || null;
    } catch (err) {
      console.warn('Could not fetch ICE servers from backend, using defaults:', err.message);
      return null;
    }
  }
};
