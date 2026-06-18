export default function LobbyLoading() {
  return (
    <main className="min-h-screen bg-field bg-grid pt-16">
      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Header skeleton */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="skeleton h-10 w-10 rounded" />
            <div className="skeleton h-4 w-24 rounded" />
          </div>
          <div className="skeleton h-8 w-64 rounded mt-2" />
          <div className="skeleton h-4 w-48 rounded mt-2" />
          <div className="mt-6">
            <div className="skeleton h-16 w-80 rounded-2xl" />
          </div>
        </div>

        {/* Cards skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="skeleton-card h-48" />
          <div className="skeleton-card h-48" />
        </div>
      </div>
    </main>
  )
}