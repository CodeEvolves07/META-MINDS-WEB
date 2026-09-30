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

  // Candidate joins interview session (Issues signed candidate token)
  joinInterview: async (roomId, candidateName) => {
    const res = await apiClient.post(`/interviews/${roomId}/join`, {
      candidateName
    });
    return res.data;
  },

  // Fetch interview details
  getInterview: async (roomId, role = 'candidate', candidateId = null, token = null) => {
    const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};
    const res = await apiClient.get(`/interviews/${roomId}`, {
      headers: {
        'x-user-role': role,
        ...(candidateId ? { 'x-candidate-id': candidateId } : {}),
        ...authHeaders
      },
      params: {
        role,
        ...(candidateId ? { candidateId } : {})
      }
    });
    return res.data;
  },

  // Interviewer assigns question to candidate (INTERVIEWER ONLY)
  assignQuestion: async (roomId, candidateId, questionId) => {
    const res = await apiClient.post(`/interviews/${roomId}/assign-question`, {
      candidateId,
      questionId
    }, {
      headers: {
        'x-user-role': 'interviewer'
      }
    });
    return res.data;
  },

  // Save interviewer private notes (INTERVIEWER ONLY)
  saveNotes: async (roomId, notesData, role = 'interviewer') => {
    const res = await apiClient.put(`/interviews/${roomId}/notes`, {
      ...notesData,
      role
    }, {
      headers: {
        'x-user-role': role
      }
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

  // Get final report
  getReport: async (roomId, role = 'candidate') => {
    const res = await apiClient.get(`/interviews/${roomId}/report`, {
      headers: {
        'x-user-role': role
      }
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
