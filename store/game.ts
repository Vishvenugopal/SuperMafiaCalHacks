"use client"
import { create } from 'zustand'
import { Alignment, GameSettings, GameState, Phase, Player, ROLE_DEFS, RoleId } from '@/lib/types'
import { id as rid, mulberry32, shuffle } from '@/lib/util'

type UIState = {
  roleRevealOrder: string[]
  roleRevealIndex: number
}

type Actions = {
  addPlayer: (name: string, avatarDataUrl?: string) => void
  removePlayer: (id: string) => void
  updatePlayer: (id: string, patch: Partial<Player>) => void
  updateSettings: (patch: Partial<GameSettings>) => void
  updateRolesEnabled: (role: RoleId, count: number) => void
  startGame: () => void
  nextRoleReveal: () => void
  proceedFromRoleReveal: () => void
  chooseProtect: (playerId: string | undefined) => void
  chooseKill: (playerId: string | undefined) => void
  choosePeek: (playerId: string | undefined) => void
  resolveNight: () => void
  startDiscussion: () => void
  startVoting: () => void
  castVoteForCurrent: (targetId: string | null) => void
  resolveVote: () => void
  continueAfterLynch: () => void
  reset: () => void
}

export type Store = GameState & { ui: UIState } & Actions

const defaultSettings: GameSettings = {
  theme: 'werewolf',
  hostPersonality: 'classic',
  aiProvider: 'auto',
  rolesEnabled: { werewolf: 1, seer: 1, medic: 1 },
  timers: { discussionSec: 120, defenseSec: 30, nightAutoAdvance: false },
  allowSelfProtect: false,
  tieRule: 'no-lynch',
  apiKeys: {
    livekitWsUrl: process.env.LIVEKIT_WS_URL || '',
    livekitApiKey: process.env.LIVEKIT_API_KEY || '',
    livekitApiSecret: process.env.LIVEKIT_API_SECRET || '',
    basetenApiKey: process.env.BASETEN_API_KEY || '',
    basetenModelId: process.env.BASETEN_MODEL_ID || '',
    janitorAiApiKey: process.env.JANITOR_AI_API_KEY || '',
    janitorAiCharacterId: process.env.JANITOR_AI_CHARACTER_ID || '',
    elevenlabsApiKey: process.env.ELEVENLABS_API_KEY || '',
    elevenlabsVoiceId: process.env.ELEVENLABS_VOICE_ID || '',
  },
}

function autoCounts(players: number) {
  const wolves = Math.max(1, Math.round(players * 0.25))
  const seer = players >= 6 ? 1 : 0
  const medic = players >= 6 ? 1 : 0
  return { werewolf: wolves, seer, medic }
}

function assignRoles(players: Player[], settings: GameSettings, seed: number) {
  const counts = { ...autoCounts(players.length), ...settings.rolesEnabled }
  const roles: RoleId[] = []
  const push = (r: RoleId, n: number) => {
    for (let i = 0; i < n; i++) roles.push(r)
  }
  push('werewolf', Math.min(counts.werewolf ?? 0, players.length))
  push('seer', Math.min(counts.seer ?? 0, players.length))
  push('medic', Math.min(counts.medic ?? 0, players.length))
  while (roles.length < players.length) roles.push('villager')
  const rng = mulberry32(seed)
  const shuffledPlayers = shuffle(players, rng)
  const assigned: Player[] = shuffledPlayers.map((p: Player, i: number) => ({ ...p, role: roles[i], alive: true }))
  const backToOriginalOrder: Player[] = assigned
    .sort((a: Player, b: Player) => players.findIndex((x: Player) => x.id === a.id) - players.findIndex((x: Player) => x.id === b.id))
  return backToOriginalOrder
}

export const useGame = create<Store>((set, get) => ({
  id: rid(),
  seed: Math.floor(Math.random() * 1e9),
  settings: defaultSettings,
  players: [],
  phase: { kind: 'Lobby' },
  round: 0,
  nightActions: {},
  eventLog: [],
  ui: { roleRevealOrder: [], roleRevealIndex: 0 },

  addPlayer: (name: string, avatarDataUrl?: string) =>
    set((s: Store) => ({ players: [...s.players, { id: rid(), name, avatarDataUrl, alive: true }] })),

  removePlayer: (id: string) => set((s: Store) => ({ players: s.players.filter((p: Player) => p.id !== id) })),

  updatePlayer: (id: string, patch: Partial<Player>) =>
    set((s: Store) => ({ players: s.players.map((p: Player) => (p.id === id ? { ...p, ...patch } : p)) })),

  updateSettings: (patch: Partial<GameSettings>) => set((s: Store) => ({ settings: { ...s.settings, ...patch } })),

  updateRolesEnabled: (role: RoleId, count: number) =>
    set((s: Store) => ({ settings: { ...s.settings, rolesEnabled: { ...s.settings.rolesEnabled, [role]: Math.max(0, Math.floor(count)) } } })),

  startGame: () => {
    const s = get()
    if (s.players.length < 5) return
    const seed = s.seed
    const players = assignRoles(s.players, s.settings, seed)
    // Keep original player order for role reveals (don't shuffle)
    const order = players.map(p => p.id)
    set({ players, phase: { kind: 'RoleAssignment' }, ui: { roleRevealOrder: order, roleRevealIndex: 0 }, round: 1 })
  },

  nextRoleReveal: () => {
    const { ui } = get()
    if (ui.roleRevealIndex + 1 >= ui.roleRevealOrder.length) return
    set((s: Store) => ({ ui: { ...s.ui, roleRevealIndex: s.ui.roleRevealIndex + 1 } }))
  },

  proceedFromRoleReveal: () => set((s: Store) => ({ phase: { kind: 'NightStart', round: s.round }, nightActions: {} })),

  chooseProtect: (playerId: string | undefined) => set((s: Store) => ({ nightActions: { ...s.nightActions, protectId: playerId } })),

  chooseKill: (playerId: string | undefined) => set((s: Store) => ({ nightActions: { ...s.nightActions, killTargetId: playerId } })),

  choosePeek: (playerId: string | undefined) => set((s: Store) => ({ nightActions: { ...s.nightActions, peekTargetId: playerId } })),

  resolveNight: () => {
    const s = get()
    const { protectId, killTargetId, peekTargetId } = s.nightActions
    let killedId: string | undefined
    if (killTargetId && killTargetId !== protectId) killedId = killTargetId
    const events = [...s.eventLog]
    if (peekTargetId) events.push({ id: rid(), type: 'peek', round: s.round, data: { peekTargetId }, public: false })
    if (protectId) events.push({ id: rid(), type: 'protected', round: s.round, data: { protectId }, public: false })
    if (killedId) {
      events.push({ id: rid(), type: 'night_kill', round: s.round, data: { playerId: killedId }, public: true })
    } else {
      events.push({ id: rid(), type: 'no_kill', round: s.round, data: {}, public: true })
    }
    const players = s.players.map((p: Player) => (p.id === killedId ? { ...p, alive: false } : p))
    set((s2: Store) => ({ players, eventLog: events, phase: { kind: 'DayStart', round: s2.round } }))
  },

  startDiscussion: () => set((s: Store) => ({ phase: { kind: 'Discussion', round: s.round, endsAt: Date.now() + s.settings.timers.discussionSec * 1000 } })),

  startVoting: () => {
    const s = get()
    const voters = s.players.filter((p: Player) => p.alive).map((p: Player) => p.id)
    const votes: Record<string, string | null> = {}
    voters.forEach((v: string) => (votes[v] = null))
    set((s2: Store) => ({ phase: { kind: 'Voting', round: s2.round, voterQueue: voters, currentIndex: 0, votes } }))
  },

  castVoteForCurrent: (targetId: string | null) => {
    const s = get()
    if (s.phase.kind !== 'Voting') return
    const voter = s.phase.voterQueue[s.phase.currentIndex]
    const votes = { ...s.phase.votes, [voter]: targetId }
    let idx = s.phase.currentIndex + 1
    if (idx >= s.phase.voterQueue.length) {
      set((s2: Store) => ({ phase: { ...s2.phase, votes, currentIndex: idx } }))
      get().resolveVote()
      return
    }
    set((s2: Store) => ({ phase: { ...s2.phase, votes, currentIndex: idx } }))
  },

  resolveVote: () => {
    const s = get()
    if (s.phase.kind !== 'Voting') return
    const tally = new Map<string, number>()
    for (const [, t] of Object.entries(s.phase.votes) as Array<[string, string | null]>) {
      if (!t) continue
      tally.set(t, (tally.get(t) || 0) + 1)
    }
    const sorted = Array.from(tally.entries()).sort((a, b) => b[1] - a[1])
    if (sorted.length === 0) {
      set((s2: Store) => ({ phase: { kind: 'LynchResolve', round: s2.round } }))
      return
    }
    const top = sorted[0]
    const tied = sorted.filter(x => x[1] === top[1]).map(x => x[0])
    if (tied.length > 1) {
      if (s.settings.tieRule === 'no-lynch') {
        set((s2: Store) => ({ phase: { kind: 'LynchResolve', round: s2.round } }))
        return
      }
    }
    const lynchedId = top[0]
    set((s2: Store) => ({
      players: s2.players.map((p: Player) => (p.id === lynchedId ? { ...p, alive: false } : p)),
      eventLog: [...s2.eventLog, { id: rid(), type: 'lynch', round: s2.round, data: { playerId: lynchedId }, public: true }],
      phase: { kind: 'LynchResolve', round: s2.round },
    }))
  },

  continueAfterLynch: () => {
    const s = get()
    const alive = s.players.filter((p: Player) => p.alive)
    const wolves = alive.filter((p: Player) => p.role === 'werewolf').length
    const town = alive.length - wolves
    let winners: Alignment | null = null
    if (wolves === 0) winners = 'town'
    else if (wolves >= town) winners = 'wolf'
    if (winners) {
      set((s2: Store) => ({ phase: { kind: 'GameOver', winners } }))
      return
    }
    set({ round: s.round + 1, phase: { kind: 'NightStart', round: s.round + 1 }, nightActions: {} })
  },

  reset: () => set({
    id: rid(),
    seed: Math.floor(Math.random() * 1e9),
    settings: defaultSettings,
    players: [],
    phase: { kind: 'Lobby' },
    round: 0,
    nightActions: {},
    eventLog: [],
    ui: { roleRevealOrder: [], roleRevealIndex: 0 },
  }),
}))
