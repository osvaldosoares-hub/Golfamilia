'use client'

import { useEffect, useState } from 'react'

// World Cup 2026 started June 11, 2026
const COPA_START_DATE = new Date('2026-06-11T18:00:00Z')

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
  const [isCopaStarted, setIsCopaStarted] = useState(false)

  useEffect(() => {
    setIsClient(true)
    const tl = calculateTimeLeft()
    setTimeLeft(tl)
    setIsCopaStarted(tl === null)

    const timer = setInterval(() => {
      const newTl = calculateTimeLeft()
      setTimeLeft(newTl)
      setIsCopaStarted(newTl === null)
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  if (!isClient) {
    return null
  }

  // Copa já começou
  if (isCopaStarted) {
    return (
      <div className="mt-6 animate-fade-up">
        <div className="inline-flex items-center gap-3 bg-gradient-to-r from-green/20 to-gold/20 border border-green/30 rounded-2xl px-6 py-4">
          <div className="text-3xl">⚽</div>
          <div className="text-center">
            <div className="text-lg font-black tracking-widest uppercase text-green">
              Copa do Mundo 2026 EM ANDAMENTO! 🏆
            </div>
            <div className="text-xs text-muted">Faça suas apostas!</div>
          </div>
        </div>
      </div>
    )
  }

  // Ainda não começou - mostra countdown
  if (timeLeft === null) {
    return null
  }

  const totalHours = timeLeft.days * 24 + timeLeft.hours
  const isUrgent = totalHours < 24
  const isVeryUrgent = totalHours < 1

  const containerClass = isVeryUrgent 
    ? 'from-red/20 to-orange/20 border-red/40 animate-pulse' 
    : isUrgent 
      ? 'from-orange/20 to-gold/20 border-orange/40' 
      : 'from-green/10 to-gold/10 border-white/[0.06]'

  const numberClass = isVeryUrgent ? 'text-red' : isUrgent ? 'text-orange' : 'text-green'
  const secondsClass = isVeryUrgent ? 'text-red' : isUrgent ? 'text-orange' : 'text-gold'

  return (
    <div className="mt-6 animate-fade-up">
      <div className={`inline-flex items-center gap-2 bg-gradient-to-r ${containerClass} border rounded-2xl px-4 py-3 transition-all duration-500`}>
        <div className="text-xl">🏆</div>
        <div className="flex items-center gap-3 font-mono">
          <div className="text-center">
            <div className={`text-2xl font-black ${numberClass} transition-smooth`}>{String(timeLeft.days).padStart(2, '0')}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted">dias</div>
          </div>
          <div className="text-lg text-muted">:</div>
          <div className="text-center">
            <div className={`text-2xl font-black ${isVeryUrgent ? 'text-red' : isUrgent ? 'text-orange' : 'text-white'} transition-smooth`}>{String(timeLeft.hours).padStart(2, '0')}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted">hrs</div>
          </div>
          <div className="text-lg text-muted">:</div>
          <div className="text-center">
            <div className={`text-2xl font-black ${isVeryUrgent ? 'text-red' : isUrgent ? 'text-orange' : 'text-white'} transition-smooth`}>{String(timeLeft.minutes).padStart(2, '0')}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted">min</div>
          </div>
          <div className="text-lg text-muted">:</div>
          <div className="text-center">
            <div className={`text-2xl font-black ${secondsClass} transition-smooth`}>{String(timeLeft.seconds).padStart(2, '0')}</div>
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