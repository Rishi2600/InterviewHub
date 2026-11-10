// The browser side of the backend's src/judge/sandbox/javascript.ts. Same
// prelude and limits, so a program behaves the same on Run and on Submit.
import { newQuickJSWASMModuleFromVariant, newVariant } from 'quickjs-emscripten-core'
import type { QuickJSWASMModule } from 'quickjs-emscripten-core'
import RELEASE_SYNC from '@jitl/quickjs-wasmfile-release-sync'
import wasmUrl from '@jitl/quickjs-wasmfile-release-sync/wasm?url'
import { transform } from 'sucrase'
import type { RunLimits, RunResult } from './types'

const STACK_BYTES = 256 * 1024

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
`

let module: Promise<QuickJSWASMModule> | null = null

/** One QuickJS module per worker; each run gets its own runtime. */
export function loadQuickJS(): Promise<QuickJSWASMModule> {
  module ??= newQuickJSWASMModuleFromVariant(newVariant(RELEASE_SYNC, { wasmLocation: wasmUrl }))
  return module
}

export function toJavaScript(code: string, language: 'javascript' | 'typescript'): string {
  if (language === 'javascript') return code
  return transform(code, { transforms: ['typescript'] }).code
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export async function runJavaScript(code: string, stdin: string, limits: RunLimits): Promise<RunResult> {
  const started = performance.now()
  const runtime = (await loadQuickJS()).newRuntime()
  runtime.setMemoryLimit(limits.memoryBytes)
  runtime.setMaxStackSize(STACK_BYTES)

  let stdout = ''
  let stderr = ''
  let written = 0
  let overflow = false
  const deadline = Date.now() + limits.timeMs
  runtime.setInterruptHandler(() => overflow || Date.now() > deadline)

  const vm = runtime.newContext()
  const write = vm.newFunction('__write', (fdHandle, textHandle) => {
    if (overflow) return
    const bytes = encoder.encode(vm.getString(textHandle))
    const room = limits.outputBytes - written
    const kept = decoder.decode(bytes.subarray(0, room))
    written += Math.min(bytes.byteLength, room)
    if (vm.getNumber(fdHandle) === 2) stderr += kept
    else stdout += kept
    if (bytes.byteLength > room) overflow = true
  })
  vm.setProp(vm.global, '__write', write)
  write.dispose()
  const input = vm.newString(stdin)
  vm.setProp(vm.global, '__stdin', input)
  input.dispose()

  const result = (verdict: RunResult['verdict']): RunResult => ({
    verdict,
    stdout,
    stderr,
    ms: Math.round(performance.now() - started),
  })

  try {
    vm.unwrapResult(vm.evalCode(PRELUDE, 'prelude.js')).dispose()
    const evaluated = vm.evalCode(code, 'main.js')
    let error: unknown = evaluated.error ? vm.dump(evaluated.error) : null
    if (evaluated.error) evaluated.error.dispose()
    else evaluated.value.dispose()
    if (!error) {
      const jobs = runtime.executePendingJobs()
      if (jobs.error) {
        error = jobs.error.context.dump(jobs.error)
        jobs.error.dispose()
      }
    }
    if (overflow) return result('output')
    if (error) {
      const failure = describe(error)
      if (failure === 'interrupted') return result('time')
      if (failure === 'out of memory') return result('memory')
      stderr += failure
      return result('error')
    }
    return result('ok')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/memory/i.test(message)) return result('memory')
    stderr += message
    return result('error')
  } finally {
    vm.dispose()
    runtime.dispose()
  }
}

function describe(error: unknown): string {
  if (error && typeof error === 'object') {
    const { name, message, stack } = error as Record<string, string>
    if (name === 'InternalError' && message === 'interrupted') return 'interrupted'
    if (name === 'InternalError' && message === 'out of memory') return 'out of memory'
    const head = name ? `${name}: ${message}` : message
    return stack ? `${head}\n${stack}` : head
  }
  return `Uncaught ${String(error)}`
}
