import { NextResponse } from 'next/server'

export async function GET() {
  const apiKey = process.env.JANITOR_AI_API_KEY
  
  return NextResponse.json({
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
    apiKeyPrefix: apiKey ? apiKey.substring(0, 10) + '...' : 'not set',
    endpoint: 'https://janitorai.com/hackathon/chat/completions'
  })
}
