import crypto from 'crypto';

// Server-side HMAC secret for signing authentication tokens
const AUTH_SECRET = process.env.AUTH_SECRET || 'codemeet_secure_auth_secret_token_2026_x7k9!';

/**
 * Generate a cryptographically signed HMAC-SHA256 token (JWT format)
 * @param {Object} payload Claims: { roomId, role, candidateId, userName }
 * @returns {string} Token
 */
export function generateToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: Date.now()
  })).toString('base64url');

  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
}

/**
 * Verify and decode an HMAC-SHA256 token
 * @param {string} token
 * @returns {Object|null} Decoded payload or null if invalid
 */
export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;

  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [header, body, signature] = parts;

  const expectedSignature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  if (signature !== expectedSignature) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Create an authenticated interviewer token bound to a specific room
 */
export function createInterviewerToken(roomId, interviewerName = 'Interviewer') {
  return generateToken({
    roomId,
    role: 'interviewer',
    candidateId: null,
    userName: interviewerName
  });
}

/**
 * Create an authenticated candidate token bound to a specific room and candidate identity
 */
export function createCandidateToken(roomId, candidateName = 'Candidate') {
  return generateToken({
    roomId,
    role: 'candidate',
    candidateId: candidateName,
    userName: candidateName
  });
}

/**
 * Extract token from HTTP request (Authorization header, x-auth-token header, or query param)
 */
export function extractToken(req) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  const xAuthToken = req.headers['x-auth-token'];
  if (xAuthToken && typeof xAuthToken === 'string') {
    return xAuthToken.trim();
  }

  if (req.query && req.query.token && typeof req.query.token === 'string') {
    return req.query.token.trim();
  }

  return null;
}
