// src/app/layout.tsx
import type { Metadata } from 'next'
import { DM_Sans, Space_Mono } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'GolFamilia — Apostas da Copa com Amigos',
  description: 'Bolão da Copa do Mundo. Aposte nos placares, escolha os classificados e dispute com seus amigos!',
  icons: {
    icon: '/favicon-32x32.png',
    apple: '/favicon-32x32.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
<html lang="pt-BR" className={`${dmSans.variable} ${spaceMono.variable} dark`}>
      <body className="bg-dark text-white antialiased flex flex-col min-h-screen">
        <main className="flex-1">{children}</main>

        <footer className="border-t border-white/10 bg-dark/80 py-6">
          <div className="mx-auto flex flex-col items-center gap-3 px-4">
            <img
              src="/osvaldo.jpg"
              alt="Osvaldo Soares Landim Junior"
              className="h-12 w-12 rounded-full object-cover ring-2 ring-emerald-500/60"
            />
            <p className="text-sm text-gray-400">
              Feito por <span className="font-semibold text-white">Osvaldo Soares Landim Junior</span>
            </p>
          </div>
        </footer>

        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#0E1420',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#E8EDF5',
              fontFamily: 'var(--font-sans)',
            },
          }}
        />
      </body>
    </html>
  )
}
