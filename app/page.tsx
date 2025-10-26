"use client"
import Link from 'next/link'

// Game title styling constant
const GAME_TITLE_STYLE = {
  fontFamily: 'Boldonse, sans-serif',
  background: 'linear-gradient(135deg, #ff0000 0%, #cc0000 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  paddingTop: '0.1em',
  paddingBottom: '0.1em',
  lineHeight: '1.2'
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
    <div className={`relative glass-strong rounded-3xl p-8 transition-all duration-500 h-full flex flex-col items-center justify-center animate-fadeIn ${
      locked 
        ? 'opacity-50 cursor-not-allowed' 
        : 'hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/30 cursor-pointer animate-float'
    }`}>
      {locked && (
        <div className="absolute top-4 right-4 text-3xl opacity-70">🔒</div>
      )}
      <div className="text-7xl mb-6 text-center animate-float">{icon}</div>
      <h2 className="text-4xl font-bold text-center mb-4" style={{ fontFamily: 'Boldonse, sans-serif', background: 'linear-gradient(135deg, #ff0000 0%, #cc0000 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', paddingTop: '0.1em', paddingBottom: '0.1em', lineHeight: '1.2', display: 'inline-block' }}>
        {title}
      </h2>
      <p className="text-center text-gray-300 text-base leading-relaxed">
        {description}
      </p>
      {locked && (
        <div className="mt-6 text-center text-yellow-400 text-sm font-semibold tracking-wider">
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
    <main className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="max-w-5xl w-full space-y-16 animate-fadeIn">
        {/* Title */}
        <div className="text-center space-y-4">
          <h1 className="text-8xl font-bold mb-4 animate-float" style={{...GAME_TITLE_STYLE, display: 'inline-block'}}>
            Super Mafia
          </h1>
          <div className="h-1 w-32 mx-auto bg-gradient-to-r from-transparent via-red-500 to-transparent rounded-full"></div>
        </div>

        {/* Subtitle */}
        <p className="text-center text-2xl text-gray-300 font-light tracking-wide">
          Choose Your Game Mode
        </p>

        {/* Game Mode Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 px-4">
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
