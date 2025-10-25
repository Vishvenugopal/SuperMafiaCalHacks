import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    baseten_api_key: process.env.BASETEN_API_KEY ? 'SET' : 'NOT SET',
    baseten_model_id: process.env.BASETEN_MODEL_ID || 'NOT SET',
    janitor_api_key: process.env.JANITOR_AI_API_KEY ? 'SET' : 'NOT SET',
    elevenlabs_api_key: process.env.ELEVENLABS_API_KEY ? 'SET' : 'NOT SET',
  })
}
