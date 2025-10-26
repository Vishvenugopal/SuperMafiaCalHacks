import { NextResponse } from 'next/server'

// This endpoint simulates an agent for demo purposes
// In production, you'd use a real agent, but for CalHacks this is simpler!

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { roomCode, action, playerIdentity } = body
    
    console.log(`[Agent ${roomCode}] ${action} from ${playerIdentity}`)
    
    if (action === 'start_turn') {
      // Player started talking
      return NextResponse.json({ status: 'listening' })
    }
    
    if (action === 'end_turn') {
      // Player finished talking - generate response
      // Call your existing AI endpoint
      const aiResponse = await fetch(`${process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'}/api/host`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: `Player ${playerIdentity} has made their case.`,
          gameContext: {
            phase: { kind: 'Discussion' },
            round: 1,
            alivePlayers: [],
          },
          provider: 'baseten'
        })
      })
      
      const data = await aiResponse.json()
      const response = data.answer || "I hear you. Continue."
      
      return NextResponse.json({ 
        status: 'responded',
        message: response 
      })
    }
    
    return NextResponse.json({ status: 'ok' })
  } catch (error) {
    console.error('Agent webhook error:', error)
    return NextResponse.json({ error: 'Agent error' }, { status: 500 })
  }
}
