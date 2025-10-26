import { NextResponse } from 'next/server'
import { getEnv } from '@/lib/env-validation'

async function callBaseten(question: string, gameContext?: any, personality?: 'default' | 'funny' | 'rap'): Promise<string> {
  const apiKey = getEnv('BASETEN_API_KEY')
  const modelName = getEnv('BASETEN_MODEL_ID', 'zai-org/GLM-4.6')
  
  console.log('Baseten API Key present:', !!apiKey)
  console.log('Baseten Model Name:', modelName)
  
  if (!apiKey) {
    throw new Error('Baseten API key not configured - please set BASETEN_API_KEY environment variable')
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
          content: "LANGUAGE: ENGLISH ONLY. You are an English-speaking game narrator for Werewolf/Mafia. 你必须用英语回答。不要用中文。Always reply in English, never Chinese. Keep responses SHORT (1-2 sentences). Only reveal information players should know."
        },
        {
          role: "user",
          content: `[RESPOND IN ENGLISH ONLY - NO CHINESE]\n\nGame State: ${gameContext ? JSON.stringify(gameContext, null, 2) : 'Not started'}\n\nQuestion: ${question}\n\n[CRITICAL: Your response must be in English. 用英语回答。Brief answer (1-2 sentences).]`
        }
      ],
      max_tokens: 150,
      temperature: 0.5,
      top_p: 0.8,
      stream: false,
      response_format: { type: "text" }
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
  
  const trimmed = responseText.trim()
  
  // Check if response contains Chinese characters
  const hasChinese = /[\u4e00-\u9fa5]/.test(trimmed)
  if (hasChinese) {
    console.warn('⚠️ Baseten returned Chinese text, using English fallback')
    // Return a generic English response instead
    if (question.toLowerCase().includes('night')) {
      return 'Night falls over the village. The werewolves are hunting.'
    } else if (question.toLowerCase().includes('day')) {
      return 'The village awakens. Time to discuss who might be the werewolf.'
    } else {
      return 'The game continues. Stay alert and trust your instincts.'
    }
  }
  
  return trimmed
}

async function callJanitorAI(question: string, gameContext?: any, personality?: 'default' | 'funny' | 'rap'): Promise<string> {
  const apiKey = getEnv('JANITOR_AI_API_KEY')
  
  if (!apiKey) {
    throw new Error('JanitorAI API key not configured - please set JANITOR_AI_API_KEY environment variable')
  }

  console.log('Calling JanitorAI hackathon endpoint...')
  
  // Build the system prompt with game context
  const systemPrompt = "You are an English-speaking game narrator and host for a Werewolf/Mafia game. CRITICAL: You MUST respond ONLY in English. Keep responses SHORT and direct (1-2 sentences maximum). Only reveal information players should know - no spoilers about hidden roles or secret actions." + (personality === 'funny' ? ' Use a witty, playful tone with brief humor.' : personality === 'rap' ? ' Respond in 1–2 short rhyming lines with a light rap cadence. Ensure the lines rhyme. Keep it PG.' : '')
  const userPrompt = gameContext 
    ? `Current Game State:\n${JSON.stringify(gameContext, null, 2)}\n\nPlayer Question: ${question}\n\nProvide a brief, direct answer in English (1-2 sentences only).`
    : question
  
  // Use the hackathon endpoint with OpenAI-style format
  const response = await fetch('https://janitorai.com/hackathon/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': apiKey  // No Bearer prefix per JanitorAI staff
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 80,
      temperature: 0.8,
      stream: false  // Disable streaming to get JSON response
    })
  })

  console.log('JanitorAI response status:', response.status)

  if (!response.ok) {
    const errorText = await response.text()
    console.error('JanitorAI error response:', errorText)
    
    // Write error to file
    try {
      const fs = await import('fs/promises')
      await fs.writeFile('janitorai-error.txt', `Status: ${response.status}\n\nError:\n${errorText}\n\nTime: ${new Date().toISOString()}`, 'utf-8')
    } catch (e) {
      console.error('Could not write error file:', e)
    }
    
    throw new Error(`JanitorAI API error: ${response.status} - ${errorText}`)
  }

  // Some JanitorAI hackathon endpoints stream SSE even when stream:false.
  // Read raw text and parse either JSON or SSE.
  const contentType = response.headers.get('content-type') || ''
  const raw = await response.text()
  console.log('JanitorAI content-type:', contentType)
  console.log('JanitorAI raw (first 200):', raw.slice(0, 200))

  try {
    // Try JSON first
    const data = JSON.parse(raw)
    console.log('JanitorAI response data:', JSON.stringify(data).slice(0, 200))

    // Write success response to file for debugging
    try {
      const fs = await import('fs/promises')
      await fs.writeFile('janitorai-success.txt', `Response:\n${JSON.stringify(data, null, 2)}\n\nTime: ${new Date().toISOString()}`, 'utf-8')
    } catch (e) {
      console.error('Could not write success file:', e)
    }

    if (data.choices && data.choices[0]?.message?.content) {
      return data.choices[0].message.content.trim()
    }
    return (data.response || data.message || data.text || data.content || '').toString().trim() || 'I could not process that question.'
  } catch (jsonErr) {
    // Fallback: parse SSE stream in raw text
    // Expected format: lines like `data: {"choices":[{"delta":{"content":"..."}}]}` and ends with `data: [DONE]`
    let assembled = ''
    try {
      const lines = raw.split(/\r?\n/)
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim() // after 'data:'
        if (!payload || payload === '[DONE]') continue
        try {
          const obj = JSON.parse(payload)
          const choice = obj.choices?.[0]
          // OpenAI-style delta streaming
          const deltaText = choice?.delta?.content || choice?.message?.content || obj.content || obj.text || ''
          if (typeof deltaText === 'string') assembled += deltaText
        } catch (e) {
          // Not JSON payload; ignore this chunk
        }
      }
    } catch (e) {
      console.error('Failed to parse SSE stream:', e)
    }

    // Write raw SSE for debugging
    try {
      const fs = await import('fs/promises')
      await fs.writeFile('janitorai-raw.txt', `Raw:\n${raw}\n\nTime: ${new Date().toISOString()}`, 'utf-8')
    } catch (e) {
      console.error('Could not write raw file:', e)
    }

    const finalText = assembled.trim()
    if (finalText) return finalText
    throw new Error(`JanitorAI returned unexpected format. First bytes: ${raw.slice(0, 50)}`)
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const question: string = body?.question || ''
    const gameContext = body?.gameContext
    const preferredProvider: 'baseten' | 'janitorai' | 'auto' = body?.provider || 'auto'
    const personality: 'default' | 'funny' | 'rap' | undefined = body?.personality || body?.voicePersonality
    
    const useBaseten = !!getEnv('BASETEN_API_KEY') && !!getEnv('BASETEN_MODEL_ID')
    const useJanitorAI = !!getEnv('JANITOR_AI_API_KEY')

    console.log(`Provider preference: ${preferredProvider}, Baseten available: ${useBaseten}, JanitorAI available: ${useJanitorAI}`)

    // If user prefers a specific provider, try that first
    if (preferredProvider === 'baseten' && useBaseten) {
      try {
        console.log('Calling Baseten (user preference)...')
        const answer = await callBaseten(question, gameContext, personality)
        console.log('✅ Baseten response received:', answer.substring(0, 50))
        return NextResponse.json({ answer, provider: 'baseten' })
      } catch (error: any) {
        console.error('❌ Baseten error:', error)
        console.log('Baseten failed, falling back to JanitorAI...')
        if (useJanitorAI) {
          try {
            const answer = await callJanitorAI(question, gameContext, personality)
            console.log('✅ JanitorAI fallback response received:', answer.substring(0, 50))
            return NextResponse.json({ answer, provider: 'janitorai' })
          } catch {}
        }
      }
    } else if (preferredProvider === 'janitorai' && useJanitorAI) {
      try {
        console.log('Calling JanitorAI (user preference)...')
        const answer = await callJanitorAI(question, gameContext, personality)
        console.log('✅ JanitorAI response received:', answer.substring(0, 50))
        return NextResponse.json({ answer, provider: 'janitorai' })
      } catch (error: any) {
        console.error('❌ JanitorAI error:', error)
        console.error('Error message:', error.message)
        console.error('Error stack:', error.stack)
        
        // Return error details instead of falling back when explicitly selected
        return NextResponse.json({ 
          answer: `JanitorAI Error: ${error.message}. Please check the console for details.`,
          provider: 'janitorai-error',
          error: {
            message: error.message,
            status: error.status || 'unknown'
          }
        })
      }
    } else {
      // Auto mode: try Baseten first, then JanitorAI
      if (useBaseten) {
        try {
          console.log('Calling Baseten (auto mode)...')
          const answer = await callBaseten(question, gameContext, personality)
          console.log('✅ Baseten response received:', answer.substring(0, 50))
          return NextResponse.json({ answer, provider: 'baseten' })
        } catch (error: any) {
          console.error('❌ Baseten error:', error)
          console.log('Falling back to JanitorAI...')
        }
      }

      if (useJanitorAI) {
        try {
          console.log('Calling JanitorAI...')
          const answer = await callJanitorAI(question, gameContext, personality)
          console.log('✅ JanitorAI response received:', answer.substring(0, 50))
          return NextResponse.json({ answer, provider: 'janitorai' })
        } catch (error) {
          console.error('❌ JanitorAI error:', error)
          console.log('Falling back to mock host')
        }
      }
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
