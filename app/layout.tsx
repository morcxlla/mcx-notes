import './globals.css'

import type { Metadata } from 'next'
import { JetBrains_Mono, Public_Sans } from 'next/font/google'
import { ThemeProvider } from 'next-themes'

import { cn } from '@/lib/utils'
import { Toaster } from '@/components/ui/sonner'

const fontSans = Public_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
})

const fontMono = JetBrains_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'MCX.NOTES',
  description: '',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          'antialiased bg-background text-foreground',
          fontSans.variable,
          fontMono.variable
        )}
      >
        <ThemeProvider attribute="class">
          {children}
          <Toaster richColors position="bottom-center" />
        </ThemeProvider>
      </body>
    </html>
  )
}
