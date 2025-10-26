"""
Simple AI Judge Agent - Uses your existing Baseten/JanitorAI setup!
No OpenAI needed - just calls your Next.js API

Setup:
1. Install: pip install livekit python-dotenv requests
2. Make sure .env.local has your LiveKit credentials
3. Run: python agent/simple_judge.py

This is much simpler - it just forwards audio and uses your existing /api/host endpoint!
"""

import os
import asyncio
import logging
from dotenv import load_dotenv
import requests

from livekit import rtc, api

logger = logging.getLogger("simple-judge")
logger.setLevel(logging.INFO)

load_dotenv(dotenv_path=".env.local")

# Your Next.js API URL
API_BASE = os.getenv("NEXT_PUBLIC_API_URL", "http://localhost:3000")

class SimpleJudgeBot:
    def __init__(self, room: rtc.Room):
        self.room = room
        self.current_speaker = None
        self.conversation_history = []
        
    async def handle_start_turn(self, data: rtc.RpcInvocationData):
        """Player wants to speak"""
        logger.info(f"Start turn: {data.caller_identity}")
        self.current_speaker = data.caller_identity
        
        # Send acknowledgment back
        return ""
    
    async def handle_end_turn(self, data: rtc.RpcInvocationData):
        """Player finished speaking - now we respond"""
        logger.info(f"End turn: {data.caller_identity}")
        
        # In a real implementation, you'd transcribe the audio here
        # For now, we'll just send a generic response
        
        try:
            # Call your existing API
            response = requests.post(
                f"{API_BASE}/api/host",
                json={
                    "question": "A player has spoken to you in the game",
                    "gameContext": {
                        "phase": {"kind": "Discussion"},
                        "round": 1,
                        "alivePlayers": [],
                    },
                    "provider": "baseten"  # Use Baseten
                },
                timeout=30
            )
            
            if response.ok:
                data = response.json()
                answer = data.get("answer", "I'm listening...")
                logger.info(f"Judge response: {answer}")
                
                # Broadcast response to all participants
                await self.broadcast_message(answer)
            else:
                logger.error(f"API error: {response.status_code}")
                
        except Exception as e:
            logger.error(f"Error calling API: {e}")
        
        self.current_speaker = None
        return ""
    
    async def handle_cancel_turn(self, data: rtc.RpcInvocationData):
        """Player cancelled"""
        logger.info(f"Cancel turn: {data.caller_identity}")
        self.current_speaker = None
        return ""
    
    async def broadcast_message(self, message: str):
        """Send a text message to all participants"""
        try:
            data_packet = {
                "type": "judge_response",
                "message": message
            }
            
            import json
            payload = json.dumps(data_packet).encode("utf-8")
            
            await self.room.local_participant.publish_data(
                payload,
                reliable=True
            )
            
            logger.info(f"Broadcast: {message}")
        except Exception as e:
            logger.error(f"Broadcast error: {e}")


async def join_room(room_name: str):
    """Connect to a LiveKit room as the judge"""
    
    # Get environment variables
    url = os.getenv("LIVEKIT_URL") or os.getenv("LIVEKIT_WS_URL")
    api_key = os.getenv("LIVEKIT_API_KEY")
    api_secret = os.getenv("LIVEKIT_API_SECRET")
    
    if not all([url, api_key, api_secret]):
        logger.error("Missing LiveKit credentials in .env.local")
        return
    
    # Generate token
    from livekit import api as lk_api
    token = lk_api.AccessToken(api_key, api_secret)
    token.with_identity("ptt-agent")
    token.with_name("AI Judge")
    token.with_grants(lk_api.VideoGrants(
        room_join=True,
        room=room_name,
        can_publish=True,
        can_subscribe=True,
        can_publish_data=True,
    ))
    token.with_metadata('{"push-to-talk": "1"}')
    
    jwt_token = token.to_jwt()
    
    # Connect to room
    room = rtc.Room()
    
    logger.info(f"Connecting to room: {room_name}")
    await room.connect(url, jwt_token)
    logger.info(f"✅ Connected as AI Judge!")
    
    # Create bot instance
    bot = SimpleJudgeBot(room)
    
    # Register RPC methods
    room.local_participant.register_rpc_method(
        "start_turn",
        bot.handle_start_turn
    )
    room.local_participant.register_rpc_method(
        "end_turn",
        bot.handle_end_turn
    )
    room.local_participant.register_rpc_method(
        "cancel_turn",
        bot.handle_cancel_turn
    )
    
    logger.info("RPC methods registered. Waiting for players...")
    
    # Keep running
    try:
        while True:
            await asyncio.sleep(1)
    except KeyboardInterrupt:
        logger.info("Shutting down...")
        await room.disconnect()


async def monitor_rooms():
    """Monitor for new rooms and auto-join them"""
    
    # For now, just join a specific room
    # You can extend this to monitor multiple rooms
    
    room_code = input("Enter room code to join (or press Enter for 'TEST01'): ").strip()
    if not room_code:
        room_code = "TEST01"
    
    room_name = f"mafia-{room_code.upper()}"
    
    await join_room(room_name)


if __name__ == "__main__":
    print("=== Simple AI Judge Bot ===")
    print("Using your existing Baseten/JanitorAI setup!")
    print()
    
    asyncio.run(monitor_rooms())
