'use client'
// src/components/ui/AddCoinsModal.tsx
import { useState } from 'react'
import { toast } from 'sonner'
import { formatCoins } from '@/lib/utils'

interface Props {
  currentCoins: number
  onClose: () => void
  onSuccess: (newCoins: number) => void
}


export default function AddCoinsModal({ currentCoins, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState('')

  async function addCoins(amount: number) {
    setLoading(true)
    try {
      const res = await fetch('/api/user/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error || 'Erro'); return }
      toast.success(`🪙 +${formatCoins(amount)} GolCoins adicionados!`)
      onSuccess(json.data.coins)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center px-4" onClick={onClose}>
      <div className="card relative w-full max-w-md p-8 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-gold to-green" />

        <h3 className="text-2xl font-black tracking-widest text-white mb-1">💰 GolCoins</h3>
        <p className="text-sm text-muted mb-6">
          Adicione GolCoins para apostar. <strong className="text-red/80">Não é dinheiro real</strong> — só diversão!
        </p>

        {/* Current balance */}
        <div className="bg-dark-3 rounded-2xl p-6 text-center mb-6">
          <div className="text-5xl font-black text-gold font-mono">{formatCoins(currentCoins)}</div>
          <div className="text-xs text-muted mt-1 uppercase tracking-widest">🪙 Seu saldo atual</div>
        </div>

        {/* Amount input */}
        <p className="text-xs text-muted uppercase tracking-widest mb-3">Quanto adicionar?</p>
        <div className="flex gap-2 mb-4">
          <input
            type="number"
            min={1}
            placeholder="Ex: 500"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-dark-3 border border-white/[0.08] rounded-xl text-white text-center font-bold placeholder:text-white/30 focus:outline-none focus:border-gold/50 transition-colors disabled:opacity-50"
          />
          <button
            disabled={loading || !amount || Number(amount) < 1}
            onClick={() => { addCoins(Number(amount)); setAmount('') }}
            className="px-6 py-3 bg-gold/20 border border-gold/40 rounded-xl text-gold font-bold transition-all hover:bg-gold/30 disabled:opacity-50"
          >
            {loading ? '...' : 'Adicionar'}
          </button>
        </div>
        

        <div className="text-xs text-red/70 bg-red/[0.06] border border-red/20 rounded-xl p-3 mb-4">
          ⚠️ GolCoins <strong>não têm valor monetário</strong>. Você pode adicionar à vontade, mas não dá pra sacar!
        </div>

        <button onClick={onClose} className="w-full py-3 bg-transparent border border-white/[0.08] rounded-xl text-white/50 font-bold hover:border-white/20 transition-colors">
          Fechar
        </button>
      </div>
    </div>
  )
}
