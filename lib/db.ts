import Dexie, { type Table } from 'dexie'

import { createClient } from '@/lib/supabase/client'

export interface Note {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  userId?: string
  deleted?: boolean
  // Encryption fields (nullable - only set if encrypted)
  encryptedContent?: string
  salt?: string
  nonce?: string
  authTag?: string
}

class NotesDatabase extends Dexie {
  notes!: Table<Note>

  constructor() {
    super('NotesDB')
    this.version(2).stores({
      notes: 'id, userId, updatedAt, deleted',
    })
  }

  async init() {
    await this.open()
  }

  async getAllNotes(userId?: string): Promise<Note[]> {
    if (userId) {
      const supabase = createClient()
      const { data: notes } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (notes?.length) {
        const formatted = notes.map((n) => ({
          id: n.id,
          title: n.title,
          content: n.content,
          createdAt: new Date(n.created_at).getTime(),
          updatedAt: new Date(n.updated_at).getTime(),
          userId: n.user_id,
          encryptedContent: n.encrypted_content,
          salt: n.salt,
          nonce: n.nonce,
          authTag: n.auth_tag,
        }))
        await this.notes.bulkPut(formatted)
        return formatted
      }
      return []
    }

    return this.notes
      .filter((note) => !note.deleted)
      .reverse()
      .sortBy('updatedAt')
  }

  async saveNote(note: Note) {
    if (note.userId) {
      const supabase = createClient()
      const { error } = await supabase.from('notes').upsert({
        id: note.id,
        user_id: note.userId,
        title: note.title,
        content: note.content,
        created_at: new Date(note.createdAt).toISOString(),
        updated_at: new Date(note.updatedAt).toISOString(),
        encrypted_content: note.encryptedContent || null,
        salt: note.salt || null,
        nonce: note.nonce || null,
        auth_tag: note.authTag || null,
      })
      if (error) throw error
    }
    await this.notes.put(note)
  }

  async deleteNote(id: string, userId?: string) {
    if (userId) {
      const supabase = createClient()
      await supabase.from('notes').delete().eq('id', id)
    }
    await this.notes.delete(id)
  }

  async migrateAnonymousNotes(userId: string) {
    const anonNotes = await this.notes
      .filter((n) => !n.userId && !n.deleted)
      .toArray()
    for (const note of anonNotes) {
      note.userId = userId
      await this.saveNote(note)
    }
  }
}

export const notesDB = new NotesDatabase()
