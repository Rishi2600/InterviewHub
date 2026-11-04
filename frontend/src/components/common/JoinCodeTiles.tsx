/** A join code shown one character per tile, in turquoise. */
export function JoinCodeTiles({ code }: { code: string }) {
  return (
    <div className="flex gap-1.5" aria-label={`Join code ${code.split('').join(' ')}`}>
      {code.split('').map((char, i) => (
        <span
          key={i}
          aria-hidden
          className="grid h-11 w-10 place-items-center rounded-md border border-primary/35 bg-primary/10 font-mono text-lg font-medium text-brand"
        >
          {char}
        </span>
      ))}
    </div>
  )
}
