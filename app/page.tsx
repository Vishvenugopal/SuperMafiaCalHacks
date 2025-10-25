"use client"
import { useGame } from '@/store/game'
import { Player } from '@/lib/types'
import { useRef, useState, useEffect, type ButtonHTMLAttributes, type ReactNode, type ChangeEvent } from 'react'
import { ttsSpeak, isTtsAvailable, sttListenOnce } from '@/lib/voice'

function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={`rounded-lg px-4 py-3 text-base font-medium bg-white text-black active:scale-[0.98] ${props.className || ''}`}></button>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-lg font-semibold opacity-90">{title}</div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function PlayerCard({ p, onRemove }: { p: Player; onRemove?: () => void }) {
  return (
    <div className="flex items-center gap-3 bg-white/5 rounded-xl p-2">
      <div className="w-12 h-12 rounded-full bg-white/10 overflow-hidden flex items-center justify-center">
        {p.avatarDataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.avatarDataUrl} alt={p.name} className="w-full h-full object-cover" />
        ) : (
          <div className="text-2xl">🙂</div>
        )}
      </div>
      <div className="flex-1">
        <div className="font-medium">{p.name}</div>
        <div className="text-xs opacity-60">{p.alive ? 'Alive' : 'Out'}</div>
      </div>
      {!!onRemove && (
        <button onClick={onRemove} className="text-xs px-2 py-1 bg-red-500 rounded">Remove</button>
      )}
    </div>
  )
}

function NumberPicker({ value, setValue, min = 0, max = 6, label }: { value: number; setValue: (n: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="flex items-center justify-between bg-white/5 rounded-xl p-2">
      <div className="font-medium">{label}</div>
      <div className="flex items-center gap-2">
        <button onClick={() => setValue(Math.max(min, value - 1))} className="w-8 h-8 rounded bg-white/10">-</button>
        <div className="w-8 text-center">{value}</div>
        <button onClick={() => setValue(Math.min(max, value + 1))} className="w-8 h-8 rounded bg-white/10">+</button>
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

export default function Home() {
  const g = useGame()
  const [newName, setNewName] = useState('')
  const [newPhoto, setNewPhoto] = useState<string | undefined>()
  const fileRef = useRef<HTMLInputElement>(null)
  const now = useNow(200)

  useEffect(() => {
    if (g.phase.kind === 'DayStart' && isTtsAvailable()) {
      const round = g.round
      const items = g.eventLog.filter(e => e.round === round && e.public)
      const line = items.find(e => e.type === 'night_kill')
        ? `Day ${round}. A player has been eliminated.`
        : `Day ${round}. No one was eliminated.`
      ttsSpeak(line)
    }
  }, [g.phase, g.round, g.eventLog])

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
    return (
      <div className="space-y-6">
        <Section title="Players">
          <div className="space-y-2">
            {players.map(p => (
              <PlayerCard key={p.id} p={p} onRemove={() => g.removePlayer(p.id)} />
            ))}
            <div className="bg-white/5 rounded-xl p-3 space-y-2">
              <input 
                type="text"
                value={newName} 
                onChange={e => setNewName(e.target.value)} 
                placeholder="Name" 
                className="w-full bg-white/10 rounded px-3 py-2 outline-none"
                autoComplete="off"
              />
              <input ref={fileRef} type="file" accept="image/*" capture="user" onChange={e => {
                const f = e.target.files?.[0]
                if (!f) return
                const r = new FileReader()
                r.onload = () => setNewPhoto(String(r.result))
                r.readAsDataURL(f)
              }} className="w-full text-sm" />
              <Button onClick={addPlayer} className="w-full">Add player</Button>
            </div>
          </div>
        </Section>
        <Section title="Roles">
          <NumberPicker label="Werewolves" value={werewolves} setValue={n => g.updateRolesEnabled('werewolf', n)} min={1} max={5} />
          <NumberPicker label="Seer" value={seers} setValue={n => g.updateRolesEnabled('seer', n)} min={0} max={2} />
          <NumberPicker label="Medic" value={medics} setValue={n => g.updateRolesEnabled('medic', n)} min={0} max={2} />
        </Section>
        <Section title="Theme & Host">
          <select value={g.settings.theme} onChange={e => g.updateSettings({ theme: e.target.value as any })} className="w-full bg-white/10 rounded px-3 py-2">
            <option value="werewolf">Werewolf</option>
            <option value="mafia" disabled>Mafia (soon)</option>
            <option value="custom">Custom</option>
          </select>
          {g.settings.theme === 'custom' && (
            <input placeholder="Enter custom theme prompt" value={g.settings.customThemePrompt || ''} onChange={e => g.updateSettings({ customThemePrompt: e.target.value })} className="w-full bg-white/10 rounded px-3 py-2" />
          )}
          <select value={g.settings.hostPersonality} onChange={e => g.updateSettings({ hostPersonality: e.target.value })} className="w-full bg-white/10 rounded px-3 py-2">
            <option value="classic">Classic</option>
            <option value="spooky">Spooky</option>
            <option value="dramatic">Dramatic</option>
          </select>
        </Section>
        <div className="pt-2">
          <Button className="w-full disabled:opacity-50" onClick={g.startGame} disabled={g.players.length < 5}>Start Game</Button>
        </div>
      </div>
    )
  }

  // All state at parent level to prevent focus loss
  const [roleRevealed, setRoleRevealed] = useState(false)
  const [lastRevealedIndex, setLastRevealedIndex] = useState(-1)
  const [nightStep, setNightStep] = useState<'medic' | 'wolves' | 'seer' | 'done'>('medic')
  const [nightRevealed, setNightRevealed] = useState(false)
  const [lastNightStep, setLastNightStep] = useState<string>('')
  const [peekResult, setPeekResult] = useState<{ playerId: string; role: string } | null>(null)

  // Reset revealed state when moving to next player
  if (g.phase.kind === 'RoleAssignment' && g.ui.roleRevealIndex !== lastRevealedIndex) {
    if (roleRevealed) setRoleRevealed(false)
    setLastRevealedIndex(g.ui.roleRevealIndex)
  }

  // Reset night revealed state when step changes
  if (g.phase.kind === 'NightStart' && nightStep !== lastNightStep) {
    if (nightRevealed) setNightRevealed(false)
    setLastNightStep(nightStep)
  }

  // Reset night step when phase changes
  useEffect(() => {
    if (g.phase.kind === 'NightStart') {
      setNightStep('medic')
      setNightRevealed(false)
      setPeekResult(null)
    }
  }, [g.phase.kind])

  // Auto-advance through missing roles in night phase
  useEffect(() => {
    if (g.phase.kind !== 'NightStart') return
    const medic = g.players.find(p => p.role === 'medic' && p.alive)
    const seer = g.players.find(p => p.role === 'seer' && p.alive)
    const wolves = g.players.filter(p => p.role === 'werewolf' && p.alive)
    
    if (nightStep === 'done') return
    if (nightStep === 'medic' && !medic) setNightStep('wolves')
    if (nightStep === 'wolves' && wolves.length === 0) setNightStep('seer')
    if (nightStep === 'seer' && !seer) setNightStep('done')
  }, [g.phase.kind, nightStep, g.players])

  const renderRoleAssignment = () => {
    const id = g.ui.roleRevealOrder[g.ui.roleRevealIndex]
    const player = g.players.find(p => p.id === id)
    if (!player) return null
    const role = player.role || 'villager'
    return (
      <div className="space-y-6">
        {!roleRevealed ? (
          <div className="space-y-4">
            <div className="text-center text-2xl">Pass to {player.name}</div>
            <Button className="w-full" onClick={() => setRoleRevealed(true)}>Tap to reveal role</Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-center text-2xl">{player.name}</div>
            <div className="text-center text-4xl">{role === 'werewolf' ? '🐺 Werewolf' : role === 'seer' ? '🔮 Seer' : role === 'medic' ? '💉 Medic' : '🧑 Villager'}</div>
            {g.ui.roleRevealIndex + 1 < g.ui.roleRevealOrder.length ? (
              <Button className="w-full" onClick={() => { setRoleRevealed(false); g.nextRoleReveal() }}>Done, pass to next</Button>
            ) : (
              <Button className="w-full" onClick={() => g.proceedFromRoleReveal()}>Begin Night</Button>
            )}
          </div>
        )}
      </div>
    )
  }

  const renderNightStart = () => {
    const medic = g.players.find(p => p.role === 'medic' && p.alive)
    const seer = g.players.find(p => p.role === 'seer' && p.alive)
    const wolves = g.players.filter(p => p.role === 'werewolf' && p.alive)
    const alive = g.players.filter(p => p.alive)

    if (nightStep === 'medic' && medic) {
      return (
        <div className="space-y-4">
          {!nightRevealed ? (
            <>
              <div className="text-center text-2xl">Pass to {medic.name}</div>
              <Button className="w-full" onClick={() => setNightRevealed(true)}>Tap to see your action</Button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="text-center text-xl">💉 Medic</div>
              <div className="text-center">Choose a player to protect</div>
              <div className="grid grid-cols-2 gap-2">
                {alive.map(p => (
                  <button key={p.id} onClick={() => { g.chooseProtect(p.id); setNightStep('wolves'); setNightRevealed(false) }} className="bg-white/10 rounded-xl p-3">
                    <div className="text-center">{p.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    if (nightStep === 'wolves') {
      const wolfNames = wolves.map(w => w.name).join(', ')
      const targets = alive.filter(p => p.role !== 'werewolf')
      return (
        <div className="space-y-4">
          {!nightRevealed ? (
            <>
              <div className="text-center text-2xl">Pass to {wolfNames}</div>
              <Button className="w-full" onClick={() => setNightRevealed(true)}>Tap to see your action</Button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="text-center text-xl">🐺 Werewolf</div>
              <div className="text-center">Choose a player to eliminate</div>
              <div className="grid grid-cols-2 gap-2">
                {targets.map(p => (
                  <button key={p.id} onClick={() => { g.chooseKill(p.id); setNightStep('seer'); setNightRevealed(false) }} className="bg-white/10 rounded-xl p-3">
                    <div className="text-center">{p.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    if (nightStep === 'seer' && seer) {
      const targets = alive.filter(p => p.id !== seer.id)
      
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
            <Button className="w-full" onClick={() => { setNightStep('done'); setNightRevealed(false); setPeekResult(null) }}>Continue</Button>
          </div>
        )
      }
      
      return (
        <div className="space-y-4">
          {!nightRevealed ? (
            <>
              <div className="text-center text-2xl">Pass to {seer.name}</div>
              <Button className="w-full" onClick={() => setNightRevealed(true)}>Tap to see your action</Button>
            </>
          ) : (
            <div className="space-y-3">
              <div className="text-center text-xl">🔮 Seer</div>
              <div className="text-center">Choose a player to peek</div>
              <div className="grid grid-cols-2 gap-2">
                {targets.map(p => (
                  <button key={p.id} onClick={() => { 
                    g.choosePeek(p.id)
                    const role = p.role || 'villager'
                    setPeekResult({ playerId: p.id, role })
                  }} className="bg-white/10 rounded-xl p-3">
                    <div className="text-center">{p.name}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )
    }

    if (nightStep === 'done') {
      return (
        <div className="space-y-4">
          <div className="text-center text-2xl">Night actions complete</div>
          <Button className="w-full" onClick={() => g.resolveNight()}>Continue to Day</Button>
        </div>
      )
    }

    return null
  }

  const renderDayStart = () => {
    const round = g.round
    const events = g.eventLog.filter(e => e.round === round && e.public)
    const death = events.find(e => e.type === 'night_kill')
    const name = g.players.find(p => p.id === death?.data.playerId)?.name
    return (
      <div className="space-y-6">
        <div className="text-center text-2xl">Day {round}</div>
        <div className="text-center text-xl">{death ? `${name} was eliminated` : 'No one was eliminated'}</div>
        <Button className="w-full" onClick={() => g.startDiscussion()}>Start Discussion</Button>
      </div>
    )
  }

  const renderDiscussion = () => {
    const endsAt = g.phase.kind === 'Discussion' ? g.phase.endsAt || 0 : 0
    const remain = Math.max(0, Math.round((endsAt - now) / 1000))
    return (
      <div className="space-y-6">
        <div className="text-center text-2xl">Discussion</div>
        <div className="text-center text-xl">{remain}s remaining</div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => g.startVoting()}>Start Voting</Button>
          <Button className="flex-1" onClick={async () => {
            const q = await sttListenOnce()
            if (!q) return
            try {
              const res = await fetch('/api/host', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q }) })
              const data = await res.json()
              await ttsSpeak(String(data.answer || ''))
            } catch {
              await ttsSpeak('I could not reach the host right now.')
            }
          }}>Hold to ask host</Button>
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
    const name = g.players.find(p => p.id === lynch?.data.playerId)?.name
    return (
      <div className="space-y-6">
        <div className="text-center text-2xl">Lynch Result</div>
        <div className="text-center text-xl">{lynch ? `${name} was eliminated` : 'No one was eliminated'}</div>
        <Button className="w-full" onClick={() => g.continueAfterLynch()}>Continue</Button>
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
      {g.phase.kind === 'RoleAssignment' && renderRoleAssignment()}
      {g.phase.kind === 'NightStart' && renderNightStart()}
      {g.phase.kind === 'DayStart' && renderDayStart()}
      {g.phase.kind === 'Discussion' && renderDiscussion()}
      {g.phase.kind === 'Voting' && renderVoting()}
      {g.phase.kind === 'LynchResolve' && renderLynchResolve()}
      {g.phase.kind === 'GameOver' && renderGameOver()}
      <div className="opacity-60 text-xs text-center">{process.env.NEXT_PUBLIC_APP_NAME || 'SuperMafia'}</div>
    </main>
  )
}
