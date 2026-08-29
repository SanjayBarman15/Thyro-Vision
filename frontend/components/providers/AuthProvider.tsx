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
            console.log("\n=======================================================");
            console.log("🔑 BEARER TOKEN (Supabase Access Token):");
            console.log(session.access_token);
            console.log("=======================================================\n");

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

    // Also print token immediately on mount if session already exists
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        console.log("\n=======================================================");
        console.log("🔑 CURRENT BEARER TOKEN (From Active Session):");
        console.log(session.access_token);
        console.log("=======================================================\n");
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [initialUser, initialRole, setUser, setRole, setLoading, clear])

  return <>{children}</>
}
