import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.JANITOR_AI_API_KEY
  
  if (!apiKey) {
    return NextResponse.json({ error: 'JANITOR_AI_API_KEY not set' }, { status: 500 })
  }

  try {
    console.log('Testing JanitorAI with key:', apiKey.substring(0, 15) + '...')
    
    const response = await fetch('https://janitorai.com/hackathon/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': apiKey  // No Bearer prefix per JanitorAI staff
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say hello in one sentence.' }
        ],
        max_tokens: 50,
        temperature: 0.7,
        stream: false  // Disable streaming to get JSON response
      })
    })

    console.log('JanitorAI response status:', response.status)
    console.log('JanitorAI response headers:', Object.fromEntries(response.headers.entries()))

    const contentType = response.headers.get('content-type') || ''
    const raw = await response.text()
    console.log('JanitorAI test content-type:', contentType)
    console.log('JanitorAI test raw (first 200):', raw.slice(0, 200))

    if (!response.ok) {
      console.error('JanitorAI error response:', raw)
      return NextResponse.json({ 
        error: 'JanitorAI API error',
        status: response.status,
        statusText: response.statusText,
        body: raw,
        headers: Object.fromEntries(response.headers.entries())
      }, { status: 500 })
    }

    // Try JSON first
    try {
      const data = JSON.parse(raw)
      console.log('JanitorAI success JSON:', JSON.stringify(data).slice(0, 200))
      return NextResponse.json({ success: true, data })
    } catch {}

    // Fallback: parse SSE stream chunks
    let assembled = ''
    const lines = raw.split(/\r?\n/)
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const obj = JSON.parse(payload)
        const choice = obj.choices?.[0]
        const deltaText = choice?.delta?.content || choice?.message?.content || obj.content || obj.text || ''
        if (typeof deltaText === 'string') assembled += deltaText
      } catch {}
    }

    try {
      const fs = await import('fs/promises')
      await fs.writeFile('janitorai-test-raw.txt', `Raw:\n${raw}\n\nTime: ${new Date().toISOString()}`, 'utf-8')
    } catch {}

    if (assembled.trim()) {
      return NextResponse.json({ success: true, text: assembled.trim(), format: 'sse' })
    }

    return NextResponse.json({ success: false, note: 'Could not parse response', raw: raw.slice(0, 200) }, { status: 500 })
  } catch (error: any) {
    console.error('JanitorAI test error:', error)
    return NextResponse.json({ 
      error: 'Exception thrown',
      message: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}
