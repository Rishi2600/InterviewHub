/** An unsigned JWT-shaped string whose `exp` is `secondsFromNow` ahead. */
export function fakeJwt(secondsFromNow: number): string {
  const body = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + secondsFromNow }))
  return `header.${body.replace(/=+$/, '')}.signature`
}
