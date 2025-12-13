import Dexie, { type Table } from 'dexie'

// Sync engine
import { createClient } from '@/lib/supabase/client'

export interface Note {
  id: string
  title: string
  content: string
  createdAt: number
  updatedAt: number
  userId?: string // null for anonymous notes
  syncedAt?: number // track last sync time
  deleted?: boolean // soft delete for sync
}

class NotesDatabase extends Dexie {
  notes!: Table<Note>

  constructor() {
    super('NotesDB')
    this.version(1).stores({
      notes: 'id, userId, updatedAt, syncedAt, deleted',
    })
  }

  async init() {
    await this.open()
  }

  async getAllNotes(): Promise<Note[]> {
    return await this.notes
      .filter((note) => note.deleted !== true)
      .reverse()
      .sortBy('updatedAt')
  }

  async saveNote(note: Note): Promise<void> {
    await this.notes.put(note)
  }

  async deleteNote(id: string): Promise<void> {
    // Soft delete for sync purposes
    const note = await this.notes.get(id)
    if (note) {
      await this.notes.put({
        ...note,
        deleted: true,
        updatedAt: Date.now(),
      })
    }
  }

  async hardDeleteNote(id: string): Promise<void> {
    await this.notes.delete(id)
  }

  async getUnsyncedNotes(userId: string): Promise<Note[]> {
    return await this.notes
      .where('userId')
      .equals(userId)
      .and((note) => !note.syncedAt || note.updatedAt > note.syncedAt)
      .toArray()
  }

  async markAsSynced(id: string): Promise<void> {
    const note = await this.notes.get(id)
    if (note) {
      await this.notes.put({
        ...note,
        syncedAt: Date.now(),
      })
    }
  }

  async migrateAnonymousNotes(userId: string): Promise<void> {
    const allNotes = await this.notes.toArray()
    const anonymousNotes = allNotes.filter(
      (note) => !note.userId && !note.deleted
    )

    for (const note of anonymousNotes) {
      await this.notes.put({
        ...note,
        userId,
        updatedAt: Date.now(),
      })
    }
  }
}

export const notesDB = new NotesDatabase()

class SyncEngine {
  private supabase = createClient()
  private syncInterval?: NodeJS.Timeout
  private isSyncing = false
  private currentUserId?: string
  private readonly SYNC_INTERVAL_MS = 30000 // 30 seconds

  async startSync(userId: string) {
    this.currentUserId = userId
    await this.sync(userId)
    this.startInterval()

    // Sync and pause when leaving tab
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.sync(userId)
        this.stopInterval()
      } else {
        this.sync(userId)
        this.startInterval()
      }
    })

    // Sync before closing tab
    window.addEventListener('beforeunload', () => {
      this.sync(userId)
    })
  }

  private startInterval() {
    if (this.syncInterval) return
    this.syncInterval = setInterval(() => {
      if (this.currentUserId) this.sync(this.currentUserId)
    }, this.SYNC_INTERVAL_MS)
  }

  private stopInterval() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
      this.syncInterval = undefined
    }
  }

  stopSync() {
    this.stopInterval()
    this.currentUserId = undefined
  }

  private async sync(userId: string) {
    if (this.isSyncing) return
    this.isSyncing = true

    try {
      await this.pushChanges(userId)
      await this.pullChanges(userId)
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      this.isSyncing = false
    }
  }

  private async pushChanges(userId: string) {
    const unsyncedNotes = await notesDB.getUnsyncedNotes(userId)
    if (unsyncedNotes.length === 0) return

    const notesToSync = unsyncedNotes.map((note) => ({
      id: note.id,
      user_id: note.userId,
      title: note.title,
      content: note.content,
      created_at: new Date(note.createdAt).toISOString(),
      updated_at: new Date(note.updatedAt).toISOString(),
      deleted: note.deleted || false,
    }))

    const { error } = await this.supabase.from('notes').upsert(notesToSync)

    if (!error) {
      for (const note of unsyncedNotes) {
        if (note.deleted) {
          await notesDB.hardDeleteNote(note.id)
        } else {
          await notesDB.markAsSynced(note.id)
        }
      }
    }
  }

  private async pullChanges(userId: string) {
    const lastSyncTime = await this.getLastSyncTime(userId)

    const { data: remoteNotes } = await this.supabase
      .from('notes')
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', new Date(lastSyncTime).toISOString())

    if (!remoteNotes?.length) return

    for (const note of remoteNotes) {
      if (note.deleted) {
        await notesDB.hardDeleteNote(note.id)
      } else {
        await notesDB.saveNote({
          id: note.id,
          userId: note.user_id,
          title: note.title,
          content: note.content,
          createdAt: new Date(note.created_at).getTime(),
          updatedAt: new Date(note.updated_at).getTime(),
          syncedAt: Date.now(),
        })
      }
    }
  }

  private async getLastSyncTime(userId: string): Promise<number> {
    const notes = await notesDB.notes
      .where('userId')
      .equals(userId)
      .reverse()
      .sortBy('syncedAt')

    return notes[0]?.syncedAt || 0
  }
}

export const syncEngine = new SyncEngine()
