"""
Multi-Agent Manager - Spawns one agent per room
Each game gets its own dedicated AI Judge
"""

import os
import asyncio
import logging
from dotenv import load_dotenv
import requests
from typing import Dict
from livekit import rtc, api

logger = logging.getLogger("multi-agent")
logger.setLevel(logging.INFO)

load_dotenv(dotenv_path=".env.local")

API_BASE = os.getenv("NEXT_PUBLIC_API_URL", "http://localhost:3000")

class RoomAgent:
    """Individual agent for one specific room"""
    
    def __init__(self, room_code: str):
        self.room_code = room_code
        self.room_name = f"mafia-{room_code}"
        self.room = None
        self.current_speaker = None
        
    async def connect(self):
        """Connect to the LiveKit room"""
        url = os.getenv("LIVEKIT_URL") or os.getenv("LIVEKIT_WS_URL")
        api_key = os.getenv("LIVEKIT_API_KEY")
        api_secret = os.getenv("LIVEKIT_API_SECRET")
        
        if not all([url, api_key, api_secret]):
            logger.error("Missing LiveKit credentials")
            return False
        
        # Generate token
        token = api.AccessToken(api_key, api_secret)
        token.with_identity("ptt-agent")
        token.with_name("AI Judge")
        token.with_grants(api.VideoGrants(
            room_join=True,
            room=self.room_name,
            can_publish=True,
            can_subscribe=True,
            can_publish_data=True,
        ))
        token.with_metadata('{"push-to-talk": "1"}')
        
        jwt_token = token.to_jwt()
        
        # Connect
        self.room = rtc.Room()
        
        try:
            logger.info(f"[{self.room_code}] Connecting...")
            await self.room.connect(url, jwt_token)
            logger.info(f"[{self.room_code}] ✅ Connected as AI Judge!")
            
            # Register RPC methods
            self.room.local_participant.register_rpc_method("start_turn", self.handle_start_turn)
            self.room.local_participant.register_rpc_method("end_turn", self.handle_end_turn)
            self.room.local_participant.register_rpc_method("cancel_turn", self.handle_cancel_turn)
            
            # Send welcome message
            await self.broadcast_message("The AI Judge has joined the room. Press and hold the microphone to speak.")
            
            return True
        except Exception as e:
            logger.error(f"[{self.room_code}] Connection failed: {e}")
            return False
    
    async def handle_start_turn(self, data: rtc.RpcInvocationData):
        """Player started talking"""
        logger.info(f"[{self.room_code}] Start turn: {data.caller_identity}")
        self.current_speaker = data.caller_identity
        return ""
    
    async def handle_end_turn(self, data: rtc.RpcInvocationData):
        """Player finished talking - generate response"""
        logger.info(f"[{self.room_code}] End turn: {data.caller_identity}")
        
        try:
            # Call your existing API
            response = requests.post(
                f"{API_BASE}/api/host",
                json={
                    "question": f"Player {data.caller_identity} has made their case to you, the AI Judge.",
                    "gameContext": {
                        "phase": {"kind": "Discussion"},
                        "round": 1,
                        "alivePlayers": [],
                    },
                    "provider": "baseten"
                },
                timeout=30
            )
            
            if response.ok:
                data_json = response.json()
                answer = data_json.get("answer", "I hear you. Continue.")
                logger.info(f"[{self.room_code}] Judge says: {answer[:50]}...")
                await self.broadcast_message(answer)
            else:
                logger.error(f"[{self.room_code}] API error: {response.status_code}")
                await self.broadcast_message("I'm listening carefully...")
                
        except Exception as e:
            logger.error(f"[{self.room_code}] Error: {e}")
            await self.broadcast_message("Please continue...")
        
        self.current_speaker = None
        return ""
    
    async def handle_cancel_turn(self, data: rtc.RpcInvocationData):
        """Player cancelled"""
        logger.info(f"[{self.room_code}] Cancel turn: {data.caller_identity}")
        self.current_speaker = None
        return ""
    
    async def broadcast_message(self, message: str):
        """Send message to all participants"""
        if not self.room:
            return
            
        try:
            import json
            payload = json.dumps({
                "type": "judge_response",
                "message": message
            }).encode("utf-8")
            
            await self.room.local_participant.publish_data(payload, reliable=True)
        except Exception as e:
            logger.error(f"[{self.room_code}] Broadcast error: {e}")
    
    async def disconnect(self):
        """Disconnect from room"""
        if self.room:
            await self.room.disconnect()
            logger.info(f"[{self.room_code}] Disconnected")


class AgentManager:
    """Manages multiple agents, one per room"""
    
    def __init__(self):
        self.agents: Dict[str, RoomAgent] = {}
        self.tasks: Dict[str, asyncio.Task] = {}
    
    async def spawn_agent(self, room_code: str):
        """Spawn a new agent for a room"""
        room_code = room_code.upper()
        
        if room_code in self.agents:
            logger.info(f"Agent already exists for room {room_code}")
            return
        
        logger.info(f"Spawning agent for room: {room_code}")
        agent = RoomAgent(room_code)
        
        if await agent.connect():
            self.agents[room_code] = agent
            # Keep agent running
            task = asyncio.create_task(self._keep_alive(agent))
            self.tasks[room_code] = task
            logger.info(f"✅ Agent spawned for room: {room_code}")
        else:
            logger.error(f"❌ Failed to spawn agent for room: {room_code}")
    
    async def _keep_alive(self, agent: RoomAgent):
        """Keep agent alive and monitor for disconnection"""
        try:
            while True:
                await asyncio.sleep(5)
                # Check if room still has participants
                if agent.room and len(agent.room.remote_participants) == 0:
                    logger.info(f"[{agent.room_code}] No participants, waiting...")
        except asyncio.CancelledError:
            logger.info(f"[{agent.room_code}] Task cancelled")
        except Exception as e:
            logger.error(f"[{agent.room_code}] Error: {e}")
    
    async def remove_agent(self, room_code: str):
        """Remove agent for a room"""
        room_code = room_code.upper()
        
        if room_code in self.agents:
            await self.agents[room_code].disconnect()
            del self.agents[room_code]
            
        if room_code in self.tasks:
            self.tasks[room_code].cancel()
            del self.tasks[room_code]
            
        logger.info(f"Removed agent for room: {room_code}")
    
    async def list_agents(self):
        """List all active agents"""
        return list(self.agents.keys())


async def interactive_mode():
    """Interactive mode for demo - spawn agents as needed"""
    manager = AgentManager()
    
    print("\n" + "="*60)
    print("🎮 SuperMafia Multi-Agent Manager")
    print("="*60)
    print("\nCommands:")
    print("  spawn <CODE>  - Spawn agent for room code (e.g., spawn ABC123)")
    print("  list          - List all active agents")
    print("  remove <CODE> - Remove agent for room")
    print("  quit          - Exit")
    print("\nTip: Just create a room in the web UI, then run 'spawn CODE' here")
    print("="*60 + "\n")
    
    async def process_commands():
        while True:
            await asyncio.sleep(0.1)
            try:
                # Non-blocking input simulation
                pass
            except:
                pass
    
    # Start command processor
    asyncio.create_task(process_commands())
    
    # Command loop
    while True:
        try:
            cmd = await asyncio.get_event_loop().run_in_executor(
                None, 
                input, 
                "🤖 > "
            )
            
            parts = cmd.strip().split()
            if not parts:
                continue
                
            command = parts[0].lower()
            
            if command == "spawn" and len(parts) > 1:
                room_code = parts[1].upper()
                await manager.spawn_agent(room_code)
                
            elif command == "list":
                agents = await manager.list_agents()
                if agents:
                    print(f"Active agents: {', '.join(agents)}")
                else:
                    print("No active agents")
                    
            elif command == "remove" and len(parts) > 1:
                room_code = parts[1].upper()
                await manager.remove_agent(room_code)
                
            elif command in ["quit", "exit"]:
                print("Shutting down all agents...")
                for room_code in list(manager.agents.keys()):
                    await manager.remove_agent(room_code)
                break
                
            else:
                print("Unknown command. Type 'spawn <CODE>', 'list', 'remove <CODE>', or 'quit'")
                
        except KeyboardInterrupt:
            print("\nShutting down...")
            break
        except Exception as e:
            logger.error(f"Error: {e}")


if __name__ == "__main__":
    try:
        asyncio.run(interactive_mode())
    except KeyboardInterrupt:
        print("\nGoodbye!")
