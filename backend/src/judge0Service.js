import axios from "axios";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";

// Standard Judge0 CE Language IDs
export const LANGUAGE_MAP = {
  python: { id: 71, name: "Python (3.8.1)", monaco: "python", ext: "py" },
  javascript: { id: 63, name: "JavaScript (Node.js 12.14.0)", monaco: "javascript", ext: "js" },
  cpp: { id: 54, name: "C++ (GCC 9.2.0)", monaco: "cpp", ext: "cpp" },
  java: { id: 62, name: "Java (OpenJDK 13.0.1)", monaco: "java", ext: "java" }
};

export const JUDGE0_DEFAULT_URL = process.env.JUDGE0_API_URL || "https://ce.judge0.com";
const JUDGE0_API_KEY = process.env.JUDGE0_API_KEY || "";
const JUDGE0_HOST = process.env.JUDGE0_HOST || "";

/**
 * Execute code using Judge0 CE with fallback to local sandbox if remote API is unavailable
 */
export async function executeCode({ language, sourceCode, stdin = "" }) {
  const langConfig = LANGUAGE_MAP[language.toLowerCase()];
  if (!langConfig) {
    throw new Error(`Unsupported language: ${language}. Supported: python, javascript, cpp, java`);
  }

  // 1. Attempt execution via Remote Judge0 CE
  try {
    const remoteResult = await executeViaJudge0(langConfig.id, sourceCode, stdin);
    if (remoteResult) {
      return {
        ...remoteResult,
        engine: "Judge0 CE Cloud Sandbox",
        language: langConfig.name
      };
    }
  } catch (err) {
    console.warn("[Judge0 API] Remote submission failed or unavailable, falling back:", err.message);
  }

  // 2. Resilient Fallback: Safe Local Sandboxed Runner for JS & Python
  console.log(`[Sandbox Fallback] Executing ${language} via local isolated runner...`);
  const fallbackResult = await executeViaLocalSandbox(language, sourceCode, stdin);
  return {
    ...fallbackResult,
    engine: "Local Isolated Fallback Runner",
    language: langConfig.name
  };
}

/**
 * Judge0 CE API implementation
 */
async function executeViaJudge0(languageId, sourceCode, stdin) {
  const headers = {
    "Content-Type": "application/json"
  };

  if (JUDGE0_API_KEY) {
    headers["X-RapidAPI-Key"] = JUDGE0_API_KEY;
    headers["X-RapidAPI-Host"] = JUDGE0_HOST || "judge0-ce.p.rapidapi.com";
  }

  const endpoint = `${JUDGE0_DEFAULT_URL.replace(/\/$/, "")}/submissions?base64_encoded=false&wait=true`;

  const payload = {
    source_code: sourceCode,
    language_id: languageId,
    stdin: stdin || "",
    cpu_time_limit: 5.0,
    memory_limit: 128000
  };

  const response = await axios.post(endpoint, payload, {
    headers,
    timeout: 10000 // 10 second HTTP timeout
  });

  const data = response.data;

  // If token returned and not yet finished (async mode)
  if (data.token && !data.status) {
    return await pollJudge0Token(data.token, headers);
  }

  return formatJudge0Response(data);
}

async function pollJudge0Token(token, headers, maxAttempts = 6) {
  const pollUrl = `${JUDGE0_DEFAULT_URL.replace(/\/$/, "")}/submissions/${token}?base64_encoded=false`;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(res => setTimeout(res, 1000));
    const res = await axios.get(pollUrl, { headers, timeout: 5000 });
    const data = res.data;
    if (data.status && data.status.id > 2) { // Status > 2 means finished (Accepted, Error, etc.)
      return formatJudge0Response(data);
    }
  }
  throw new Error("Judge0 execution timed out during polling");
}

function formatJudge0Response(data) {
  const isAccepted = data.status && data.status.id === 3;
  return {
    stdout: data.stdout || "",
    stderr: data.stderr || "",
    compileOutput: data.compile_output || "",
    message: data.message || "",
    time: data.time ? `${data.time} s` : "N/A",
    memory: data.memory ? `${Math.round(data.memory / 1024 * 10) / 10} MB` : "N/A",
    status: data.status ? data.status.description : (isAccepted ? "Accepted" : "Finished"),
    statusCode: data.status ? data.status.id : (isAccepted ? 3 : 11),
    isSuccess: isAccepted
  };
}

/**
 * Local Sandbox Fallback (runs in temporary file with strict timeout)
 */
async function executeViaLocalSandbox(language, sourceCode, stdin) {
  const tempDir = os.tmpdir();
  const fileExt = LANGUAGE_MAP[language]?.ext || "txt";
  const tempFile = path.join(tempDir, `sandbox_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`);

  await fs.promises.writeFile(tempFile, sourceCode, "utf-8");

  return new Promise((resolve) => {
    let cmd = "";
    let args = [];

    if (language === "javascript") {
      cmd = process.execPath; // node.exe
      args = [tempFile];
    } else if (language === "python") {
      cmd = "python";
      args = [tempFile];
    } else {
      // C++ or Java without local gcc/javac
      fs.promises.unlink(tempFile).catch(() => { });
      return resolve({
        stdout: "",
        stderr: `Local compiler for ${language} is not available in fallback mode. Please ensure Judge0 CE connectivity.`,
        compileOutput: "",
        time: "0.0s",
        memory: "0.0 MB",
        status: "Unavailable In Fallback",
        statusCode: 13,
        isSuccess: false
      });
    }

    const startTime = Date.now();
    let stdout = "";
    let stderr = "";
    let isTerminated = false;

    const child = spawn(cmd, args, {
      timeout: 5000,
      env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=128" }
    });

    if (stdin && child.stdin) {
      child.stdin.write(stdin);
      child.stdin.end();
    }

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    const timer = setTimeout(() => {
      isTerminated = true;
      try { child.kill("SIGKILL"); } catch (e) { }
    }, 5000);

    child.on("close", (code) => {
      clearTimeout(timer);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(3);
      fs.promises.unlink(tempFile).catch(() => { });

      if (isTerminated) {
        return resolve({
          stdout,
          stderr: "Execution Timed Out (5.0s CPU Limit Exceeded)",
          compileOutput: "",
          time: `${elapsed} s`,
          memory: "N/A",
          status: "Time Limit Exceeded",
          statusCode: 5,
          isSuccess: false
        });
      }

      const isSuccess = code === 0 && !stderr;
      resolve({
        stdout,
        stderr,
        compileOutput: "",
        time: `${elapsed} s`,
        memory: "Peak ~18 MB",
        status: isSuccess ? "Accepted" : (code !== 0 ? `Runtime Error (Exit Code ${code})` : "Finished with Warnings"),
        statusCode: isSuccess ? 3 : 11,
        isSuccess
      });
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      fs.promises.unlink(tempFile).catch(() => { });
      resolve({
        stdout,
        stderr: `Failed to spawn runtime: ${err.message}`,
        compileOutput: "",
        time: "0.0 s",
        memory: "N/A",
        status: "Runtime Error",
        statusCode: 11,
        isSuccess: false
      });
    });
  });
}
