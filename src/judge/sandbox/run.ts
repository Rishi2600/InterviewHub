import { runJavaScript, toJavaScript } from './javascript';
import { runPython } from './python';
import { CodeLanguage, RunLimits, RunResult } from './types';

export interface RunTask {
  language: CodeLanguage;
  code: string;
  stdin: string;
  limits: RunLimits;
}

/** Runs one program on one input in the runtime for its language. */
export async function runProgram(task: RunTask): Promise<RunResult> {
  const { language, code, stdin, limits } = task;
  if (language === 'python') return runPython(code, stdin, limits);
  let js: string;
  try {
    js = toJavaScript(code, language);
  } catch (err) {
    // A TypeScript syntax error: report it like any other error.
    const message = err instanceof Error ? err.message : String(err);
    return { verdict: 'error', stdout: '', stderr: message, ms: 0 };
  }
  return runJavaScript(js, stdin, limits);
}
