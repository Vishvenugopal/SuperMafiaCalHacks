import { NextResponse } from 'next/server'

async function callJanitorAI(question: string, gameContext?: any): Promise<string> {
  const apiKey = process.env.JANITOR_AI_API_KEY
  const characterId = process.env.JANITOR_AI_CHARACTER_ID
  
  if (!apiKey || !characterId) {
    throw new Error('JanitorAI credentials not configured')
  }

  const response = await fetch('https://janitorai.com/api/v1/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      character_id: characterId,
      message: question,
      context: gameContext ? `Game context: ${JSON.stringify(gameContext)}` : undefined
    })
  })

  if (!response.ok) {
    throw new Error(`JanitorAI API error: ${response.status}`)
  }

  const data = await response.json()
  return data.response || data.message || 'I could not process that question.'
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const question: string = body?.question || ''
    const gameContext = body?.gameContext
    const useJanitorAI = !!process.env.JANITOR_AI_API_KEY

    // Use JanitorAI if configured, otherwise fall back to mock
    if (useJanitorAI) {
      try {
        const answer = await callJanitorAI(question, gameContext)
        return NextResponse.json({ answer, provider: 'janitorai' })
      } catch (error) {
        console.error('JanitorAI error:', error)
        // Fall through to mock if JanitorAI fails
      }
    }

    // Mock host fallback
    let answer = 'I am your host. Ask me about the rules, phase, or who was eliminated.'
    const q = question.toLowerCase()
    if (q.includes('rule')) answer = 'Basic rules: Werewolves eliminate at night. Seer peeks, Medic protects. Daytime: discuss and vote.'
    else if (q.includes('who died') || q.includes('who was eliminated')) answer = 'Check the latest announcement. I only reveal public info.'
    else if (q.includes('how many wolf')) answer = 'There are 1–3 werewolves depending on player count and settings.'
    
    return NextResponse.json({ answer, provider: 'mock' })
  } catch (e) {
    console.error('Host API error:', e)
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
}
