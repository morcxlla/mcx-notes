'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Delete01Icon,
  File02Icon,
  GithubIcon,
  Loading03Icon,
  Logout01Icon,
  Moon02Icon,
  PlusSignIcon,
  SourceCodeIcon,
  UserIcon,
  ViewIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTheme } from 'next-themes'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'

import { notesDB, type Note } from '@/lib/db'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

import { mdWiki } from './markdown-miniwiki'

export default function NotesApp() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [loginDialogOpen, setLoginDialogOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [otp, setOTP] = useState('')
  const [otpSent, setOTPSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { user, loading, signInWithOTP, verifyOTP, signOut } = useAuth()
  const { setTheme, resolvedTheme } = useTheme()

  useEffect(() => {
    const loadNotes = async () => {
      try {
        await notesDB.init()
        const loadedNotes = await notesDB.getAllNotes()
        setNotes(loadedNotes)
        if (loadedNotes.length > 0) {
          setSelectedNoteId(loadedNotes[0].id)
          setTitle(loadedNotes[0].title)
          setContent(loadedNotes[0].content)
        }
      } catch (error) {
        console.error('Error loading notes from IndexedDB:', error)
        toast.error('Error loading notes from IndexedDB')
      }
    }
    loadNotes()
  }, [])

  // Refresh notes list when user changes (after migration)
  useEffect(() => {
    if (user) {
      const refreshNotes = async () => {
        const loadedNotes = await notesDB.getAllNotes()
        setNotes(loadedNotes)
      }
      // Wait a bit for migration to complete
      setTimeout(refreshNotes, 1000)
    }
  }, [user])

  useEffect(() => {
    if (selectedNoteId) {
      const timeoutId = setTimeout(async () => {
        const updatedNote = notes.find((note) => note.id === selectedNoteId)
        if (updatedNote) {
          const noteToSave = {
            ...updatedNote,
            title,
            content,
            updatedAt: Date.now(),
            userId: user?.id,
          }
          try {
            await notesDB.saveNote(noteToSave)
            setNotes((prevNotes) =>
              prevNotes.map((note) =>
                note.id === selectedNoteId ? noteToSave : note
              )
            )
          } catch (error) {
            console.error('Error saving note:', error)
            toast.error('Error saving note')
          }
        }
      }, 500)
      return () => clearTimeout(timeoutId)
    }
  }, [title, content, selectedNoteId, notes, user])

  const createNewNote = async () => {
    const isFirstNote = notes.length === 0

    const newNote: Note = {
      id: crypto.randomUUID(),
      title: isFirstNote ? 'Welcome to Notes' : 'New note',
      content: isFirstNote ? mdWiki : '# New note\n\nStart writing here...',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      userId: user?.id,
    }

    try {
      await notesDB.saveNote(newNote)
      setNotes([newNote, ...notes])
      setSelectedNoteId(newNote.id)
      setTitle(newNote.title)
      setContent(newNote.content)
    } catch (error) {
      console.error('Error creating note:', error)
      toast.error('Error creating note')
    }
  }

  const deleteNote = async (id: string) => {
    try {
      await notesDB.deleteNote(id)
      const updatedNotes = notes.filter((note) => note.id !== id)
      setNotes(updatedNotes)

      if (selectedNoteId === id) {
        if (updatedNotes.length > 0) {
          setSelectedNoteId(updatedNotes[0].id)
          setTitle(updatedNotes[0].title)
          setContent(updatedNotes[0].content)
        } else {
          setSelectedNoteId(null)
          setTitle('')
          setContent('')
        }
      }
      toast.success('Note deleted')
    } catch (error) {
      console.error('Error deleting note:', error)
      toast.error('Error deleting note')
    }
  }

  const selectNote = (note: Note) => {
    setSelectedNoteId(note.id)
    setTitle(note.title)
    setContent(note.content)
  }

  const handleSignIn = async () => {
    if (!email) {
      toast.error('Please enter your email')
      return
    }

    setIsSubmitting(true)
    try {
      await signInWithOTP(email)
      setOTPSent(true)
      toast.success('Check your email for the code')
    } catch {
      // Error already handled in useAuth hook
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 8) {
      toast.error('Please enter the 8-digit code')
      return
    }

    setIsSubmitting(true)
    try {
      await verifyOTP(email, otp)
      toast.success('Signed in successfully!')
      setLoginDialogOpen(false)
      setEmail('')
      setOTP('')
      setOTPSent(false)
    } catch {
      // Error already handled in useAuth hook
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success('Signed out successfully')
    } catch {
      // Error already handled in useAuth hook
    }
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-80 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <Button onClick={createNewNote} className="w-full">
            <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
            New note
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {notes.map((note) => (
              <Card
                key={note.id}
                className={cn(
                  'p-3 cursor-pointer transition-colors bg-card',
                  selectedNoteId === note.id
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-secondary hover:text-secondary-foreground'
                )}
                onClick={() => selectNote(note)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <HugeiconsIcon
                        icon={File02Icon}
                        strokeWidth={2}
                        className={cn(
                          'size-4 shrink-0',

                          note.syncedAt && user
                            ? 'text-green-500'
                            : 'text-muted-foreground'
                        )}
                      />
                      <h3 className="font-medium text-sm truncate">
                        {note.title || 'Untitled'}
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {note.content.substring(0, 60)}...
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteNote(note.id)
                    }}
                    className="shrink-0"
                  >
                    <HugeiconsIcon
                      icon={Delete01Icon}
                      strokeWidth={2}
                      className="text-destructive"
                    />
                  </Button>
                </div>
              </Card>
            ))}
            {notes.length === 0 && (
              <p className="text-center text-muted-foreground text-sm py-8">
                No notes yet.
                <br />
                Create a new note to get started.
              </p>
            )}
          </div>
        </ScrollArea>
        <div className="p-4">
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: 'outline' }),
                'w-full h-auto p-2'
              )}
            >
              <div className="border bg-secondary p-1 rounded-full mr-2 size-8 flex items-center justify-center">
                {loading ? (
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    strokeWidth={2}
                    className="animate-spin"
                  />
                ) : (
                  <HugeiconsIcon icon={UserIcon} strokeWidth={2} />
                )}
              </div>
              <p className="flex-1 text-left leading-none line-clamp-1 truncate">
                {user ? user.email : 'Anonymous'}
              </p>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuGroup>
                <DropdownMenuItem
                  render={
                    <Link
                      href="https://github.com/morcxlla/mcx-notes"
                      target="_blank"
                    />
                  }
                  className="group"
                >
                  <HugeiconsIcon
                    icon={GithubIcon}
                    strokeWidth={2}
                    className={cn('size-4 shrink-0')}
                  />
                  Source code
                </DropdownMenuItem>
                <DropdownMenuSeparator />

                <DropdownMenuItem
                  className="group"
                  onClick={() => {
                    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
                  }}
                >
                  <HugeiconsIcon
                    icon={Moon02Icon}
                    strokeWidth={2}
                    className={cn('size-4 shrink-0')}
                  />
                  Night mode
                  <Switch
                    checked={resolvedTheme === 'dark'}
                    onCheckedChange={(checked) =>
                      setTheme(checked ? 'dark' : 'light')
                    }
                    className="ml-auto dark:group-hover:bg-secondary/60"
                  />
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {user ? (
                  <DropdownMenuItem
                    variant="destructive"
                    onClick={handleSignOut}
                  >
                    <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
                    Logout
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setLoginDialogOpen(true)}>
                    <HugeiconsIcon icon={UserIcon} strokeWidth={2} />
                    Login
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Login Dialog - Outside dropdown */}
      <Dialog open={loginDialogOpen} onOpenChange={setLoginDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sign in to sync your notes</DialogTitle>
            <DialogDescription>
              Your notes work offline. Sign in to sync them across devices.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {!otpSent ? (
              <>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSignIn()
                  }}
                />
                <Button
                  onClick={handleSignIn}
                  className="w-full"
                  size="lg"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <HugeiconsIcon
                        icon={Loading03Icon}
                        strokeWidth={2}
                        className="animate-spin"
                      />
                      Sending code...
                    </>
                  ) : (
                    'Send code'
                  )}
                </Button>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    We sent an 8-digit code to <strong>{email}</strong>
                  </p>
                  <Input
                    type="text"
                    placeholder="00000000"
                    value={otp}
                    onChange={(e) =>
                      setOTP(e.target.value.replace(/\D/g, '').slice(0, 8))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleVerifyOTP()
                    }}
                    maxLength={8}
                    className="text-center text-2xl tracking-widest"
                  />
                </div>
                <Button
                  onClick={handleVerifyOTP}
                  className="w-full"
                  size="lg"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <HugeiconsIcon
                        icon={Loading03Icon}
                        strokeWidth={2}
                        className="animate-spin"
                      />
                      Verifying...
                    </>
                  ) : (
                    'Verify code'
                  )}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setOTPSent(false)
                    setOTP('')
                  }}
                  className="w-full"
                >
                  Use different email
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Editor */}
      <main className="flex-1 flex flex-col">
        {selectedNoteId ? (
          <>
            <header className="p-4 border-b border-border bg-card flex items-center justify-between">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Note title"
                className="rounded-none text-xl font-semibold border-none bg-transparent focus-visible:ring-0 px-0"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
              >
                {showPreview ? (
                  <>
                    <HugeiconsIcon icon={SourceCodeIcon} strokeWidth={2} />
                    Editor
                  </>
                ) : (
                  <>
                    <HugeiconsIcon icon={ViewIcon} strokeWidth={2} />
                    Preview
                  </>
                )}
              </Button>
            </header>
            <div className="flex-1 overflow-hidden">
              {showPreview ? (
                <ScrollArea className="h-full">
                  <div className="p-8 max-w-5xl mx-auto markdown-preview">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {content}
                    </ReactMarkdown>
                  </div>
                </ScrollArea>
              ) : (
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your note in markdown..."
                  className="rounded-none h-full resize-none border-none focus-visible:ring-0 p-8 font-mono text-sm"
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <HugeiconsIcon
                icon={File02Icon}
                strokeWidth={2}
                className="size-12 mx-auto mb-4 opacity-50"
              />
              <p className="text-lg">Select a note or create a new one</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
