import { useEffect, useMemo, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { toast } from 'sonner'

import { notesDB } from '@/lib/db'
import { createClient } from '@/lib/supabase/client'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = useMemo(() => createClient(), [])

  const initOnlineUser = async (userId: string) => {
    await notesDB.migrateAnonymousNotes(userId)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
      if (session?.user) initOnlineUser(session.user.id)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) initOnlineUser(session.user.id)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase])

  const signInWithOTP = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) {
      toast.error('Failed to send code')
      throw error
    }
  }

  const verifyOTP = async (email: string, token: string) => {
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'magiclink',
    })
    if (error) {
      toast.error('Verification failed')
      throw error
    }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      toast.error('Failed to sign out')
      throw error
    }
  }

  return {
    user,
    loading,
    signInWithOTP,
    verifyOTP,
    signOut,
  }
}
