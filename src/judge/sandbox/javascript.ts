import { newQuickJSWASMModule } from 'quickjs-emscripten';
import { transform } from 'sucrase';
import { RunLimits, RunResult } from './types';

// QuickJS raises its own "stack overflow" below this, well before the host
// engine's stack runs out.
const STACK_BYTES = 256 * 1024;

/**
 * Runs before the program. It gives the usual ways contest programs read
 * input and print, then removes the two host functions from the globals.
 * The program gets nothing else from the host: no process, require, fetch
 * or timers.
 */
const PRELUDE = `(() => {
  const write = globalThis.__write, input = globalThis.__stdin;
  delete globalThis.__write; delete globalThis.__stdin;
  const show = (v) => typeof v === 'string' ? v : (() => { try { return JSON.stringify(v) ?? String(v) } catch { return String(v) } })();
  const line = (args) => args.map(show).join(' ') + '\\n';
  globalThis.console = {
    log: (...a) => write(1, line(a)), info: (...a) => write(1, line(a)),
    error: (...a) => write(2, line(a)), warn: (...a) => write(2, line(a)),
  };
  globalThis.print = globalThis.console.log;
  const lines = input.split('\\n');
  let next = 0;
  globalThis.readline = () => (next < lines.length ? lines[next++] : undefined);
  const fs = { readFileSync: () => input };
  globalThis.require = (name) => {
    if (name === 'fs' || name === 'node:fs') return fs;
    throw new Error("Cannot find module '" + name + "'");
  };
})();
`;

/** TypeScript is run as JavaScript once its types are stripped. Type errors
 *  are not reported, as with Node's own type stripping. */
export function toJavaScript(
  code: string,
  language: 'javascript' | 'typescript',
): string {
  if (language === 'javascript') return code;
  return transform(code, { transforms: ['typescript'] }).code;
}

/**
 * Runs one program on one input in a fresh QuickJS WebAssembly instance, so
 * nothing is shared with any earlier run.
 */
export async function runJavaScript(
  code: string,
  stdin: string,
  limits: RunLimits,
): Promise<RunResult> {
  const started = Date.now();
  const QuickJS = await newQuickJSWASMModule();
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(limits.memoryBytes);
  runtime.setMaxStackSize(STACK_BYTES);

  let stdout = '';
  let stderr = '';
  let written = 0;
  let overflow = false;
  const deadline = started + limits.timeMs;
  // An interrupt can't be caught by the program, unlike a thrown error, so
  // both the clock and the output cap stop it this way.
  runtime.setInterruptHandler(() => overflow || Date.now() > deadline);

  const vm = runtime.newContext();
  const write = vm.newFunction('__write', (fdHandle, textHandle) => {
    if (overflow) return;
    const text = vm.getString(textHandle);
    const room = limits.outputBytes - written;
    const bytes = Buffer.byteLength(text);
    const kept = bytes > room ? Buffer.from(text).subarray(0, room) : text;
    written += Math.min(bytes, room);
    if (vm.getNumber(fdHandle) === 2) stderr += kept.toString();
    else stdout += kept.toString();
    if (bytes > room) overflow = true;
  });
  vm.setProp(vm.global, '__write', write);
  write.dispose();
  const input = vm.newString(stdin);
  vm.setProp(vm.global, '__stdin', input);
  input.dispose();

  const result = (verdict: RunResult['verdict']): RunResult => ({
    verdict,
    stdout,
    stderr,
    ms: Date.now() - started,
  });

  try {
    vm.unwrapResult(vm.evalCode(PRELUDE, 'prelude.js')).dispose();
    const evaluated = vm.evalCode(code, 'main.js');
    let error = evaluated.error ? vm.dump(evaluated.error) : null;
    evaluated.error?.dispose();
    if (!evaluated.error) evaluated.value.dispose();
    // Let async code finish: promise jobs only run when asked to.
    if (!error) {
      const jobs = runtime.executePendingJobs();
      if (jobs.error) {
        error = jobs.error.context.dump(jobs.error);
        jobs.error.dispose();
      }
    }
    if (overflow) return result('output');
    if (error) {
      const failure = describe(error);
      if (failure === 'interrupted') return result('time');
      if (failure === 'out of memory') return result('memory');
      stderr += failure;
      return result('error');
    }
    return result('ok');
  } catch (err) {
    // The engine itself failed, usually by running out of memory.
    const message = err instanceof Error ? err.message : String(err);
    if (/memory/i.test(message)) return result('memory');
    stderr += message;
    return result('error');
  } finally {
    vm.dispose();
    runtime.dispose();
  }
}

/** QuickJS errors arrive as plain objects; turn one into stderr text. */
function describe(error: unknown): string {
  if (error && typeof error === 'object') {
    const { name, message, stack } = error as Record<string, string>;
    if (name === 'InternalError' && message === 'interrupted') {
      return 'interrupted';
    }
    if (name === 'InternalError' && message === 'out of memory') {
      return 'out of memory';
    }
    const head = name ? `${name}: ${message}` : message;
    return typeof stack === 'string' && stack ? `${head}\n${stack}` : head;
  }
  return `Uncaught ${String(error)}`;
}
