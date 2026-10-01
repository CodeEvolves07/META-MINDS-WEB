export const PROBLEMS = [
  {
    id: 'find-largest-element',
    title: '1. Find Largest Element in an Array',
    difficulty: 'Easy',
    category: 'Array',
    description: 'Given an array of integers `nums`, find and return the largest element present in the array.',
    inputFormat: 'A space-separated list of integers.',
    outputFormat: 'Return a single integer representing the maximum value.',
    constraints: [
      '1 <= nums.length <= 10^5',
      '-10^9 <= nums[i] <= 10^9'
    ],
    sampleInput: '3 5 1 9 2',
    sampleOutput: '9',
    explanation: 'The numbers in the array are 3, 5, 1, 9, 2. The largest among them is 9.',
    starterCode: {
      python: '',
      javascript: '',
      java: '',
      cpp: ''
    },
    testCases: [
      { input: '3 5 1 9 2', expectedOutput: '9' },
      { input: '-10 -5 -20 -1', expectedOutput: '-1' },
      { input: '42', expectedOutput: '42' }
    ]
  },
  {
    id: 'reverse-string',
    title: '2. Reverse a String',
    difficulty: 'Easy',
    category: 'String',
    description: 'Write a program that takes a string `s` from standard input, reverses it, and prints the reversed result.',
    inputFormat: 'A string `s`.',
    outputFormat: 'Return the reversed string.',
    constraints: [
      '1 <= s.length <= 10^5',
      's consists of printable ASCII characters.'
    ],
    sampleInput: 'hello',
    sampleOutput: 'olleh',
    explanation: 'The characters in "hello" reversed are "olleh".',
    starterCode: {
      python: '',
      javascript: '',
      java: '',
      cpp: ''
    },
    testCases: [
      { input: 'hello', expectedOutput: 'olleh' },
      { input: 'CodeMeet', expectedOutput: 'teeMedoC' },
      { input: 'racecar', expectedOutput: 'racecar' }
    ]
  },
  {
    id: 'is-prime',
    title: '3. Check Whether a Number is Prime',
    difficulty: 'Medium',
    category: 'Math',
    description: 'Given an integer `n`, determine whether it is a prime number. Output "true" if prime, otherwise "false".',
    inputFormat: 'A single integer `n`.',
    outputFormat: 'Print "true" if the number is prime, or "false" if composite or <= 1.',
    constraints: [
      '1 <= n <= 10^9'
    ],
    sampleInput: '29',
    sampleOutput: 'true',
    explanation: '29 is divisible only by 1 and 29, so it is a prime number.',
    starterCode: {
      python: '',
      javascript: '',
      java: '',
      cpp: ''
    },
    testCases: [
      { input: '29', expectedOutput: 'true' },
      { input: '4', expectedOutput: 'false' },
      { input: '1', expectedOutput: 'false' }
    ]
  },
  {
    id: 'binary-search',
    title: '4. Binary Search',
    difficulty: 'Medium',
    category: 'Searching',
    description: 'Given an integer `target` on line 1, and an array of sorted unique integers on line 2, output the index (0-based) of `target`. Output -1 if not found.',
    inputFormat: 'First line: target value. Second line: space-separated sorted integers.',
    outputFormat: 'Return the index of target, or -1 if not found.',
    constraints: [
      '1 <= nums.length <= 10^5',
      '-10^4 < nums[i], target < 10^4'
    ],
    sampleInput: '9\n-1 0 3 5 9 12',
    sampleOutput: '4',
    explanation: '9 exists in nums and its index is 4.',
    starterCode: {
      python: '',
      javascript: '',
      java: '',
      cpp: ''
    },
    testCases: [
      { input: '9\n-1 0 3 5 9 12', expectedOutput: '4' },
      { input: '2\n-1 0 3 5 9 12', expectedOutput: '-1' }
    ]
  },
  {
    id: 'two-sum',
    title: '5. Two Sum',
    difficulty: 'Easy',
    category: 'Hash Table',
    description: 'Given target on line 1 and space-separated integers on line 2, find two numbers that add up to target. Print their two 0-based indices separated by a space.',
    inputFormat: 'First line: target value. Second line: space-separated integers.',
    outputFormat: 'Two space-separated 0-based indices `i j`.',
    constraints: [
      '2 <= nums.length <= 10^4',
      '-10^9 <= nums[i] <= 10^9'
    ],
    sampleInput: '9\n2 7 11 15',
    sampleOutput: '0 1',
    explanation: 'nums[0] + nums[1] == 2 + 7 == 9.',
    starterCode: {
      python: '',
      javascript: '',
      java: '',
      cpp: ''
    },
    testCases: [
      { input: '9\n2 7 11 15', expectedOutput: '0 1' },
      { input: '6\n3 2 4', expectedOutput: '1 2' }
    ]
  },
  {
    id: 'valid-palindrome',
    title: '6. Valid Palindrome',
    difficulty: 'Easy',
    category: 'String',
    description: 'A phrase is a palindrome if, after converting all uppercase letters into lowercase letters and removing all non-alphanumeric characters, it reads the same forward and backward. Print "true" or "false".',
    inputFormat: 'A string line.',
    outputFormat: 'Print "true" or "false".',
    constraints: [
      '1 <= s.length <= 2 * 10^5'
    ],
    sampleInput: 'A man, a plan, a canal: Panama',
    sampleOutput: 'true',
    explanation: '"amanaplanacanalpanama" is a palindrome.',
    starterCode: {
      python: '',
      javascript: '',
      java: '',
      cpp: ''
    },
    testCases: [
      { input: 'A man, a plan, a canal: Panama', expectedOutput: 'true' },
      { input: 'race a car', expectedOutput: 'false' }
    ]
  },
  {
    id: 'fizzbuzz',
    title: '7. FizzBuzz',
    difficulty: 'Easy',
    category: 'Math',
    description: 'Given an integer `n`, for each integer `i` from 1 to `n`: print "FizzBuzz" if `i` is divisible by 3 and 5, "Fizz" if divisible by 3, "Buzz" if divisible by 5, or the number `i` otherwise. Each on a new line.',
    inputFormat: 'A single integer `n`.',
    outputFormat: 'n lines of output.',
    constraints: [
      '1 <= n <= 10^4'
    ],
    sampleInput: '5',
    sampleOutput: '1\n2\nFizz\n4\nBuzz',
    explanation: '1, 2, Fizz, 4, Buzz.',
    starterCode: {
      python: '',
      javascript: '',
      java: '',
      cpp: ''
    },
    testCases: [
      { input: '5', expectedOutput: '1\n2\nFizz\n4\nBuzz' },
      { input: '3', expectedOutput: '1\n2\nFizz' }
    ]
  },
  {
    id: 'factorial',
    title: '8. Factorial of a Number',
    difficulty: 'Easy',
    category: 'Math',
    description: 'Given an integer `n`, compute and print its factorial (n!). For n = 0, factorial is 1.',
    inputFormat: 'A non-negative integer `n`.',
    outputFormat: 'Return the factorial as an integer.',
    constraints: [
      '0 <= n <= 20'
    ],
    sampleInput: '5',
    sampleOutput: '120',
    explanation: '5! = 5 * 4 * 3 * 2 * 1 = 120.',
    starterCode: {
      python: '',
      javascript: '',
      java: '',
      cpp: ''
    },
    testCases: [
      { input: '5', expectedOutput: '120' },
      { input: '0', expectedOutput: '1' }
    ]
  },
  {
    id: 'max-subarray',
    title: '9. Maximum Subarray Sum',
    difficulty: 'Medium',
    category: 'Array',
    description: 'Given an integer array `nums`, find the subarray with the largest sum, and print its sum (Kadane algorithm).',
    inputFormat: 'Space-separated integers.',
    outputFormat: 'A single integer (maximum subarray sum).',
    constraints: [
      '1 <= nums.length <= 10^5',
      '-10^4 <= nums[i] <= 10^4'
    ],
    sampleInput: '-2 1 -3 4 -1 2 1 -5 4',
    sampleOutput: '6',
    explanation: 'The subarray [4, -1, 2, 1] has the largest sum = 6.',
    starterCode: {
      python: '',
      javascript: '',
      java: '',
      cpp: ''
    },
    testCases: [
      { input: '-2 1 -3 4 -1 2 1 -5 4', expectedOutput: '6' },
      { input: '1', expectedOutput: '1' },
      { input: '5 4 -1 7 8', expectedOutput: '23' }
    ]
  }
];

export const DEFAULT_PROBLEM = PROBLEMS[0];
