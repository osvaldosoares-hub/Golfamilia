'use client'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-field bg-grid flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <div className="text-6xl mb-6">⚽</div>
        <h1 className="text-2xl font-black mb-2">Algo deu errado</h1>
        <p className="text-muted mb-6 text-sm">
          O servidor demorou muito para responder. Isso pode acontecer na primeira carga (cold start).
          <br />
          Tente recarregar a página.
        </p>
        <button
          onClick={() => reset()}
          className="btn-primary"
        >
          🔄 Tentar novamente
        </button>
      </div>
    </main>
  )
}