import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'

import { notesDB, syncEngine } from '@/lib/db'
import { createClient } from '@/lib/supabase/client'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = useMemo(() => createClient(), [])

  const initSync = async (userId: string) => {
    await notesDB.migrateAnonymousNotes(userId)
    setTimeout(() => {
      syncEngine.startSync(userId)
    }, 1000)
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)

      if (session?.user) {
        initSync(session.user.id)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)

      if (session?.user) {
        await initSync(session.user.id)
      } else {
        syncEngine.stopSync()
      }
    })

    return () => {
      subscription.unsubscribe()
      syncEngine.stopSync()
    }
  }, [supabase])

  const signInWithOTP = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) throw error
  }

  const verifyOTP = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'magiclink',
    })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return {
    user,
    loading,
    signInWithOTP,
    verifyOTP,
    signOut,
  }
}
