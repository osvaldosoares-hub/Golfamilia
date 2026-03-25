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
    icon: '/favicon.jpeg',
    apple: '/favicon.jpeg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${dmSans.variable} ${spaceMono.variable}`}>
      <body className="bg-dark text-white antialiased">
        {children}
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
