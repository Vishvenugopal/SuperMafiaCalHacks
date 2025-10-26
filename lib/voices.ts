export type VoicePersonality = 'default' | 'funny' | 'rap'

export function getElevenLabsVoiceId(personality: VoicePersonality = 'default') {
  const defaultId = process.env.ELEVENLABS_VOICE_ID || '3QiGwMqjCB6SVqaZbeKZ'
  const funnyId = process.env.ELEVENLABS_FUNNY_VOICE_ID || 'GcPTBXiuIz3xYDstbCNX'
  const rapId = process.env.ELEVENLABS_RAP_VOICE_ID || 'Skym1RV8QYn469NRLY7W'
  if (personality === 'funny') return funnyId
  if (personality === 'rap') return rapId
  return defaultId
}
