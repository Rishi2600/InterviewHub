interface TypingUser {
  userId: string
  username: string
}

function phrase(users: TypingUser[]): string {
  const names = users.map((u) => u.username)
  if (names.length === 1) return `${names[0]} is typing…`
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`
  return `${names[0]} and ${names.length - 1} others are typing…`
}

export function TypingIndicator({ users }: { users: TypingUser[] }) {
  // Reserve the row's height at all times so the message list doesn't jump
  // when the indicator appears and disappears.
  return (
    <div className="h-6 px-4" aria-live="polite" aria-atomic="true">
      {users.length > 0 && (
        <p className="flex animate-fade items-center gap-1.5 text-caption text-ink-faint">
          <span aria-hidden className="flex gap-0.5">
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="size-1 animate-bounce rounded-full bg-ink-faint"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
          </span>
          {phrase(users)}
        </p>
      )}
    </div>
  )
}