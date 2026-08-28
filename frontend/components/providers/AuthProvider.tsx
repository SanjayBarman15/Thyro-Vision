'use client'

import { useEffect, ReactNode } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useAuthStore, UserRole } from '@/store/authStore'
import { User } from '@supabase/supabase-js'

interface AuthProviderProps {
  children: ReactNode
  initialUser: User | null
  initialRole: UserRole
}

export default function AuthProvider({ 
  children, 
  initialUser, 
  initialRole 
}: AuthProviderProps) {
  const setUser = useAuthStore((state) => state.setUser)
  const setRole = useAuthStore((state) => state.setRole)
  const setLoading = useAuthStore((state) => state.setLoading)
  const clear = useAuthStore((state) => state.clear)

  useEffect(() => {
    // 1. Initialize store with server-side data
    setUser(initialUser)
    setRole(initialRole)
    setLoading(false)

    const supabase = createClient()

    // 2. Listen for auth changes (token refreshes, sign-ins, sign-outs)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user)
          
          // Extract role from custom claim in JWT
          let role = 'doctor';
          if (session?.access_token) {
            try {
              const payload = JSON.parse(atob(session.access_token.split('.')[1]));
              role = payload.user_role || 
                     session.user.user_metadata?.user_role || 
                     session.user.app_metadata?.user_role || 
                     'doctor';
            } catch (e) {
              console.error("Error decoding JWT in AuthProvider:", e);
            }
          }
          
          setRole(role as UserRole)
        } else {
          clear()
        }
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [initialUser, initialRole, setUser, setRole, setLoading, clear])

  return <>{children}</>
}
