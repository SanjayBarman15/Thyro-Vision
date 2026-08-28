import { createClient as createServerClient } from '@/utils/supabase/server'
import { createClient as createBrowserClient } from '@/utils/supabase/client'
import { UserRole } from '@/store/authStore'

/**
 * Universal utility to get the current user's role.
 * Works in Server Components, Server Actions, Middleware, and Client Components.
 */
export async function getUserRole(): Promise<UserRole> {
  const isServer = typeof window === 'undefined'
  
  const supabase = isServer 
    ? await createServerClient() 
    : createBrowserClient()

  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session?.user || !session?.access_token) return null

  // The custom_access_token_hook puts user_role in the JWT claims.
  // We decode the JWT payload manually to ensure we get the latest role from the token.
  try {
    const payload = JSON.parse(atob(session.access_token.split('.')[1]))
    const role = payload.user_role || 
                 session.user.user_metadata?.user_role || 
                 session.user.app_metadata?.user_role || 
                 'doctor'

    return role as UserRole
  } catch (e) {
    console.error("Error decoding JWT in getUserRole:", e)
    return 'doctor' as UserRole
  }
}
