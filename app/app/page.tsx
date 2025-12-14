'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import {
  ComputerIcon,
  Delete01Icon,
  File02Icon,
  FileUnlockedIcon,
  GithubIcon,
  Loading03Icon,
  Logout01Icon,
  Moon02Icon,
  PlusSignIcon,
  SourceCodeIcon,
  TextAlignLeft01Icon,
  UserIcon,
  ViewIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTheme } from 'next-themes'
import { useHotkeys } from 'react-hotkeys-hook'
import ReactMarkdown from 'react-markdown'
import { remark } from 'remark'
import remarkGfm from 'remark-gfm'
import remarkStringify from 'remark-stringify'
import { toast } from 'sonner'

import { notesDB, type Note } from '@/lib/db'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { usePWAInstall } from '@/hooks/user-pwa-install'
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
import { Kbd } from '@/components/ui/kbd'
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
  const [isFormatting, setIsFormatting] = useState(false)

  const { user, loading, signInWithOTP, verifyOTP, signOut } = useAuth()
  const { setTheme, resolvedTheme } = useTheme()
  const { isInstallable, install } = usePWAInstall()

  const loadNotes = useCallback(async () => {
    try {
      await notesDB.init()
      const loadedNotes = await notesDB.getAllNotes(user?.id)
      setNotes(loadedNotes)
      if (loadedNotes.length > 0) {
        setSelectedNoteId(loadedNotes[0].id)
        setTitle(loadedNotes[0].title)
        setContent(loadedNotes[0].content)
      }
    } catch {
      toast.error('Failed to load notes')
    }
  }, [user])

  useEffect(() => {
    loadNotes()
  }, [loadNotes])

  useEffect(() => {
    if (!selectedNoteId) return
    const timeout = setTimeout(async () => {
      const updatedNote = notes.find((n) => n.id === selectedNoteId)
      if (!updatedNote) return
      const noteToSave = {
        ...updatedNote,
        title,
        content,
        updatedAt: Date.now(),
        userId: user?.id,
      }
      try {
        await notesDB.saveNote(noteToSave)
        setNotes((prev) =>
          prev.map((n) => (n.id === selectedNoteId ? noteToSave : n))
        )
      } catch {
        toast.error('Failed to save note')
      }
    }, 500)
    return () => clearTimeout(timeout)
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
    } catch {
      toast.error('Failed to create note')
    }
  }

  const deleteNote = async (id: string) => {
    try {
      await notesDB.deleteNote(id, user?.id)
      const updated = notes.filter((n) => n.id !== id)
      setNotes(updated)
      if (selectedNoteId === id) {
        if (updated.length > 0) {
          setSelectedNoteId(updated[0].id)
          setTitle(updated[0].title)
          setContent(updated[0].content)
        } else {
          setSelectedNoteId(null)
          setTitle('')
          setContent('')
        }
      }
      toast.success('Note deleted')
    } catch {
      toast.error('Failed to delete note')
    }
  }

  const selectNote = (note: Note) => {
    setSelectedNoteId(note.id)
    setTitle(note.title)
    setContent(note.content)
  }

  const formatMarkdown = async () => {
    if (!content || isFormatting) return
    setIsFormatting(true)
    try {
      const result = await remark()
        .use(remarkGfm)
        .use(remarkStringify, {
          bullet: '-',
          emphasis: '*',
          strong: '*',
          listItemIndent: 'one',
        })
        .process(content)
      setContent(String(result))
      toast.success('Markdown formatted')
    } catch {
      toast.error('Failed to format markdown')
    } finally {
      setIsFormatting(false)
    }
  }

  useHotkeys(
    'mod+f',
    (e) => {
      e.preventDefault()
      if (selectedNoteId && !showPreview) formatMarkdown()
    },
    { enableOnFormTags: ['TEXTAREA'] }
  )

  const handleSignIn = async () => {
    if (!email) return toast.error('Enter email')
    setIsSubmitting(true)
    try {
      await signInWithOTP(email)
      setOTPSent(true)
      toast.success('Check your email for the code')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 8) return toast.error('Enter 8-digit code')
    setIsSubmitting(true)
    try {
      await verifyOTP(email, otp)
      toast.success('Signed in')
      setLoginDialogOpen(false)
      setEmail('')
      setOTP('')
      setOTPSent(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success('Signed out')
    } catch {}
  }

  return (
    <div className="flex h-screen">
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
                          note.userId
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
                    className="size-4 shrink-0"
                  />
                  Source code
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="group"
                  onClick={() =>
                    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
                  }
                >
                  <HugeiconsIcon
                    icon={Moon02Icon}
                    strokeWidth={2}
                    className="size-4 shrink-0"
                  />
                  Night mode
                  <Switch
                    checked={resolvedTheme === 'dark'}
                    onCheckedChange={(checked) =>
                      setTheme(checked ? 'dark' : 'light')
                    }
                    className="ml-auto dark:group-focus:bg-secondary/60"
                  />
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="group"
                  onClick={install}
                  disabled={!isInstallable}
                >
                  <HugeiconsIcon
                    icon={ComputerIcon}
                    strokeWidth={2}
                    className="size-4 shrink-0"
                  />
                  Install
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {user ? (
                  <>
                    <DropdownMenuItem disabled>
                      <HugeiconsIcon
                        icon={FileUnlockedIcon}
                        strokeWidth={2}
                        className="size-4 shrink-0"
                      />
                      Encrypt
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={handleSignOut}
                    >
                      <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
                      Logout
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem onClick={() => setLoginDialogOpen(true)}>
                    <HugeiconsIcon icon={UserIcon} strokeWidth={2} /> Login
                  </DropdownMenuItem>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

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
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSignIn()
                }}
                className="space-y-4"
              >
                <Input
                  type="email"
                  id="_loginEmail"
                  autoComplete="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Button
                  type="submit"
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
              </form>
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
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={formatMarkdown}
                  disabled={showPreview || isFormatting}
                  title="Format markdown (Ctrl+Shift+F)"
                >
                  {isFormatting ? (
                    <>
                      <HugeiconsIcon
                        icon={Loading03Icon}
                        strokeWidth={2}
                        className="animate-spin"
                      />
                      Formatting...
                    </>
                  ) : (
                    <>
                      <HugeiconsIcon
                        icon={TextAlignLeft01Icon}
                        strokeWidth={2}
                      />
                      Format
                    </>
                  )}
                  <Kbd>Cmd + F</Kbd>
                </Button>
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
                      <HugeiconsIcon icon={ViewIcon} strokeWidth={2} /> Preview
                    </>
                  )}
                </Button>
              </div>
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
