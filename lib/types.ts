export type RoleId = 'villager' | 'werewolf' | 'seer' | 'medic'

export type Alignment = 'town' | 'wolf'

export interface RoleDef {
  id: RoleId
  name: string
  alignment: Alignment
  actsAtNight: boolean
  uniquePerGame?: boolean
}

export const ROLE_DEFS: Record<RoleId, RoleDef> = {
  villager: { id: 'villager', name: 'Villager', alignment: 'town', actsAtNight: false },
  werewolf: { id: 'werewolf', name: 'Werewolf', alignment: 'wolf', actsAtNight: true },
  seer: { id: 'seer', name: 'Seer', alignment: 'town', actsAtNight: true, uniquePerGame: true },
  medic: { id: 'medic', name: 'Medic', alignment: 'town', actsAtNight: true, uniquePerGame: true },
}

export interface Player {
  id: string
  name: string
  avatarDataUrl?: string
  role?: RoleId
  alive: boolean
}

export type ThemeId = 'werewolf' | 'mafia' | 'custom'

export interface GameSettings {
  theme: ThemeId
  customThemePrompt?: string
  hostPersonality: string
  aiProvider: 'baseten' | 'janitorai' | 'auto'
  rolesEnabled: Partial<Record<RoleId, number>>
  timers: {
    playerTalkingSec: number
    discussionSec: number
    defenseSec: number
    nightAutoAdvance: boolean
  }
  allowSelfProtect: boolean
  tieRule: 'revote' | 'random' | 'no-lynch'
  apiKeys?: {
    livekitWsUrl?: string
    livekitApiKey?: string
    livekitApiSecret?: string
    basetenApiKey?: string
    basetenModelId?: string
    janitorAiApiKey?: string
    janitorAiCharacterId?: string
    elevenlabsApiKey?: string
    elevenlabsVoiceId?: string
  }
}

export type Phase =
  | { kind: 'Lobby' }
  | { kind: 'RoleAssignment' }
  | { kind: 'NightStart'; round: number }
  | { kind: 'Night_Medic'; round: number; medicPlayerId?: string }
  | { kind: 'Night_Werewolves'; round: number }
  | { kind: 'Night_Seer'; round: number; seerPlayerId?: string }
  | { kind: 'NightResolve'; round: number }
  | { kind: 'DayStart'; round: number }
  | { kind: 'PlayerTalking'; round: number; endsAt: number }
  | { kind: 'Discussion'; round: number; endsAt?: number }
  | { kind: 'Accusation'; round: number }
  | { kind: 'Defense'; round: number; defendantId: string; endsAt?: number }
  | { kind: 'Voting'; round: number; voterQueue: string[]; currentIndex: number; votes: Record<string, string | null> }
  | { kind: 'LynchResolve'; round: number }
  | { kind: 'GameOver'; winners: Alignment }

export interface NightActions {
  protectId?: string
  killTargetId?: string
  peekTargetId?: string
}

export interface EventLogItem {
  id: string
  type: 'night_kill' | 'protected' | 'peek' | 'lynch' | 'no_kill' | 'start_day'
  round: number
  data: Record<string, any>
  public: boolean
}

export interface GameState {
  id: string
  seed: number
  settings: GameSettings
  players: Player[]
  phase: Phase
  round: number
  nightActions: NightActions
  eventLog: EventLogItem[]
}
