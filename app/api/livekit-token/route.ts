import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET
    
    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 })
    }

    // Generate a unique participant identity
    const identity = `player_${Math.random().toString(36).slice(2)}`
    
    // Dynamically import server SDK
    const { AccessToken } = await import('livekit-server-sdk')
    
    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      ttl: '1h',
    })
    
    token.addGrant({
      room: 'werewolf-game',
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    })

    return NextResponse.json({ token: await token.toJwt() })
  } catch (error) {
    console.error('Token generation error:', error)
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 })
  }
}
