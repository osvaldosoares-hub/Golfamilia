'use client'

import { useEffect, useState } from 'react'

// World Cup 2026 starts June 11, 2026 at 5:00 PM UTC (first match)
const COPA_START_DATE = new Date('2026-06-11T17:00:00Z')

interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function calculateTimeLeft(): TimeLeft | null {
  const now = new Date()
  const difference = COPA_START_DATE.getTime() - now.getTime()

  if (difference <= 0) {
    return null
  }

  return {
    days: Math.floor(difference / (1000 * 60 * 60 * 24)),
    hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((difference / (1000 * 60)) % 60),
    seconds: Math.floor((difference / 1000) % 60),
  }
}

export default function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
    setTimeLeft(calculateTimeLeft())

    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  if (!isClient) {
    return null
  }

  if (timeLeft === null) {
    return (
      <div className="mt-6 animate-fade-up">
        <div className="inline-flex items-center gap-3 bg-gradient-to-r from-green/20 to-gold/20 border border-green/30 rounded-2xl px-6 py-4">
          <div className="text-3xl">🏆</div>
          <div className="text-center">
            <div className="text-lg font-black tracking-widest uppercase text-green">
              Copa Started! ⚽️
            </div>
            <div className="text-xs text-muted">Aposte agora!</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6 animate-fade-up">
      <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green/10 to-gold/10 border border-white/[0.06] rounded-2xl px-4 py-3">
        <div className="text-xl">🏆</div>
        <div className="flex items-center gap-3 font-mono">
          <div className="text-center">
            <div className="text-2xl font-black text-green">{String(timeLeft.days).padStart(2, '0')}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted">dias</div>
          </div>
          <div className="text-lg text-muted">:</div>
          <div className="text-center">
            <div className="text-2xl font-black text-white">{String(timeLeft.hours).padStart(2, '0')}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted">hrs</div>
          </div>
          <div className="text-lg text-muted">:</div>
          <div className="text-center">
            <div className="text-2xl font-black text-white">{String(timeLeft.minutes).padStart(2, '0')}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted">min</div>
          </div>
          <div className="text-lg text-muted">:</div>
          <div className="text-center">
            <div className="text-2xl font-black text-gold">{String(timeLeft.seconds).padStart(2, '0')}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted">seg</div>
          </div>
        </div>
        <div className="text-xs text-muted ml-2">
          para a Copa!
        </div>
      </div>
    </div>
  )
}
