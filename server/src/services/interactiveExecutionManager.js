import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Path resolution for runtimes
const PYTHON_BIN = fs.existsSync('/Library/Frameworks/Python.framework/Versions/3.14/bin/python3')
  ? '/Library/Frameworks/Python.framework/Versions/3.14/bin/python3'
  : 'python3';

const NODE_BIN = fs.existsSync('/Users/shatabdimaikap/.local/node/bin/node')
  ? '/Users/shatabdimaikap/.local/node/bin/node'
  : 'node';

const MACOS_SDK = fs.existsSync('/Library/Developer/CommandLineTools/SDKs/MacOSX15.4.sdk')
  ? '/Library/Developer/CommandLineTools/SDKs/MacOSX15.4.sdk'
  : (fs.existsSync('/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk')
      ? '/Library/Developer/CommandLineTools/SDKs/MacOSX.sdk'
      : null);

// Maximum output buffer size per execution (500 KB to prevent memory exhaustion)
const MAX_OUTPUT_SIZE = 500 * 1024;
// Maximum lifetime for an interactive process (45 seconds)
const MAX_SESSION_TIMEOUT_MS = 45 * 1000;

class InteractiveExecutionManager {
  constructor() {
    this.sessions = new Map(); // sessionId -> sessionData
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Start a real persistent interactive process with live streaming stdin/stdout/stderr
   */
  async startSession({
    roomId,
    candidateId,
    questionId,
    code,
    language = 'python',
    onOutput, // ({ stream: 'stdout' | 'stderr' | 'system', data: string }) => void
    onExit,   // ({ exitCode: number, signal: string, totalOutput: string }) => void
    onError   // (err: Error) => void
  }) {
    // 1. Terminate any existing running process for this candidate in this room
    this.killCandidateSession(roomId, candidateId, 'Replaced by new execution');

    const trimmedCode = (code || '').trim();
    if (!trimmedCode) {
      if (onError) {
        onError(new Error('Cannot execute empty code. Write your solution in the editor before running.'));
      }
      return null;
    }

    const sessionId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const lang = (language || 'python').toLowerCase();

    // 2. Create isolated sandbox scratch directory with restricted permissions
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `codemeet_run_${sessionId}_`));

    let proc = null;
    let totalOutputLength = 0;
    let fullOutput = '';
    let isTerminated = false;

    // Sanitized environment variables: NEVER leak JWT secrets, API keys, or database credentials
    const sanitizedEnv = {
      PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
      LANG: 'en_US.UTF-8',
      LC_ALL: 'en_US.UTF-8',
      PYTHONUNBUFFERED: '1',
      NODE_PATH: process.env.NODE_PATH || ''
    };

    try {
      if (lang === 'python') {
        const filePath = path.join(tmpDir, 'solution.py');
        fs.writeFileSync(filePath, code, 'utf8');

        // -u: unbuffered stdin/stdout/stderr (crucial for real-time prompt display)
        // -B: do not write bytecode (.pyc)
        // -I: isolate from user environment variables
        proc = spawn(PYTHON_BIN, ['-u', '-B', '-I', filePath], {
          cwd: tmpDir,
          env: sanitizedEnv,
          stdio: ['pipe', 'pipe', 'pipe']
        });
      } else if (lang === 'javascript' || lang === 'js') {
        const filePath = path.join(tmpDir, 'solution.js');
        fs.writeFileSync(filePath, code, 'utf8');

        proc = spawn(NODE_BIN, ['--max-old-space-size=64', filePath], {
          cwd: tmpDir,
          env: sanitizedEnv,
          stdio: ['pipe', 'pipe', 'pipe']
        });
      } else if (lang === 'cpp' || lang === 'c++') {
        const srcPath = path.join(tmpDir, 'solution.cpp');
        const binPath = path.join(tmpDir, 'solution_bin');
        fs.writeFileSync(srcPath, code, 'utf8');

        // Compile locally
        const compileArgs = ['-O2', '-std=c++17', srcPath, '-o', binPath];
        if (MACOS_SDK) {
          compileArgs.unshift('-isysroot', MACOS_SDK);
        }

        onOutput({ sessionId, stream: 'system', data: '[Compiling C++ solution...]\n' });

        const compileProc = spawn('/usr/bin/clang++', compileArgs, {
          cwd: tmpDir,
          env: sanitizedEnv
        });

        let compileErr = '';
        compileProc.stderr.on('data', (d) => { compileErr += d.toString(); });

        const compileExitCode = await new Promise((resolve) => {
          compileProc.on('close', resolve);
        });

        if (compileExitCode !== 0) {
          onOutput({ sessionId, stream: 'stderr', data: `Compilation Error:\n${compileErr}\n` });
          this.cleanupTmp(tmpDir);
          if (onExit) onExit({ sessionId, exitCode: compileExitCode, signal: null, totalOutput: compileErr });
          return null;
        }

        proc = spawn(binPath, [], {
          cwd: tmpDir,
          env: sanitizedEnv,
          stdio: ['pipe', 'pipe', 'pipe']
        });
      } else {
        // Fallback for languages without local interactive runner
        onOutput({
          sessionId,
          stream: 'stderr',
          data: `Error: Interactive terminal currently supports Python, JavaScript, and C++. Unsupported: ${language}\n`
        });
        this.cleanupTmp(tmpDir);
        if (onExit) onExit({ sessionId, exitCode: 1, signal: null, totalOutput: 'Unsupported language' });
        return null;
      }
    } catch (launchErr) {
      this.cleanupTmp(tmpDir);
      if (onError) onError(launchErr);
      return null;
    }

    if (!proc || !proc.pid) {
      this.cleanupTmp(tmpDir);
      if (onError) onError(new Error('Failed to spawn sandboxed execution process.'));
      return null;
    }

    // Safety Watchdog Timer: Kill infinite loops or abandoned processes
    const watchdogTimer = setTimeout(() => {
      if (!isTerminated && proc) {
        isTerminated = true;
        onOutput({
          stream: 'stderr',
          data: '\n[Time Limit Exceeded: Process terminated after 45 seconds]\n'
        });
        try { proc.kill('SIGKILL'); } catch (e) {}
      }
    }, MAX_SESSION_TIMEOUT_MS);

    const session = {
      id: sessionId,
      roomId,
      candidateId,
      questionId,
      language: lang,
      process: proc,
      tmpDir,
      watchdogTimer,
      createdAt: Date.now(),
      getFullOutput: () => fullOutput,
      appendStdin: (input) => {
        totalOutputLength += input.length;
        fullOutput += input;
      }
    };

    this.sessions.set(sessionId, session);

    // Stream process stdout in real time
    proc.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      totalOutputLength += text.length;
      fullOutput += text;

      if (totalOutputLength > MAX_OUTPUT_SIZE) {
        if (!isTerminated) {
          isTerminated = true;
          onOutput({
            stream: 'stderr',
            data: '\n[Output Limit Exceeded: Output capped at 500 KB to preserve memory]\n'
          });
          try { proc.kill('SIGKILL'); } catch (e) {}
        }
        return;
      }

      onOutput({ sessionId, stream: 'stdout', data: text });
    });

    // Stream process stderr in real time
    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      totalOutputLength += text.length;
      fullOutput += text;

      if (totalOutputLength > MAX_OUTPUT_SIZE) {
        if (!isTerminated) {
          isTerminated = true;
          try { proc.kill('SIGKILL'); } catch (e) {}
        }
        return;
      }

      onOutput({ sessionId, stream: 'stderr', data: text });
    });

    // Process termination listener
    proc.on('close', (exitCode, signal) => {
      clearTimeout(watchdogTimer);
      this.sessions.delete(sessionId);
      this.cleanupTmp(tmpDir);

      if (onExit) {
        onExit({
          sessionId,
          exitCode: exitCode !== null ? exitCode : (signal ? 1 : 0),
          signal,
          totalOutput: fullOutput
        });
      }
    });

    proc.on('error', (err) => {
      clearTimeout(watchdogTimer);
      this.sessions.delete(sessionId);
      this.cleanupTmp(tmpDir);
      if (onError) onError(err);
    });

    return session;
  }

  /**
   * Forward candidate input to the live process stdin
   */
  writeStdin(sessionId, input) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.process || session.process.killed) {
      return false;
    }

    if (session.process.stdin && session.process.stdin.writable) {
      session.process.stdin.write(input);
      if (typeof session.appendStdin === 'function') {
        session.appendStdin(input);
      }
      return true;
    }

    return false;
  }

  /**
   * Terminate a specific execution session
   */
  killSession(sessionId, reason = 'Stopped by user') {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    clearTimeout(session.watchdogTimer);
    try {
      if (session.process && !session.process.killed) {
        session.process.kill('SIGKILL');
      }
    } catch (e) {}

    this.sessions.delete(sessionId);
    this.cleanupTmp(session.tmpDir);
    return true;
  }

  /**
   * Terminate any running session for a candidate in a room
   */
  killCandidateSession(roomId, candidateId, reason = 'Cleanup') {
    for (const [id, session] of this.sessions.entries()) {
      if (session.roomId === roomId && session.candidateId === candidateId) {
        this.killSession(id, reason);
      }
    }
  }

  /**
   * Terminate all active sessions for an interview room (on interview end)
   */
  cleanupRoom(roomId) {
    for (const [id, session] of this.sessions.entries()) {
      if (session.roomId === roomId) {
        this.killSession(id, 'Room cleanup');
      }
    }
  }

  cleanupTmp(tmpDir) {
    if (tmpDir && fs.existsSync(tmpDir)) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (e) {
        // Ignore unlink errors
      }
    }
  }
}

export const interactiveExecutionManager = new InteractiveExecutionManager();
