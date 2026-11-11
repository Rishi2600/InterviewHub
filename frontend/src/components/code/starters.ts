import type { CodeLanguage } from '@/lib/sandbox/types'

/** A blank program per language: read standard input, print something. */
export const STARTERS: Record<CodeLanguage, string> = {
  python: 'import sys\n\ndata = sys.stdin.read()\nprint(data)\n',
  javascript: "const input = require('fs').readFileSync(0, 'utf8')\nconsole.log(input)\n",
  typescript: "const input: string = require('fs').readFileSync(0, 'utf8')\nconsole.log(input)\n",
}
