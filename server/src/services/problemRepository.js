// Approved Question Repository
// Approved question IDs matching the existing question catalog
export const APPROVED_PROBLEMS = [
  'find-largest-element',
  'reverse-string',
  'is-prime',
  'binary-search',
  'two-sum',
  'valid-palindrome',
  'fizzbuzz',
  'factorial',
  'max-subarray',
  // Backwards compatibility for existing test suite mock questions
  'valid-parentheses',
  'longest-substring',
  'factorial-calc'
];

export function isApprovedProblem(problemId) {
  return typeof problemId === 'string' && APPROVED_PROBLEMS.includes(problemId.trim());
}
