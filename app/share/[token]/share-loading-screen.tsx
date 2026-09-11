export function ShareLoadingScreen({ message = 'Preparing your loan statement…' }: { message?: string }) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-card/90 backdrop-blur-md sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="h-3 w-28 rounded bg-muted animate-pulse" />
            <div className="h-7 w-48 sm:w-64 rounded-md bg-muted animate-pulse" />
          </div>
          <div className="h-11 w-full sm:w-40 rounded-md bg-muted animate-pulse" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 sm:py-8 max-w-3xl space-y-6">
        <div
          className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
          role="status"
          aria-live="polite"
        >
          <span
            className="inline-block size-4 shrink-0 rounded-full border-2 border-primary border-t-transparent animate-spin"
            aria-hidden="true"
          />
          <span>{message}</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
          <div className="flex gap-2">
            <div className="h-6 w-16 rounded-full bg-muted animate-pulse" />
            <div className="h-6 w-20 rounded-full bg-muted animate-pulse" />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-14 rounded bg-muted animate-pulse" />
                <div className="h-4 w-28 rounded bg-muted/80 animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="h-3 w-28 rounded bg-muted animate-pulse" />
              <div className="h-8 w-36 rounded bg-muted/80 animate-pulse" />
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
          <div className="h-6 w-32 rounded bg-muted animate-pulse" />
          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                <div className="h-5 w-24 rounded bg-muted/70 animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
          <div className="h-6 w-40 rounded bg-muted animate-pulse" />
          <div className="h-4 w-full max-w-md rounded bg-muted/70 animate-pulse" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 rounded-lg bg-muted/50 animate-pulse" />
          ))}
        </div>
      </main>
    </div>
  )
}
