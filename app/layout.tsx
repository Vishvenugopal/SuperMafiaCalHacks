import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || 'SuperMafia',
  description: 'AI-hosted Werewolf',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-bg text-fg" suppressHydrationWarning>
        <div className="mx-auto max-w-md p-4">{children}</div>
      </body>
    </html>
  )
}
