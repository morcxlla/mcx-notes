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
  LockIcon,
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

import {
  cachePassword,
  clearPasswordCache,
  decryptContent,
  encryptContent,
  getCachedPassword,
} from '@/lib/crypto'
import { notesDB, type Note } from '@/lib/db'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import { usePWAInstall } from '@/hooks/user-pwa-install'
import { Badge } from '@/components/ui/badge'
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
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import PasswordValidator from '@/components/password-validator'

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

  // Encryption states
  const [encryptDialogOpen, setEncryptDialogOpen] = useState(false)
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false)
  const [encryptPassword, setEncryptPassword] = useState('')
  const [unlockPassword, setUnlockPassword] = useState('')
  const [isEncrypting, setIsEncrypting] = useState(false)
  const [isDecrypting, setIsDecrypting] = useState(false)
  const [decryptedContents, setDecryptedContents] = useState<
    Map<string, string>
  >(new Map())

  const { user, loading, signInWithOTP, verifyOTP, signOut } = useAuth()
  const { setTheme, resolvedTheme } = useTheme()
  const { isInstallable, install } = usePWAInstall()

  const isNoteEncrypted = (note: Note) => {
    return !!(note.encryptedContent && note.salt && note.nonce && note.authTag)
  }

  const isNoteUnlocked = (noteId: string) => {
    return decryptedContents.has(noteId)
  }

  const loadNotes = useCallback(async () => {
    try {
      await notesDB.init()
      const loadedNotes = await notesDB.getAllNotes(user?.id)
      setNotes(loadedNotes)
      if (loadedNotes.length > 0) {
        const firstNote = loadedNotes[0]
        setSelectedNoteId(firstNote.id)
        setTitle(firstNote.title)

        // Check if encrypted
        if (isNoteEncrypted(firstNote)) {
          const cachedPassword = getCachedPassword(firstNote.id)
          if (cachedPassword) {
            try {
              const decrypted = await decryptContent(
                {
                  encryptedContent: firstNote.encryptedContent!,
                  salt: firstNote.salt!,
                  nonce: firstNote.nonce!,
                  authTag: firstNote.authTag!,
                },
                cachedPassword
              )
              setContent(decrypted)
              setDecryptedContents(new Map([[firstNote.id, decrypted]]))
            } catch {
              setContent('')
              setUnlockDialogOpen(true)
            }
          } else {
            setContent('')
            setUnlockDialogOpen(true)
          }
        } else {
          setContent(firstNote.content)
        }
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

      let noteToSave = {
        ...updatedNote,
        title,
        updatedAt: Date.now(),
        userId: user?.id,
      }

      // If note is encrypted, update encrypted content
      if (isNoteEncrypted(updatedNote)) {
        const cachedPassword = getCachedPassword(selectedNoteId)
        if (cachedPassword && content) {
          try {
            const encrypted = await encryptContent(content, cachedPassword)
            noteToSave = {
              ...noteToSave,
              content: '', // Clear plaintext
              encryptedContent: encrypted.encryptedContent,
              salt: encrypted.salt,
              nonce: encrypted.nonce,
              authTag: encrypted.authTag,
            }
            setDecryptedContents((prev) =>
              new Map(prev).set(selectedNoteId, content)
            )
          } catch {
            toast.error('Failed to encrypt content')
            return
          }
        }
      } else {
        noteToSave.content = content
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
      clearPasswordCache(id)
      setDecryptedContents((prev) => {
        const newMap = new Map(prev)
        newMap.delete(id)
        return newMap
      })

      if (selectedNoteId === id) {
        if (updated.length > 0) {
          await selectNote(updated[0])
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

  const selectNote = async (note: Note) => {
    setSelectedNoteId(note.id)
    setTitle(note.title)

    if (isNoteEncrypted(note)) {
      // Check cache first
      const cachedPassword = getCachedPassword(note.id)
      if (cachedPassword) {
        try {
          const decrypted = await decryptContent(
            {
              encryptedContent: note.encryptedContent!,
              salt: note.salt!,
              nonce: note.nonce!,
              authTag: note.authTag!,
            },
            cachedPassword
          )
          setContent(decrypted)
          setDecryptedContents((prev) => new Map(prev).set(note.id, decrypted))
          return
        } catch {
          // Cache invalid, ask for password
        }
      }

      // Check if already unlocked
      const unlocked = decryptedContents.get(note.id)
      if (unlocked) {
        setContent(unlocked)
      } else {
        setContent('')
        setUnlockDialogOpen(true)
      }
    } else {
      setContent(note.content)
    }
  }

  const handleSetEncryption = async () => {
    if (!selectedNoteId || !encryptPassword) return
    setIsEncrypting(true)

    try {
      const currentNote = notes.find((n) => n.id === selectedNoteId)
      if (!currentNote) return

      const encrypted = await encryptContent(content, encryptPassword)

      const updatedNote: Note = {
        ...currentNote,
        content: '', // Clear plaintext
        encryptedContent: encrypted.encryptedContent,
        salt: encrypted.salt,
        nonce: encrypted.nonce,
        authTag: encrypted.authTag,
        updatedAt: Date.now(),
      }

      await notesDB.saveNote(updatedNote)
      setNotes((prev) =>
        prev.map((n) => (n.id === selectedNoteId ? updatedNote : n))
      )

      cachePassword(selectedNoteId, encryptPassword)
      setDecryptedContents((prev) => new Map(prev).set(selectedNoteId, content))

      toast.success('Note encrypted')
      setEncryptDialogOpen(false)
      setEncryptPassword('')
    } catch {
      toast.error('Failed to encrypt note')
    } finally {
      setIsEncrypting(false)
    }
  }

  const handleRemoveEncryption = async () => {
    if (!selectedNoteId) return
    setIsEncrypting(true)

    try {
      const currentNote = notes.find((n) => n.id === selectedNoteId)
      if (!currentNote) return

      const updatedNote: Note = {
        ...currentNote,
        content: content,
        encryptedContent: undefined,
        salt: undefined,
        nonce: undefined,
        authTag: undefined,
        updatedAt: Date.now(),
      }

      await notesDB.saveNote(updatedNote)
      setNotes((prev) =>
        prev.map((n) => (n.id === selectedNoteId ? updatedNote : n))
      )

      clearPasswordCache(selectedNoteId)
      setDecryptedContents((prev) => {
        const newMap = new Map(prev)
        newMap.delete(selectedNoteId)
        return newMap
      })

      toast.success('Encryption removed')
      setEncryptDialogOpen(false)
      setEncryptPassword('')
    } catch {
      toast.error('Failed to remove encryption')
    } finally {
      setIsEncrypting(false)
    }
  }

  const handleUnlock = async () => {
    if (!selectedNoteId || !unlockPassword) return
    setIsDecrypting(true)

    try {
      const currentNote = notes.find((n) => n.id === selectedNoteId)
      if (!currentNote || !isNoteEncrypted(currentNote)) return

      const decrypted = await decryptContent(
        {
          encryptedContent: currentNote.encryptedContent!,
          salt: currentNote.salt!,
          nonce: currentNote.nonce!,
          authTag: currentNote.authTag!,
        },
        unlockPassword
      )

      setContent(decrypted)
      cachePassword(selectedNoteId, unlockPassword)
      setDecryptedContents((prev) =>
        new Map(prev).set(selectedNoteId, decrypted)
      )

      toast.success('Note unlocked')
      setUnlockDialogOpen(false)
      setUnlockPassword('')
    } catch {
      toast.error('Invalid password')
    } finally {
      setIsDecrypting(false)
    }
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
      clearPasswordCache()
      setDecryptedContents(new Map())
      toast.success('Signed out')
    } catch {}
  }

  const selectedNote = notes.find((n) => n.id === selectedNoteId)
  const isCurrentNoteEncrypted = selectedNote
    ? isNoteEncrypted(selectedNote)
    : false
  const isCurrentNoteUnlocked = selectedNoteId
    ? isNoteUnlocked(selectedNoteId)
    : false

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
            {notes.map((note) => {
              const encrypted = isNoteEncrypted(note)
              const unlocked = isNoteUnlocked(note.id)

              return (
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
                          icon={encrypted ? LockIcon : File02Icon}
                          strokeWidth={2}
                          className={cn(
                            'size-4 shrink-0',
                            encrypted
                              ? unlocked
                                ? 'text-green-500'
                                : 'text-yellow-500'
                              : note.userId
                                ? 'text-green-500'
                                : 'text-muted-foreground'
                          )}
                        />
                        <h3 className="font-medium text-sm truncate">
                          {note.title || 'Untitled'}
                        </h3>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {encrypted && !unlocked
                          ? '🔒 Encrypted'
                          : encrypted && unlocked
                            ? decryptedContents.get(note.id)?.substring(0, 60) +
                              '...'
                            : note.content.substring(0, 60) + '...'}
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
              )
            })}
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
                      <Badge variant="secondary" className="ml-auto">
                        Upcoming
                      </Badge>
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

      {/* Login Dialog */}
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

      {/* Encryption Config Dialog */}
      <Dialog open={encryptDialogOpen} onOpenChange={setEncryptDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {isCurrentNoteEncrypted ? 'Manage Encryption' : 'Encrypt Note'}
            </DialogTitle>
            <DialogDescription>
              {isCurrentNoteEncrypted
                ? 'Remove the password to decrypt this note permanently.'
                : 'Set a password to encrypt this note. You are responsible for remembering it.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {isCurrentNoteEncrypted ? (
              <div className="space-y-4">
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-sm text-yellow-600 dark:text-yellow-500">
                    ⚠️ This note is currently encrypted. Removing encryption
                    will save it in plain text.
                  </p>
                </div>
                <Button
                  onClick={handleRemoveEncryption}
                  variant="destructive"
                  className="w-full"
                  size="lg"
                  disabled={isEncrypting}
                >
                  {isEncrypting ? (
                    <>
                      <HugeiconsIcon
                        icon={Loading03Icon}
                        strokeWidth={2}
                        className="animate-spin"
                      />
                      Removing encryption...
                    </>
                  ) : (
                    <>
                      <HugeiconsIcon icon={FileUnlockedIcon} strokeWidth={2} />
                      Remove Encryption
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  handleSetEncryption()
                }}
                className="space-y-4"
              >
                <p className="text-muted-foreground">
                  This feature only encrypt the note content. It does not
                  encrypt title and other metadata.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="encryptPassword">Password</Label>
                  <Input
                    id="encryptPassword"
                    type="password"
                    placeholder="Enter a strong password"
                    value={encryptPassword}
                    onChange={(e) => setEncryptPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <p className="text-xs text-muted-foreground">
                    If you lose this password, the note cannot be recovered.
                  </p>

                  <PasswordValidator value={encryptPassword} />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={isEncrypting || !encryptPassword}
                >
                  {isEncrypting ? (
                    <>
                      <HugeiconsIcon
                        icon={Loading03Icon}
                        strokeWidth={2}
                        className="animate-spin"
                      />
                      Encrypting...
                    </>
                  ) : (
                    <>
                      <HugeiconsIcon icon={LockIcon} strokeWidth={2} />
                      Encrypt Note
                    </>
                  )}
                </Button>
              </form>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Unlock Dialog */}
      <Dialog open={unlockDialogOpen} onOpenChange={setUnlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>🔒 Note Encrypted</DialogTitle>
            <DialogDescription>
              Enter the password to unlock this note.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleUnlock()
            }}
            className="space-y-4 pt-4"
          >
            <div className="space-y-2">
              <Label htmlFor="unlockPassword">Password</Label>
              <Input
                id="unlockPassword"
                type="password"
                placeholder="Enter password"
                value={unlockPassword}
                onChange={(e) => setUnlockPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isDecrypting || !unlockPassword}
            >
              {isDecrypting ? (
                <>
                  <HugeiconsIcon
                    icon={Loading03Icon}
                    strokeWidth={2}
                    className="animate-spin"
                  />
                  Unlocking...
                </>
              ) : (
                <>
                  <HugeiconsIcon icon={FileUnlockedIcon} strokeWidth={2} />
                  Unlock Note
                </>
              )}
            </Button>
          </form>
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
                {isCurrentNoteEncrypted && isCurrentNoteUnlocked && (
                  <Button
                    size="sm"
                    onClick={() => setEncryptDialogOpen(true)}
                    title="Manage encryption"
                  >
                    <HugeiconsIcon icon={LockIcon} strokeWidth={2} />
                    Encrypted
                  </Button>
                )}
                {!isCurrentNoteEncrypted && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setEncryptDialogOpen(true)}
                    title="Configure encryption"
                  >
                    <HugeiconsIcon icon={FileUnlockedIcon} strokeWidth={2} />
                    No encryption
                  </Button>
                )}
                {isCurrentNoteEncrypted && !isCurrentNoteUnlocked && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setUnlockDialogOpen(true)}
                  >
                    <HugeiconsIcon icon={LockIcon} strokeWidth={2} />
                    Unlock
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={formatMarkdown}
                  disabled={
                    showPreview ||
                    isFormatting ||
                    (!isCurrentNoteUnlocked && isCurrentNoteEncrypted)
                  }
                  title="Format markdown (Cmd+F)"
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
                  disabled={!isCurrentNoteUnlocked && isCurrentNoteEncrypted}
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
              {isCurrentNoteEncrypted && !isCurrentNoteUnlocked ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <HugeiconsIcon
                      icon={LockIcon}
                      strokeWidth={2}
                      className="size-12 mx-auto mb-4 opacity-50"
                    />
                    <p className="text-lg mb-4">🔒 This note is encrypted</p>
                    <Button onClick={() => setUnlockDialogOpen(true)} size="lg">
                      <HugeiconsIcon icon={FileUnlockedIcon} strokeWidth={2} />
                      Unlock Note
                    </Button>
                  </div>
                </div>
              ) : showPreview ? (
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
