export default function DashboardLoading() {
  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="h-9 w-56 rounded-md bg-muted animate-pulse" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-muted/70 animate-pulse" />
        ))}
      </div>
      <div className="h-72 rounded-xl bg-muted/50 animate-pulse" />
    </div>
  )
}
