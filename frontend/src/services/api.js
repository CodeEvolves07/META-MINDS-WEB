const getApiBaseUrl = () => {
  if (import.meta.env.VITE_SIGNALING_SERVER_URL) {
    return import.meta.env.VITE_SIGNALING_SERVER_URL;
  }
  const hostname = typeof window !== 'undefined' ? window.location.hostname || 'localhost' : 'localhost';
  return `${window.location.protocol}//${hostname}:5000`;
};

const API_BASE_URL = getApiBaseUrl();

// Create Interviewer Session & generate unique Candidate code
export async function createInterviewerSession({ interviewerName, customRoomId = "" }) {
  const response = await fetch(`${API_BASE_URL}/api/auth/create-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ interviewerName, customRoomId })
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to create interviewer session");
  }
  return data;
}

// Verify Candidate Code and enter room
export async function verifyCandidateCode({ candidateCode, candidateName }) {
  const response = await fetch(`${API_BASE_URL}/api/auth/candidate-verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ candidateCode, candidateName })
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to verify candidate code");
  }
  return data;
}

export async function loginUser({ role, username, roomId, passcode }) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, username, roomId, passcode })
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.error || "Failed to authenticate into interview room");
  }
  return data;
}

export async function validateRoom(roomId) {
  const response = await fetch(`${API_BASE_URL}/api/rooms/${encodeURIComponent(roomId)}/validate`);
  if (!response.ok) throw new Error("Room validation check failed");
  return await response.json();
}

export async function fetchProblems() {
  const response = await fetch(`${API_BASE_URL}/api/problems`);
  if (!response.ok) throw new Error("Failed to load problems");
  const data = await response.json();
  return data.problems;
}

export async function fetchProblemById(id) {
  const response = await fetch(`${API_BASE_URL}/api/problems/${id}`);
  if (!response.ok) throw new Error("Failed to load problem details");
  const data = await response.json();
  return data.problem;
}

export async function runCode({ language, sourceCode, stdin = "", roomId }) {
  const response = await fetch(`${API_BASE_URL}/api/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ language, sourceCode, stdin, roomId })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Code execution failed on server");
  }
  return await response.json();
}

export async function saveSessionReport(roomId, reportPayload) {
  const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reportPayload)
  });
  if (!response.ok) throw new Error("Failed to save session report");
  return await response.json();
}

export async function fetchSessionSummary(roomId) {
  const response = await fetch(`${API_BASE_URL}/api/rooms/${roomId}/summary`);
  if (!response.ok) throw new Error("Failed to retrieve session summary");
  return await response.json();
}
