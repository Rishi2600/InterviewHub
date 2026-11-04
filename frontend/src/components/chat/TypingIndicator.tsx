interface TypingUser {
  userId: string
  username: string
}

function phrase(users: TypingUser[]): string {
  const names = users.map((u) => u.username)
  if (names.length === 1) return `${names[0]} is typing`
  if (names.length === 2) return `${names[0]} and ${names[1]} are typing`
  return `${names[0]} and ${names.length - 1} others are typing`
}

export function TypingIndicator({ users }: { users: TypingUser[] }) {
  // The row keeps its height so the messages above don't jump.
  return (
    <div className="h-6 px-5" aria-live="polite" aria-atomic="true">
      {users.length > 0 && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="flex gap-0.5" aria-hidden>
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                className="size-1 animate-pulse rounded-full bg-current"
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
