"use client"
import { useGame } from '@/store/game'
import { Player } from '@/lib/types'
import { useRef, useState, useEffect, useCallback, type ButtonHTMLAttributes, type ReactNode, type ChangeEvent } from 'react'
import { ttsSpeak, isTtsAvailable, startSttStream, stopSttStream } from '@/lib/voice'

// Game title styling constant
const GAME_TITLE_STYLE = {
  fontFamily: 'Boldonse, sans-serif',
  background: 'linear-gradient(135deg, #ff0000 0%, #cc0000 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  backgroundClip: 'text',
  paddingTop: '0.1em',
  paddingBottom: '0.1em',
  lineHeight: '1.2',
  display: 'inline-block'
}

// Game instructions constant
const GAME_INSTRUCTIONS = `
**Welcome to Werewolf!**

**Objective:**
- Villagers: Identify and eliminate all werewolves
- Werewolves: Eliminate villagers until they equal or outnumber them

**Roles:**
🐺 **Werewolf** - Eliminates one player each night
🔮 **Seer** - Can peek at one player's role each night
💉 **Medic** - Can protect one player from elimination each night
🧑 **Villager** - No special abilities, but can vote during the day

**Game Flow:**
1. **Night Phase** - Players with special roles take their actions secretly
2. **Day Phase** - The village discusses and votes to eliminate a suspected werewolf
3. Repeat until one team wins

**Tips:**
- Pay attention to voting patterns and player behavior
- Werewolves must blend in with villagers
- Special roles should use their abilities wisely
- Discussion and deduction are key to victory!

Good luck, and may the best team win! 🎭
`.trim()

function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={`glass-strong rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-300 hover:scale-105 active:scale-95 ${props.className || ''}`}></button>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2 animate-slideIn">
      <div className="text-base font-bold gradient-text">{title}</div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function PlayerCard({ p, onRemove }: { p: Player; onRemove?: () => void }) {
  return (
    <div className="flex items-center gap-2 glass rounded-xl p-2 animate-fadeIn hover:scale-102 transition-transform">
      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 overflow-hidden flex items-center justify-center">
        {p.avatarDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.avatarDataUrl} alt={p.name} className="w-full h-full object-cover" />
        ) : (
          <div className="text-xl">🙂</div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{p.name}</div>
        <div className="text-xs opacity-60">{p.alive ? '✓ Alive' : '✗ Out'}</div>
      </div>
      {!!onRemove && (
        <button onClick={onRemove} className="text-xs px-2 py-1 bg-red-500/80 rounded-lg hover:bg-red-500 transition-colors">×</button>
      )}
    </div>
  )
}

function NumberPicker({ value, setValue, min = 0, max = 6, label }: { value: number; setValue: (n: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="flex items-center justify-between glass rounded-xl p-2">
      <div className="font-medium text-sm">{label}</div>
      <div className="flex items-center gap-2">
        <button onClick={() => setValue(Math.max(min, value - 1))} className="w-7 h-7 rounded-lg glass-strong hover:scale-110 transition-transform">-</button>
        <div className="w-8 text-center font-bold">{value}</div>
        <button onClick={() => setValue(Math.min(max, value + 1))} className="w-7 h-7 rounded-lg glass-strong hover:scale-110 transition-transform">+</button>
      </div>
    </div>
  )
}

function useNow(ms: number) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

// Inline markdown renderer for **bold** within a line
function renderInlineMarkdown(text: string) {
  const parts: Array<string | { bold: string }> = []
  const regex = /\*\*(.+?)\*\*/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    parts.push({ bold: match[1] })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return (
    <>
      {parts.map((p, i) =>
        typeof p === 'string' ? (
          <span key={i}>{p}</span>
        ) : (
          <strong key={i} className="font-semibold text-red-300">{p.bold}</strong>
        )
      )}
    </>
  )
}

function InstructionsPopup({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn" onClick={onClose}>
      <div className="glass-strong rounded-3xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-3xl font-bold" style={GAME_TITLE_STYLE}>Instructions</h2>
          <button onClick={onClose} className="text-3xl text-gray-400 hover:text-white leading-none transition-colors">×</button>
        </div>
        <div className="space-y-3 text-gray-300 text-sm">
          {GAME_INSTRUCTIONS.split('\n').map((line, i) => {
            if (line.trim().startsWith('**') && line.trim().endsWith('**')) {
              const text = line.replace(/\*\*/g, '').trim()
              return <div key={i} className="text-lg font-bold text-red-400 mt-3">{text}</div>
            }
            if (line.trim()) {
              return <div key={i} className="leading-relaxed">{renderInlineMarkdown(line)}</div>
            }
            return <div key={i} className="h-2"></div>
          })}
        </div>
        <div className="mt-6">
          <Button onClick={onClose} className="w-full bg-gradient-to-r from-red-600 to-red-800 text-white">Got it!</Button>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  const g = useGame()
  const [newName, setNewName] = useState('')
  const [newPhoto, setNewPhoto] = useState<string | undefined>()
  const [hostResponse, setHostResponse] = useState<string>('')
  const [hostProvider, setHostProvider] = useState<string>('')
  const [userTranscript, setUserTranscript] = useState('')
  const [listening, setListening] = useState(false)
  const [showInstructions, setShowInstructions] = useState(true) // Show on first load
  const [showApiKeys, setShowApiKeys] = useState(false) // API Keys section collapsed by default
  const fileRef = useRef<HTMLInputElement>(null)
  const now = useNow(200)
  const timerCheckedRef = useRef(false)
  const kbHoldingRef = useRef(false)

  // Helper function to get narrator response (wrapped in useCallback to capture current settings)
  const getNarratorResponse = useCallback(async (prompt: string) => {
    try {
      const gameContext = {
        phase: g.phase,
        round: g.round,
        alivePlayers: g.players.filter(p => p.alive).map(p => ({ id: p.id, name: p.name })),
        deadPlayers: g.players.filter(p => !p.alive).map(p => ({ id: p.id, name: p.name })),
        totalPlayers: g.players.length,
        recentEvents: g.eventLog.slice(-3)
      }
      
      console.log('[Frontend] Sending narrator request with provider:', g.settings.aiProvider)
      const res = await fetch('/api/host', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ question: prompt, gameContext, provider: g.settings.aiProvider }) 
      })
      const data = await res.json()
      const answer = String(data.answer || '')
      setHostResponse(answer)
      setHostProvider(data.provider || 'unknown')
      await ttsSpeak(answer)
    } catch (error) {
      console.error('Narrator error:', error)
    }
  }, [g.phase, g.round, g.players, g.eventLog, g.settings.aiProvider])

  // Handle final transcript -> call host (wrapped in useCallback to prevent stale closures)
  const handleFinalTranscript = useCallback(async (finalText: string | null) => {
    const q = (finalText || '').trim()
    setListening(false)
    if (!q) return
    setHostResponse('Thinking...')
    setHostProvider('')
    try {
      const gameContext = {
        phase: g.phase,
        round: g.round,
        alivePlayers: g.players.filter(p => p.alive).map(p => ({ id: p.id, name: p.name, alive: p.alive })),
        deadPlayers: g.players.filter(p => !p.alive).map(p => ({ id: p.id, name: p.name, alive: p.alive })),
        totalPlayers: g.players.length,
        recentEvents: g.eventLog.slice(-3)
      }
      console.log('[Frontend] Sending user question with provider:', g.settings.aiProvider)
      const res = await fetch('/api/host', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, gameContext, provider: g.settings.aiProvider })
      })
      const data = await res.json()
      const answer = String(data.answer || '')
      setHostResponse(answer)
      setHostProvider(data.provider || 'unknown')
      await ttsSpeak(answer)
    } catch (error) {
      const errorMsg = 'I could not reach the host right now.'
      setHostResponse(errorMsg)
      setHostProvider('error')
      await ttsSpeak(errorMsg)
    }
  }, [g.phase, g.round, g.players, g.eventLog, g.settings.aiProvider])

  // Keyboard tap-to-talk (Space or V) - toggle on/off
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (key !== ' ' && key !== 'v') return
      // avoid when typing in inputs/textareas/contentEditable
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (kbHoldingRef.current) return // Prevent multiple key events
      e.preventDefault() // Prevent space from scrolling page
      kbHoldingRef.current = true
    }
    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if ((key === ' ' || key === 'v') && kbHoldingRef.current) {
        e.preventDefault()
        kbHoldingRef.current = false
        
        // Toggle listening state
        if (listening) {
          // Stop listening
          stopSttStream(true)
          setListening(false)
        } else {
          // Start listening
          setUserTranscript('')
          const ok = startSttStream((partial) => setUserTranscript(partial), (finalText) => {
            handleFinalTranscript(finalText)
            setListening(false)
          })
          if (ok) setListening(true)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [handleFinalTranscript, listening])

  // Auto-progress when discussion timer hits 0
  useEffect(() => {
    if (g.phase.kind === 'Discussion') {
      const endsAt = g.phase.endsAt || 0
      const remain = Math.max(0, Math.round((endsAt - now) / 1000))
      
      if (remain === 0 && !timerCheckedRef.current) {
        timerCheckedRef.current = true
        getNarratorResponse('Time is up! The village must now vote. Be urgent and dramatic. 1-2 sentences.')
        setTimeout(() => {
          g.startVoting()
          timerCheckedRef.current = false
        }, 2000)
      } else if (remain > 0) {
        timerCheckedRef.current = false
      }
    }
  }, [g.phase, now, getNarratorResponse])

  // Narrator announcements for phase changes and timing DayStart reveal with TTS
  useEffect(() => {
    if (g.phase.kind === 'DayStart') {
      const round = g.round
      const items = g.eventLog.filter(e => e.round === round && e.public)
      const death = items.find(e => e.type === 'night_kill')
      ;(async () => {
        setDayRevealShown(false)
        setDayRevealDone(false)
        if (isTtsAvailable()) {
          if (death) {
            const victim = g.players.find(p => p.id === death.data.playerId)
            await getNarratorResponse(`The village awakens to find ${victim?.name} dead. Announce this death dramatically and ominously in 1-2 sentences.`)
          } else {
            await getNarratorResponse('Everyone survived the night. Express relief but remind them the danger remains. 1-2 sentences.')
          }
        }
        // Reveal the card only after narration completes (or immediately if TTS unavailable)
        setDayRevealShown(true)
        setDayRevealDone(true)
      })()
    } else if (g.phase.kind === 'NightStart') {
      getNarratorResponse('Night falls over the village. Warn them of the dangers ahead. Be ominous. 1-2 sentences.')
    } else if (g.phase.kind === 'LynchResolve') {
      const round = g.round
      const lynch = [...g.eventLog].reverse().find(e => e.type === 'lynch' && e.round === round)
      if (lynch) {
        const victim = g.players.find(p => p.id === lynch.data.playerId)
        const roleDisplay = victim?.role === 'werewolf' ? 'a Werewolf' : 
                           victim?.role === 'seer' ? 'the Seer' : 
                           victim?.role === 'medic' ? 'the Medic' : 'a Villager'
        getNarratorResponse(`${victim?.name} has been eliminated by vote. Reveal that they were ${roleDisplay}. Announce their fate and role dramatically. 1-2 sentences.`)
      } else {
        getNarratorResponse('The village could not agree on who to eliminate. Express the tension. 1-2 sentences.')
      }
    }
  }, [g.phase, g.round, g.eventLog, g.players, getNarratorResponse])

  const addPlayer = () => {
    if (!newName.trim()) return
    g.addPlayer(newName.trim(), newPhoto)
    setNewName('')
    setNewPhoto(undefined)
    if (fileRef.current) fileRef.current.value = ''
  }

  const renderLobby = () => {
    const players = g.players
    const werewolves = g.settings.rolesEnabled.werewolf ?? 1
    const seers = g.settings.rolesEnabled.seer ?? 1
    const medics = g.settings.rolesEnabled.medic ?? 1
    
    // Calculate minimum required players based on roles
    const specialRoles = werewolves + seers + medics
    const minPlayers = Math.max(5, specialRoles + 2) // At least 2 villagers
    const playersNeeded = Math.max(0, minPlayers - players.length)
    
    return (
      <div className="space-y-4 animate-fadeIn">
        <h1 className="text-4xl font-bold text-center" style={GAME_TITLE_STYLE}>
          Werewolf
        </h1>
        <Section title="Players">
          <div className="space-y-2">
            {playersNeeded > 0 && (
              <div className="glass rounded-lg p-2 text-center text-yellow-300 text-xs">
                Need {playersNeeded} more player{playersNeeded === 1 ? '' : 's'}
              </div>
            )}
            {players.map(p => (
              <PlayerCard key={p.id} p={p} onRemove={() => g.removePlayer(p.id)} />
            ))}
            <div className="glass rounded-xl p-2 space-y-1.5">
              <input 
                type="text"
                value={newName} 
                onChange={e => setNewName(e.target.value)} 
                placeholder="Player name" 
                className="w-full glass-strong rounded-lg px-3 py-2 text-sm outline-none"
                autoComplete="off"
              />
              <input ref={fileRef} type="file" accept="image/*" capture="user" onChange={e => {
                const f = e.target.files?.[0]
                if (!f) return
                const r = new FileReader()
                r.onload = () => setNewPhoto(String(r.result))
                r.readAsDataURL(f)
              }} className="w-full text-xs" />
              <Button onClick={addPlayer} className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white">Add Player</Button>
            </div>
          </div>
        </Section>
        <Section title="Roles">
          <NumberPicker label="🐺 Werewolves" value={werewolves} setValue={n => g.updateRolesEnabled('werewolf', n)} min={1} max={5} />
          <NumberPicker label="🔮 Seer" value={seers} setValue={n => g.updateRolesEnabled('seer', n)} min={0} max={2} />
          <NumberPicker label="💉 Medic" value={medics} setValue={n => g.updateRolesEnabled('medic', n)} min={0} max={2} />
        </Section>
        <Section title="Settings">
          <select value={g.settings.aiProvider} onChange={e => g.updateSettings({ aiProvider: e.target.value as any })} className="w-full select-glass text-sm">
            <option value="auto">Auto AI</option>
            <option value="baseten">Baseten</option>
            <option value="janitorai">JanitorAI</option>
          </select>
        </Section>
        <div className="bg-white/5 rounded-xl p-3">
          <button 
            onClick={() => setShowApiKeys(!showApiKeys)}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="text-lg font-semibold opacity-90">API Keys (Optional)</span>
            <span className="text-xl transform transition-transform" style={{ transform: showApiKeys ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
          </button>
          {showApiKeys && (
            <div className="mt-3 space-y-3">
              <div className="text-xs opacity-60 mb-2">Override API keys for this session only</div>
              
              <div className="space-y-2">
                <label className="text-sm opacity-70">LiveKit WebSocket URL</label>
                <input 
                  type="text"
                  value={g.settings.apiKeys?.livekitWsUrl || ''}
                  onChange={e => g.updateSettings({ apiKeys: { ...g.settings.apiKeys, livekitWsUrl: e.target.value } })}
                  placeholder="wss://..."
                  className="w-full bg-white/10 rounded px-3 py-2 text-sm outline-none"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm opacity-70">LiveKit API Key</label>
                <input 
                  type="text"
                  value={g.settings.apiKeys?.livekitApiKey || ''}
                  onChange={e => g.updateSettings({ apiKeys: { ...g.settings.apiKeys, livekitApiKey: e.target.value } })}
                  placeholder="API..."
                  className="w-full bg-white/10 rounded px-3 py-2 text-sm outline-none"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm opacity-70">LiveKit API Secret</label>
                <input 
                  type="password"
                  value={g.settings.apiKeys?.livekitApiSecret || ''}
                  onChange={e => g.updateSettings({ apiKeys: { ...g.settings.apiKeys, livekitApiSecret: e.target.value } })}
                  placeholder="Secret..."
                  className="w-full bg-white/10 rounded px-3 py-2 text-sm outline-none"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm opacity-70">Baseten API Key</label>
                <input 
                  type="password"
                  value={g.settings.apiKeys?.basetenApiKey || ''}
                  onChange={e => g.updateSettings({ apiKeys: { ...g.settings.apiKeys, basetenApiKey: e.target.value } })}
                  placeholder="API Key..."
                  className="w-full bg-white/10 rounded px-3 py-2 text-sm outline-none"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm opacity-70">Baseten Model ID</label>
                <input 
                  type="text"
                  value={g.settings.apiKeys?.basetenModelId || ''}
                  onChange={e => g.updateSettings({ apiKeys: { ...g.settings.apiKeys, basetenModelId: e.target.value } })}
                  placeholder="Model ID..."
                  className="w-full bg-white/10 rounded px-3 py-2 text-sm outline-none"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm opacity-70">JanitorAI API Key</label>
                <input 
                  type="password"
                  value={g.settings.apiKeys?.janitorAiApiKey || ''}
                  onChange={e => g.updateSettings({ apiKeys: { ...g.settings.apiKeys, janitorAiApiKey: e.target.value } })}
                  placeholder="API Key..."
                  className="w-full bg-white/10 rounded px-3 py-2 text-sm outline-none"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm opacity-70">JanitorAI Character ID</label>
                <input 
                  type="text"
                  value={g.settings.apiKeys?.janitorAiCharacterId || ''}
                  onChange={e => g.updateSettings({ apiKeys: { ...g.settings.apiKeys, janitorAiCharacterId: e.target.value } })}
                  placeholder="Character ID..."
                  className="w-full bg-white/10 rounded px-3 py-2 text-sm outline-none"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm opacity-70">ElevenLabs API Key</label>
                <input 
                  type="password"
                  value={g.settings.apiKeys?.elevenlabsApiKey || ''}
                  onChange={e => g.updateSettings({ apiKeys: { ...g.settings.apiKeys, elevenlabsApiKey: e.target.value } })}
                  placeholder="API Key..."
                  className="w-full bg-white/10 rounded px-3 py-2 text-sm outline-none"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm opacity-70">ElevenLabs Voice ID</label>
                <input 
                  type="text"
                  value={g.settings.apiKeys?.elevenlabsVoiceId || ''}
                  onChange={e => g.updateSettings({ apiKeys: { ...g.settings.apiKeys, elevenlabsVoiceId: e.target.value } })}
                  placeholder="Voice ID..."
                  className="w-full bg-white/10 rounded px-3 py-2 text-sm outline-none"
                />
              </div>
            </div>
          )}
        </div>
        <Button className="w-full bg-gradient-to-r from-red-500 to-orange-500 text-white disabled:opacity-50 disabled:cursor-not-allowed" onClick={g.startGame} disabled={players.length < minPlayers}>
          Start Game
        </Button>
      </div>
    )
  }

  // All state at parent level to prevent focus loss
  const [roleRevealed, setRoleRevealed] = useState(false)
  const [lastRevealedIndex, setLastRevealedIndex] = useState(-1)
  const [nightPlayerIndex, setNightPlayerIndex] = useState(0)
  const [nightRevealed, setNightRevealed] = useState(false)
  const [lastNightPlayerIndex, setLastNightPlayerIndex] = useState(-1)
  const [peekResult, setPeekResult] = useState<{ playerId: string; role: string } | null>(null)
  const [dayRevealShown, setDayRevealShown] = useState(false)
  const [dayRevealDone, setDayRevealDone] = useState(false)
  const [showNightIntro, setShowNightIntro] = useState(false)

  // Reset revealed state when moving to next player
  if (g.phase.kind === 'RoleAssignment' && g.ui.roleRevealIndex !== lastRevealedIndex) {
    if (roleRevealed) setRoleRevealed(false)
    setLastRevealedIndex(g.ui.roleRevealIndex)
  }

  // Reset night revealed state when player changes
  if (g.phase.kind === 'NightStart' && nightPlayerIndex !== lastNightPlayerIndex) {
    if (nightRevealed) setNightRevealed(false)
    setLastNightPlayerIndex(nightPlayerIndex)
  }

  // Reset night index when phase changes
  useEffect(() => {
    if (g.phase.kind === 'NightStart') {
      setNightPlayerIndex(0)
      setNightRevealed(false)
      setPeekResult(null)
    }
  }, [g.phase.kind])

  const renderRoleAssignment = () => {
    const id = g.ui.roleRevealOrder[g.ui.roleRevealIndex]
    const player = g.players.find(p => p.id === id)
    if (!player) return null
    const role = player.role || 'villager'
    return (
      <div className="space-y-6">
        {!roleRevealed ? (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 overflow-hidden flex items-center justify-center">
                {player.avatarDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={player.avatarDataUrl} alt={player.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-5xl">🙂</div>
                )}
              </div>
              <div className="text-center text-2xl font-bold">{player.name}</div>
            </div>
            <Button className="w-full" onClick={() => setRoleRevealed(true)}>Tap to reveal role</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 overflow-hidden flex items-center justify-center">
                {player.avatarDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={player.avatarDataUrl} alt={player.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-5xl">🙂</div>
                )}
              </div>
              <div className="text-center text-2xl font-bold">{player.name}</div>
            </div>
            <div className="text-center text-4xl">{role === 'werewolf' ? '🐺 Werewolf' : role === 'seer' ? '🔮 Seer' : role === 'medic' ? '💉 Medic' : '🧑 Villager'}</div>
            {g.ui.roleRevealIndex + 1 < g.ui.roleRevealOrder.length ? (
              <Button className="w-full" onClick={() => { setRoleRevealed(false); g.nextRoleReveal() }}>Done, pass to next</Button>
            ) : (
              <Button className="w-full" onClick={() => setShowNightIntro(true)}>Begin Night</Button>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderNightIntro = () => {
    const round = g.round
    return (
      <div className="space-y-6">
        <div className="text-center text-3xl font-bold mb-4">🌙 Night {round} Begins</div>
        <div className="space-y-4">
          <div className="text-center text-xl opacity-80">Night descends. Prepare for the night phase.</div>
          <div className="bg-purple-900/30 border-2 border-purple-500 rounded-xl p-6 space-y-3">
            <div className="text-center text-4xl">🌌</div>
            <div className="text-center text-lg text-purple-200">Get ready for night actions.</div>
          </div>
        </div>
        <Button className="w-full" onClick={() => { setShowNightIntro(false); g.proceedFromRoleReveal() }}>Begin Night Actions</Button>
      </div>
    )
  }

  const renderNightStart = () => {
    const alive = g.players.filter(p => p.alive)
    const wolves = alive.filter(p => p.role === 'werewolf')
    
    // If we've gone through all players, show completion
    if (nightPlayerIndex >= alive.length) {
      return (
        <div className="space-y-4">
          <div className="text-center text-2xl">Night actions complete</div>
          <Button className="w-full" onClick={() => g.resolveNight()}>Continue to Day</Button>
        </div>
      )
    }
    
    const currentPlayer = alive[nightPlayerIndex]
    const role = currentPlayer.role
    
    // Seer peek result display
    if (peekResult) {
      const peekedPlayer = g.players.find(p => p.id === peekResult.playerId)
      const roleDisplay = peekResult.role === 'werewolf' ? '🐺 Werewolf' : 
                         peekResult.role === 'seer' ? '🔮 Seer' : 
                         peekResult.role === 'medic' ? '💉 Medic' : '🧑 Villager'
      return (
        <div className="space-y-4">
          <div className="text-center text-xl">🔮 Seer Vision</div>
          <div className="text-center text-2xl">{peekedPlayer?.name}</div>
          <div className="text-center text-3xl">{roleDisplay}</div>
          <Button className="w-full" onClick={() => { 
            setNightPlayerIndex(nightPlayerIndex + 1)
            setNightRevealed(false)
            setPeekResult(null)
          }}>Continue</Button>
        </div>
      )
    }
    
    return (
      <div className="space-y-4">
        {!nightRevealed ? (
          <>
            <div className="flex flex-col items-center gap-3">
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 overflow-hidden flex items-center justify-center">
                {currentPlayer.avatarDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={currentPlayer.avatarDataUrl} alt={currentPlayer.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="text-5xl">🙂</div>
                )}
              </div>
              <div className="text-center text-2xl font-bold">{currentPlayer.name}</div>
            </div>
            <Button className="w-full" onClick={() => setNightRevealed(true)}>Tap to see your role</Button>
          </>
        ) : (
          <>
            {role === 'medic' ? (
              <div className="space-y-3">
                <div className="text-center text-xl">💉 Medic</div>
                <div className="text-center">Choose a player to protect</div>
                <div className="grid grid-cols-2 gap-2">
                  {alive.map(p => (
                    <button key={p.id} onClick={() => { 
                      g.chooseProtect(p.id)
                      setNightPlayerIndex(nightPlayerIndex + 1)
                      setNightRevealed(false)
                    }} className="bg-white/10 rounded-xl p-3 hover:bg-white/20 transition-colors">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 overflow-hidden flex items-center justify-center">
                          {p.avatarDataUrl ? (
                            <img src={p.avatarDataUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-2xl">🙂</div>
                          )}
                        </div>
                        <div className="text-center text-sm">{p.name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : role === 'werewolf' ? (
              <div className="space-y-3">
                <div className="text-center text-xl">🐺 Werewolf</div>
                <div className="text-center">Choose a player to eliminate</div>
                <div className="text-center text-xs opacity-60 mb-2">Other wolves: {wolves.filter(w => w.id !== currentPlayer.id).map(w => w.name).join(', ') || 'none'}</div>
                <div className="grid grid-cols-2 gap-2">
                  {alive.filter(p => p.role !== 'werewolf').map(p => (
                    <button key={p.id} onClick={() => { 
                      g.chooseKill(p.id)
                      // Skip to next non-werewolf or end
                      let nextIdx = nightPlayerIndex + 1
                      while (nextIdx < alive.length && alive[nextIdx].role === 'werewolf') {
                        nextIdx++
                      }
                      setNightPlayerIndex(nextIdx)
                      setNightRevealed(false)
                    }} className="bg-white/10 rounded-xl p-3 hover:bg-white/20 transition-colors">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 overflow-hidden flex items-center justify-center">
                          {p.avatarDataUrl ? (
                            <img src={p.avatarDataUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-2xl">🙂</div>
                          )}
                        </div>
                        <div className="text-center text-sm">{p.name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : role === 'seer' ? (
              <div className="space-y-3">
                <div className="text-center text-xl">🔮 Seer</div>
                <div className="text-center">Choose a player to peek</div>
                <div className="grid grid-cols-2 gap-2">
                  {alive.filter(p => p.id !== currentPlayer.id).map(p => (
                    <button key={p.id} onClick={() => { 
                      g.choosePeek(p.id)
                      const targetRole = p.role || 'villager'
                      setPeekResult({ playerId: p.id, role: targetRole })
                    }} className="bg-white/10 rounded-xl p-3 hover:bg-white/20 transition-colors">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 overflow-hidden flex items-center justify-center">
                          {p.avatarDataUrl ? (
                            <img src={p.avatarDataUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="text-2xl">🙂</div>
                          )}
                        </div>
                        <div className="text-center text-sm">{p.name}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-center text-xl">🧑 Villager</div>
                <div className="text-center">You have no special actions at night</div>
                <Button className="w-full" onClick={() => { 
                  setNightPlayerIndex(nightPlayerIndex + 1)
                  setNightRevealed(false)
                }}>Continue</Button>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  const renderDayStart = () => {
    const round = g.round
    const events = g.eventLog.filter(e => e.round === round && e.public)
    const death = events.find(e => e.type === 'night_kill')
    const victim = g.players.find(p => p.id === death?.data.playerId)
    
    return (
      <div className="space-y-6">
        <div className="text-center text-3xl font-bold mb-4">☀️ Day {round} Dawns</div>
        
        {death && victim ? (
          <div className="space-y-4">
            <div className="text-center text-xl opacity-80">The village awakens to a horrifying discovery...</div>
            {dayRevealShown && (
              <div className="bg-red-900/30 border-2 border-red-500 rounded-xl p-6 space-y-3">
                <div className="text-center text-4xl">💀</div>
                <div className="text-center text-3xl font-bold text-red-400">{victim.name}</div>
                <div className="text-center text-xl text-red-300">has been eliminated</div>
                <div className="text-center text-sm opacity-70">Killed during the night</div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center text-xl opacity-80">The village awakens...</div>
            {dayRevealShown && (
              <div className="bg-green-900/30 border-2 border-green-500 rounded-xl p-6 space-y-3">
                <div className="text-center text-4xl">✨</div>
                <div className="text-center text-2xl font-bold text-green-400">Everyone Survived!</div>
                <div className="text-center text-sm opacity-70">No one was killed during the night</div>
              </div>
            )}
          </div>
        )}

        {dayRevealDone && (
          <Button className="w-full" onClick={() => g.startDiscussion()}>Begin Discussion</Button>
        )}
      </div>
    )
  }

  const renderDiscussion = () => {
    const endsAt = g.phase.kind === 'Discussion' ? g.phase.endsAt || 0 : 0
    const remain = Math.max(0, Math.round((endsAt - now) / 1000))
    const alivePlayers = g.players.filter(p => p.alive)
    const deadPlayers = g.players.filter(p => !p.alive)
    return (
      <div className="space-y-6">
        <div className="text-center text-2xl">Discussion</div>
        <div className="text-center text-xl">{remain}s remaining</div>
        
        {/* Player Status */}
        <div className="space-y-2">
          <div className="text-sm font-semibold opacity-70">Players</div>
          <div className="grid grid-cols-2 gap-2">
            {alivePlayers.map(p => (
              <div key={p.id} className="flex items-center gap-2 bg-green-900/20 border border-green-500/30 rounded-lg p-2">
                <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden flex items-center justify-center">
                  {p.avatarDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatarDataUrl} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-sm">🙂</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-green-400">Alive</div>
                </div>
              </div>
            ))}
            {deadPlayers.map(p => (
              <div key={p.id} className="flex items-center gap-2 bg-red-900/20 border border-red-500/30 rounded-lg p-2 opacity-60">
                <div className="w-8 h-8 rounded-full bg-white/10 overflow-hidden flex items-center justify-center">
                  {p.avatarDataUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.avatarDataUrl} alt={p.name} className="w-full h-full object-cover grayscale" />
                  ) : (
                    <div className="text-sm">💀</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate line-through">{p.name}</div>
                  <div className="text-xs text-red-400">Dead</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Tap-to-talk controls */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={() => {
              if (listening) {
                // Stop listening
                stopSttStream(true)
                setListening(false)
              } else {
                // Start listening
                setUserTranscript('')
                const ok = startSttStream((partial) => setUserTranscript(partial), (finalText) => {
                  handleFinalTranscript(finalText)
                  setListening(false)
                })
                if (ok) setListening(true)
              }
            }}
            className={`w-24 h-24 rounded-full flex items-center justify-center select-none ${listening ? 'bg-red-500 animate-pulse' : 'bg-white text-black'} active:scale-95 transition-all`}
          >
            <span className="text-3xl">🎙️</span>
          </button>
          <div className="text-xs opacity-70">{listening ? '🔴 Listening... (Tap to stop)' : 'Tap mic or press Space/V to talk'}</div>
          {/* Live transcript */}
          <div className="w-full">
            <div className={`min-h-[48px] px-3 py-2 rounded-lg border ${listening ? 'border-red-400 bg-red-950/30' : 'border-white/20 bg-white/5'}`}>
              <div className="text-sm whitespace-pre-wrap break-words">{userTranscript || (listening ? 'Listening…' : 'Tap the mic to ask the host') }</div>
            </div>
          </div>
          <div className="flex gap-2 w-full">
            <Button className="flex-1" onClick={() => g.startVoting()}>Start Voting</Button>
          </div>
        </div>
      </div>
    )
  }

  const renderVoting = () => {
    if (g.phase.kind !== 'Voting') return null
    const voterId = g.phase.voterQueue[g.phase.currentIndex] || null
    const voter = g.players.find(p => p.id === voterId)
    const targets = g.players.filter(p => p.alive)
    const progress = g.phase.voterQueue.length === 0 ? 0 : Math.min(1, g.phase.currentIndex / g.phase.voterQueue.length)
    return (
      <div className="space-y-6">
        <div className="text-center text-2xl">Voting</div>
        <div className="text-center">{voter ? `${voter.name}, choose a player` : 'Finalizing...'}</div>
        <div className="grid grid-cols-2 gap-2">
          {targets.map(p => (
            <button key={p.id} onClick={() => g.castVoteForCurrent(p.id)} className="bg-white/10 rounded-xl p-3">
              <div className="text-center">{p.name}</div>
            </button>
          ))}
          <button onClick={() => g.castVoteForCurrent(null)} className="bg-white/10 rounded-xl p-3">
            <div className="text-center">Abstain</div>
          </button>
        </div>
        <div className="h-2 bg-white/10 rounded">
          <div className="h-full bg-white rounded" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    )
  }

  const renderLynchResolve = () => {
    const round = g.round
    const lynch = [...g.eventLog].reverse().find(e => e.type === 'lynch' && e.round === round)
    const victim = g.players.find(p => p.id === lynch?.data.playerId)
    
    const roleDisplay = victim?.role === 'werewolf' ? '🐺 Werewolf' : 
                       victim?.role === 'seer' ? '🔮 Seer' : 
                       victim?.role === 'medic' ? '💉 Medic' : '🧑 Villager'
    
    return (
      <div className="space-y-6">
        <div className="text-center text-3xl font-bold mb-4">⚖️ The Village Has Decided</div>
        
        {lynch && victim ? (
          <div className="space-y-4">
            <div className="text-center text-xl opacity-80">The votes have been counted...</div>
            <div className="bg-orange-900/30 border-2 border-orange-500 rounded-xl p-6 space-y-3">
              <div className="text-center text-4xl">🔥</div>
              <div className="text-center text-3xl font-bold text-orange-400">{victim.name}</div>
              <div className="text-center text-xl text-orange-300">has been eliminated</div>
              <div className="text-center text-2xl font-bold text-yellow-300 mt-2">{roleDisplay}</div>
              <div className="text-center text-sm opacity-70">Their role has been revealed</div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center text-xl opacity-80">The votes have been counted...</div>
            <div className="bg-blue-900/30 border-2 border-blue-500 rounded-xl p-6 space-y-3">
              <div className="text-center text-4xl">🤝</div>
              <div className="text-center text-2xl font-bold text-blue-400">No Consensus</div>
              <div className="text-center text-sm opacity-70">No one was eliminated</div>
            </div>
          </div>
        )}
        
        <Button className="w-full" onClick={() => g.continueAfterLynch()}>Continue to Night</Button>
      </div>
    )
  }

  const renderGameOver = () => {
    if (g.phase.kind !== 'GameOver') return null
    return (
      <div className="space-y-6">
        <div className="text-center text-2xl">Game Over</div>
        <div className="text-center text-xl">{g.phase.winners === 'town' ? 'Villagers win' : 'Werewolves win'}</div>
        <Button className="w-full" onClick={() => g.reset()}>Play Again</Button>
      </div>
    )
  }

  return (
    <main className="space-y-6">
      {g.phase.kind === 'Lobby' && renderLobby()}
      {showNightIntro ? renderNightIntro() : (g.phase.kind === 'RoleAssignment' && renderRoleAssignment())}
      {g.phase.kind === 'NightStart' && renderNightStart()}
      {g.phase.kind === 'DayStart' && renderDayStart()}
      {g.phase.kind === 'Discussion' && renderDiscussion()}
      {g.phase.kind === 'Voting' && renderVoting()}
      {g.phase.kind === 'LynchResolve' && renderLynchResolve()}
      {g.phase.kind === 'GameOver' && renderGameOver()}
      
      {/* Instructions Popup */}
      <InstructionsPopup isOpen={showInstructions} onClose={() => setShowInstructions(false)} />
      
      {/* Floating Instructions Button */}
      <button
        onClick={() => setShowInstructions(true)}
        className="fixed top-4 right-4 w-12 h-12 rounded-full flex items-center justify-center text-2xl font-bold glass-strong hover:scale-110 active:scale-95 transition-all z-40"
        title="Show Instructions"
      >
        ?
      </button>
      
      {/* AI Host Response Display */}
      {hostResponse && (
        <div className="fixed bottom-4 left-4 right-4 max-w-md mx-auto glass-strong rounded-2xl p-4 animate-fadeIn z-50">
          <div className="flex items-start gap-3">
            <div className="text-2xl">🎭</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold gradient-text">Host</span>
                {hostProvider && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${hostProvider === 'janitorai-error' ? 'bg-red-500/30 text-red-300' : 'bg-purple-500/30 text-purple-300'}`}>
                    {hostProvider === 'baseten' ? '🤖' : 
                     hostProvider === 'janitorai' ? '🎭' : 
                     hostProvider === 'janitorai-error' ? '❌' :
                     hostProvider === 'mock' ? '📝' : '⚠️'}
                  </span>
                )}
              </div>
              <p className="text-white text-sm leading-relaxed">{hostResponse}</p>
            </div>
            <button 
              onClick={() => setHostResponse('')}
              className="text-gray-400 hover:text-white text-xl leading-none transition-colors"
            >
              ×
            </button>
          </div>
        </div>
      )}
      <div className="opacity-60 text-xs text-center">{process.env.NEXT_PUBLIC_APP_NAME || 'SuperMafia'}</div>
    </main>
  )
}
