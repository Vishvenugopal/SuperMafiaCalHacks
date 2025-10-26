"use client"
import Link from 'next/link'

// Game title styling constant
const GAME_TITLE_STYLE = {
  fontFamily: 'Creepster, cursive',
  color: '#DC2626',
  textShadow: '3px 3px 6px rgba(0, 0, 0, 0.8), 0 0 20px rgba(220, 38, 38, 0.5)'
}

interface GameModeCardProps {
  title: string
  description: string
  icon: string
  href?: string
  locked?: boolean
}

function GameModeCard({ title, description, icon, href, locked = false }: GameModeCardProps) {
  const cardContent = (
    <div className={`relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-2xl p-8 border-2 transition-all duration-300 h-full flex flex-col items-center justify-center ${
      locked 
        ? 'border-gray-700 opacity-60 cursor-not-allowed' 
        : 'border-red-600 hover:border-red-500 hover:shadow-2xl hover:shadow-red-900/50 hover:scale-105 cursor-pointer'
    }`}>
      {locked && (
        <div className="absolute top-4 right-4 text-3xl">🔒</div>
      )}
      <div className="text-6xl mb-4 text-center">{icon}</div>
      <h2 className="text-3xl font-bold text-center mb-3" style={locked ? {} : { color: '#DC2626' }}>
        {title}
      </h2>
      <p className="text-center text-gray-400 text-sm">
        {description}
      </p>
      {locked && (
        <div className="mt-4 text-center text-yellow-500 text-xs font-semibold">
          COMING SOON
        </div>
      )}
    </div>
  )

  if (locked || !href) {
    return cardContent
  }

  return (
    <Link href={href as string} className="block h-full">
      {cardContent}
    </Link>
  )
}

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4">
      <div className="max-w-4xl w-full space-y-12">
        {/* Title */}
        <h1 className="text-7xl font-bold text-center mb-12" style={GAME_TITLE_STYLE}>
          Super Mafia
        </h1>

        {/* Subtitle */}
        <p className="text-center text-xl text-gray-400 mb-8">
          Choose Your Game Mode
        </p>

        {/* Game Mode Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <GameModeCard
            title="Werewolf"
            description="Classic social deduction game with werewolves, villagers, and special roles"
            icon="🐺"
            href="/werewolf"
          />
          
          <GameModeCard
            title="Game Mode 2"
            description="A new exciting game mode coming soon"
            icon="🎭"
            locked={true}
          />
        </div>
      </div>
    </main>
  )
}
