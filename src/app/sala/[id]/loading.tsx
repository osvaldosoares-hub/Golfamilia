export default function SalaLoading() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-field bg-grid pt-16">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="skeleton h-4 w-16 rounded" />
              <div className="skeleton h-8 w-48 rounded" />
            </div>
            <div className="skeleton h-4 w-40 rounded mt-2" />
          </div>
          <div className="skeleton h-14 w-40 rounded-xl" />
        </div>

        {/* Content skeleton */}
        <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_280px] gap-6">
          <div className="space-y-4">
            <div className="skeleton-card h-48" />
          </div>
          <div className="space-y-6">
            <div className="skeleton-card h-12" />
            <div className="skeleton-card h-64" />
          </div>
          <div className="space-y-4">
            <div className="skeleton-card h-64" />
            <div className="skeleton-card h-48" />
          </div>
        </div>
      </div>
    </main>
  )
}