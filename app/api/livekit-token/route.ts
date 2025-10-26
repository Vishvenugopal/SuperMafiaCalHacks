import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const apiKey = process.env.LIVEKIT_API_KEY
    const apiSecret = process.env.LIVEKIT_API_SECRET
    
    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 })
    }

    // Parse request body for room name and identity
    const body = await request.json().catch(() => ({}))
    const roomName = body.roomName || 'werewolf-game'
    const playerName = body.playerName || `Player${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    const identity = `${playerName}_${Date.now()}`
    
    // Dynamically import server SDK
    const { AccessToken } = await import('livekit-server-sdk')
    
    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      name: playerName,
      ttl: '2h',
    })
    
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    })

    return NextResponse.json({ 
      token: await token.toJwt(),
      identity,
      roomName 
    })
  } catch (error) {
    console.error('Token generation error:', error)
    return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 })
  }
}
