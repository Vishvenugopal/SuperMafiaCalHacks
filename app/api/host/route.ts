import { NextResponse } from 'next/server'

async function callBaseten(question: string, gameContext?: any): Promise<string> {
  const apiKey = process.env.BASETEN_API_KEY
  const modelName = process.env.BASETEN_MODEL_ID || 'zai-org/GLM-4.6'
  
  console.log('Baseten API Key present:', !!apiKey)
  console.log('Baseten Model Name:', modelName)
  
  if (!apiKey) {
    throw new Error('Baseten API key not configured')
  }

  console.log('Calling Baseten API with model:', modelName)
  
  const response = await fetch('https://inference.baseten.co/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: modelName,
      messages: [
        {
          role: "system",
          content: "You are an English-speaking game narrator and host for a Werewolf/Mafia game. Always reply in English, even if the question is in another language. Keep responses SHORT and direct (1-2 sentences maximum). Only reveal information players should know - no spoilers about hidden roles or secret actions."
        },
        {
          role: "user",
          content: `Current Game State:\n${gameContext ? JSON.stringify(gameContext, null, 2) : 'Game not started yet'}\n\nPlayer Question: ${question}\n\nProvide a brief, direct answer in English (1-2 sentences only).`
        }
      ],
      max_tokens: 80,
      temperature: 0.8,
      stream: false
    })
  })

  console.log('Baseten response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Baseten error response:', errorText)
    
    // Write error to file
    try {
      const fs = await import('fs/promises')
      await fs.writeFile('baseten-error.txt', `Status: ${response.status}\n\nError:\n${errorText}\n\nTime: ${new Date().toISOString()}`, 'utf-8')
    } catch (e) {
      console.error('Could not write error file:', e)
    }
    
    throw new Error(`Baseten API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  console.log('Baseten response data:', JSON.stringify(data).substring(0, 200))
  
  // Write success response to file for debugging
  try {
    const fs = await import('fs/promises')
    await fs.writeFile('baseten-success.txt', `Response:\n${JSON.stringify(data, null, 2)}\n\nTime: ${new Date().toISOString()}`, 'utf-8')
  } catch (e) {
    console.error('Could not write success file:', e)
  }
  
  // Extract the response text from Baseten's response format
  // Try multiple possible response formats
  let responseText = ''
  
  if (data.choices && data.choices[0]?.message?.content) {
    // OpenAI-style format
    responseText = data.choices[0].message.content
  } else if (data.output) {
    responseText = typeof data.output === 'string' ? data.output : data.output.content || data.output.text
  } else if (data.result) {
    responseText = typeof data.result === 'string' ? data.result : data.result.content || data.result.text
  } else if (data.response) {
    responseText = data.response
  } else if (data.text) {
    responseText = data.text
  } else if (data.content) {
    responseText = data.content
  } else {
    responseText = 'I could not process that question.'
  }
  
  return responseText.trim()
}

async function callJanitorAI(question: string, gameContext?: any): Promise<string> {
  const apiKey = process.env.JANITOR_AI_API_KEY
  const characterId = process.env.JANITOR_AI_CHARACTER_ID
  
  if (!apiKey || !characterId) {
    throw new Error('JanitorAI credentials not configured')
  }

  console.log('Calling Janitor.ai API with character:', characterId)
  
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

  console.log('Janitor.ai response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('Janitor.ai error response:', errorText)
    throw new Error(`JanitorAI API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  console.log('Janitor.ai response data:', data)
  return data.response || data.message || 'I could not process that question.'
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const question: string = body?.question || ''
    const gameContext = body?.gameContext
    
    const useBaseten = !!process.env.BASETEN_API_KEY && !!process.env.BASETEN_MODEL_ID
    const useJanitorAI = !!process.env.JANITOR_AI_API_KEY

    // Priority 1: Use Baseten (game-aware narrator)
    if (useBaseten) {
      try {
        console.log('Calling Baseten...')
        const answer = await callBaseten(question, gameContext)
        console.log('✅ Baseten response received:', answer.substring(0, 50))
        return NextResponse.json({ answer, provider: 'baseten' })
      } catch (error: any) {
        console.error('❌ Baseten error:', error)
        console.error('Error message:', error.message)
        console.error('Error stack:', error.stack)
        console.log('Falling back to next option...')
        // Fall through to next option
      }
    } else {
      console.log('Baseten not configured - missing BASETEN_API_KEY or BASETEN_MODEL_ID')
    }

    // Priority 2: Use JanitorAI if configured
    if (useJanitorAI) {
      try {
        console.log('Calling JanitorAI...')
        const answer = await callJanitorAI(question, gameContext)
        console.log('✅ JanitorAI response received:', answer.substring(0, 50))
        return NextResponse.json({ answer, provider: 'janitorai' })
      } catch (error) {
        console.error('❌ JanitorAI error:', error)
        console.log('Falling back to mock host')
        // Fall through to mock if JanitorAI fails
      }
    } else if (!useBaseten) {
      console.log('No AI configured, using mock host')
    }

    // Priority 3: Mock host fallback with game context awareness
    let answer = 'I am your host. Ask me about the rules, phase, or who was eliminated.'
    const q = question.toLowerCase()
    
    if (q.includes('rule')) {
      answer = 'Basic rules: Werewolves eliminate at night. Seer peeks, Medic protects. Daytime: discuss and vote.'
    } 
    else if (q.includes('who died') || q.includes('who was eliminated') || q.includes('who is dead')) {
      if (gameContext && gameContext.recentEvents && gameContext.recentEvents.length > 0) {
        const deathEvents = gameContext.recentEvents.filter((e: any) => 
          e.type === 'night_kill' || e.type === 'lynch'
        )
        if (deathEvents.length > 0) {
          const lastDeath = deathEvents[deathEvents.length - 1]
          const playerId = lastDeath.data?.playerId
          
          // Find the player name from the alive/dead players list
          const allPlayers = [...(gameContext.alivePlayers || []), ...(gameContext.deadPlayers || [])]
          const victim = allPlayers.find((p: any) => p.id === playerId)
          const victimName = victim?.name || 'a player'
          
          const deathType = lastDeath.type === 'lynch' ? 'voted out' : 'eliminated during the night'
          answer = `${victimName} was ${deathType}. ${gameContext.alivePlayers?.length || 0} players remain alive.`
        } else {
          answer = 'No one has been eliminated recently. All players are still alive.'
        }
      } else {
        answer = 'No eliminations have occurred yet in this game.'
      }
    }
    else if (q.includes('how many') && (q.includes('alive') || q.includes('left') || q.includes('remain'))) {
      if (gameContext && gameContext.alivePlayers) {
        const count = gameContext.alivePlayers.length
        const names = gameContext.alivePlayers.map((p: any) => p.name).join(', ')
        answer = `${count} players remain alive: ${names}`
      } else {
        answer = 'I cannot determine how many players are alive right now.'
      }
    }
    else if (q.includes('how many wolf') || q.includes('how many werewol')) {
      answer = 'There are 1–3 werewolves depending on player count and settings. Their identities are hidden.'
    }
    else if (q.includes('phase') || q.includes('what phase')) {
      if (gameContext && gameContext.phase) {
        const phase = gameContext.phase.kind || 'unknown'
        const round = gameContext.round || 0
        answer = `We are currently in the ${phase} phase. This is round ${round}.`
      } else {
        answer = 'The game has not started yet. We are in the lobby.'
      }
    }
    else if (q.includes('round') || q.includes('day')) {
      if (gameContext && gameContext.round) {
        answer = `This is round ${gameContext.round} of the game.`
      } else {
        answer = 'The game has not started yet.'
      }
    }
    
    console.log('Using mock response:', answer.substring(0, 50))
    return NextResponse.json({ answer, provider: 'mock' })
  } catch (e) {
    console.error('Host API error:', e)
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }
}
