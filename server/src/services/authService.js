import crypto from 'crypto';

// Server-side HMAC secret for signing authentication tokens
const AUTH_SECRET = process.env.AUTH_SECRET || 'codemeet_secure_auth_secret_token_2026_x7k9!';

// Default token validity: 24 hours
const DEFAULT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Generate a cryptographically signed HMAC-SHA256 token (JWT format)
 * @param {Object} payload Claims: { roomId, role, candidateId, userName, exp }
 * @param {number} ttlMs Time-to-live in milliseconds
 * @returns {string} Token
 */
export function generateToken(payload, ttlMs = DEFAULT_TOKEN_TTL_MS) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const now = Date.now();
  const body = Buffer.from(JSON.stringify({
    ...payload,
    iat: now,
    exp: payload.exp !== undefined ? payload.exp : (now + ttlMs)
  })).toString('base64url');

  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${signature}`;
}

/**
 * Verify and decode an HMAC-SHA256 token
 * Validates signature with timing-safe comparison and enforces token expiration
 * @param {string} token
 * @returns {Object|null} Decoded payload or null if invalid or expired
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

  // Constant-time signature verification to prevent timing side-channel attacks
  try {
    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return null;
    }
  } catch (err) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    
    // Enforce token expiration (reject expired authentication)
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Create an authenticated interviewer token bound to a specific room
 */
export function createInterviewerToken(roomId, interviewerName = 'Interviewer', ttlMs = DEFAULT_TOKEN_TTL_MS) {
  return generateToken({
    roomId,
    role: 'interviewer',
    candidateId: null,
    userName: interviewerName
  }, ttlMs);
}

/**
 * Create an authenticated candidate token bound to a specific room and candidate identity
 */
export function createCandidateToken(roomId, candidateName = 'Candidate', ttlMs = DEFAULT_TOKEN_TTL_MS) {
  return generateToken({
    roomId,
    role: 'candidate',
    candidateId: candidateName,
    userName: candidateName
  }, ttlMs);
}

/**
 * Extract token from HTTP request (Authorization header, x-auth-token header, or request body)
 * Prohibits extracting tokens from URLs / query parameters (Requirement 8 & 25)
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

  if (req.body && req.body.token && typeof req.body.token === 'string') {
    return req.body.token.trim();
  }

  return null;
}
