import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || 'SuperMafia',
  description: 'AI-hosted Werewolf',
  icons: {
    icon: '/SuperMafiaLogo.png',
    shortcut: '/SuperMafiaLogo.png',
    apple: '/SuperMafiaLogo.png',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Boldonse:wght@400;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-dvh" suppressHydrationWarning>
        <div className="relative z-[1] h-dvh overflow-y-auto px-4 py-6">{children}</div>
      </body>
    </html>
  )
}
