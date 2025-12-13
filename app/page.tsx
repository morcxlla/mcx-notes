'use client'

import { useEffect, useState } from 'react'
import {
  Delete01Icon,
  File02Icon,
  Logout01Icon,
  PlusSignIcon,
  SourceCodeIcon,
  UserIcon,
  ViewIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTheme } from 'next-themes'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'

import { notesDB, type Note } from '@/lib/db'
import { cn } from '@/lib/utils'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

export default function NotesApp() {
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  const { setTheme, theme, resolvedTheme } = useTheme()

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
  }, [title, content, selectedNoteId, notes])

  const createNewNote = async () => {
    const newNote: Note = {
      id: crypto.randomUUID(),
      title: 'New note',
      content: '# New note\n\nStart writing here...',
      createdAt: Date.now(),
      updatedAt: Date.now(),
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
                  'p-3 cursor-pointer transition-colors bg-card ',
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
                        className="size-4 text-muted-foreground shrink-0"
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
                <HugeiconsIcon icon={UserIcon} strokeWidth={2} />
              </div>
              <p className="flex-1 text-left leading-none line-clamp-1">
                {'example@example.com'}
              </p>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuGroup>
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Profile</DropdownMenuItem>
                <DropdownMenuItem
                  className="group"
                  onClick={() => {
                    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')
                  }}
                >
                  Night mode
                  <Switch
                    checked={resolvedTheme === 'dark'}
                    onCheckedChange={(checked) =>
                      setTheme(checked ? 'dark' : 'light')
                    }
                    className="ml-auto dark:group-hover:bg-secondary/60"
                  />
                </DropdownMenuItem>
                <DropdownMenuItem>Team</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive">
                  <HugeiconsIcon icon={Logout01Icon} strokeWidth={2} />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

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
                    <ReactMarkdown>{content}</ReactMarkdown>
                  </div>
                </ScrollArea>
              ) : (
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Escribe tu nota en markdown..."
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
