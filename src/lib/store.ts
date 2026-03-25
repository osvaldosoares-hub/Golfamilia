// src/lib/store.ts
import { create } from 'zustand'
import type { User } from '@/types'

interface AuthStore {
  user: User | null
  setUser: (user: User | null) => void
  updateCoins: (coins: number) => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  updateCoins: (coins) => set((s) => s.user ? { user: { ...s.user, coins } } : {}),
}))
