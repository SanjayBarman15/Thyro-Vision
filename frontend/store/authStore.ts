import { create } from 'zustand'
import { User } from '@supabase/supabase-js'

export type UserRole = 'doctor' | 'admin' | null

interface AuthState {
  user: User | null
  role: UserRole
  isLoading: boolean
  
  setUser: (user: User | null) => void
  setRole: (role: UserRole) => void
  setLoading: (loading: boolean) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  role: null,
  isLoading: true, // Start as loading until initial check is done

  setUser: (user) => set({ user }),
  setRole: (role) => set({ role }),
  setLoading: (isLoading) => set({ isLoading }),
  clear: () => set({ user: null, role: null, isLoading: false }),
}))
