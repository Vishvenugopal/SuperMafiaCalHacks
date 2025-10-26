"""
AI Judge Agent for SuperMafia
Multi-player push-to-talk agent that acts as a judge in the game

Setup:
1. Install dependencies: pip install livekit-agents livekit-plugins-openai livekit-plugins-deepgram livekit-plugins-cartesia python-dotenv
2. Set environment variables in .env file:
   - LIVEKIT_URL=your_livekit_url
   - LIVEKIT_API_KEY=your_api_key
   - LIVEKIT_API_SECRET=your_api_secret
   - OPENAI_API_KEY=your_openai_key
   - DEEPGRAM_API_KEY=your_deepgram_key
   - CARTESIA_API_KEY=your_cartesia_key (or use another TTS)
3. Run: python judge_agent.py start

To connect, use room name format: mafia-ROOMCODE (e.g., mafia-ABC123)
"""

import logging
from dotenv import load_dotenv

from livekit import rtc
from livekit.agents import Agent, AgentSession, JobContext, JobRequest, RoomIO, WorkerOptions, cli
from livekit.agents.llm import ChatContext, ChatMessage, StopResponse
from livekit.plugins import deepgram, openai

# Try to import Cartesia TTS, fallback to OpenAI TTS if not available
try:
    from livekit.plugins import cartesia
    TTS_PLUGIN = cartesia.TTS()
except ImportError:
    print("Cartesia not available, using OpenAI TTS")
    TTS_PLUGIN = openai.TTS(voice="alloy")

logger = logging.getLogger("judge-agent")
logger.setLevel(logging.INFO)

load_dotenv()


class JudgeAgent(Agent):
    """
    AI Judge agent that listens to players and makes decisions
    """
    def __init__(self) -> None:
        super().__init__(
            instructions="""You are the AI Judge in a social deduction game similar to Mafia/Werewolf.

Your role:
- Listen carefully to each player's arguments and defenses
- Ask clarifying questions when needed
- Keep track of who has spoken and what they said
- Be fair but skeptical - look for inconsistencies
- At the end of each round, you must vote to eliminate one player or abstain
- Explain your reasoning briefly when making decisions
- Stay in character as a wise, thoughtful judge

Respond naturally and conversationally. Keep responses under 3 sentences.
Be dramatic and engaging, but fair.""",
            stt=deepgram.STT(),
            llm=openai.LLM(model="gpt-4o-mini"),
            tts=TTS_PLUGIN,
        )
        
        # Track game state
        self.players_spoken = set()
        self.round_number = 1
        self.suspicions = {}  # player -> suspicion notes

    async def on_user_turn_completed(
        self, turn_ctx: ChatContext, new_message: ChatMessage
    ) -> None:
        """Callback before generating a reply after user turn committed"""
        if not new_message.text_content:
            logger.info("Ignoring empty user turn")
            raise StopResponse()
        
        # Log the player's statement
        logger.info(f"Player statement: {new_message.text_content}")


async def entrypoint(ctx: JobContext):
    """Main entrypoint for the agent"""
    logger.info(f"Agent joining room: {ctx.room.name}")
    
    session = AgentSession(turn_detection="manual")
    room_io = RoomIO(session, room=ctx.room)
    await room_io.start()

    agent = JudgeAgent()
    await session.start(agent=agent)

    # Disable input audio at the start - only enable during push-to-talk
    session.input.set_audio_enabled(False)

    # Announce joining
    await agent.say("The Judge has entered. State your case when ready.")

    @ctx.room.local_participant.register_rpc_method("start_turn")
    async def start_turn(data: rtc.RpcInvocationData):
        """Player pressed push-to-talk button"""
        logger.info(f"Start turn from: {data.caller_identity}")
        
        # Interrupt any current speech
        session.interrupt()
        session.clear_user_turn()

        # Listen to the caller
        room_io.set_participant(data.caller_identity)
        session.input.set_audio_enabled(True)
        
        logger.info(f"Now listening to: {data.caller_identity}")

    @ctx.room.local_participant.register_rpc_method("end_turn")
    async def end_turn(data: rtc.RpcInvocationData):
        """Player released push-to-talk button"""
        logger.info(f"End turn from: {data.caller_identity}")
        
        session.input.set_audio_enabled(False)
        
        # Commit the user turn and generate response
        session.commit_user_turn(
            # Timeout for final transcript
            transcript_timeout=10.0,
            # Silence duration to flush STT
            stt_flush_duration=2.0,
        )

    @ctx.room.local_participant.register_rpc_method("cancel_turn")
    async def cancel_turn(data: rtc.RpcInvocationData):
        """Player cancelled their turn"""
        logger.info(f"Cancel turn from: {data.caller_identity}")
        
        session.input.set_audio_enabled(False)
        session.clear_user_turn()
    
    @ctx.room.local_participant.register_rpc_method("request_vote")
    async def request_vote(data: rtc.RpcInvocationData):
        """Request the judge to make a voting decision"""
        logger.info("Vote requested by host")
        
        # Get list of players
        players = [p.identity for p in ctx.room.remote_participants.values() 
                  if not p.identity.startswith('ptt-agent')]
        
        if not players:
            await agent.say("No players to vote for. Abstaining.")
            return
        
        # Ask the LLM to make a decision
        vote_prompt = f"""Based on the arguments you've heard, you must now vote to eliminate one player or abstain.

Available players: {', '.join(players)}

Who do you vote to eliminate? Respond with just the player name, or say 'abstain' if you cannot decide. Then briefly explain your reasoning in 1-2 sentences."""
        
        # This would need integration with the game logic to actually cast the vote
        await agent.say(vote_prompt)

    # Track participants
    @ctx.room.on("participant_connected")
    def on_participant_connected(participant: rtc.RemoteParticipant):
        logger.info(f"Participant joined: {participant.identity}")
        
    @ctx.room.on("participant_disconnected")
    def on_participant_disconnected(participant: rtc.RemoteParticipant):
        logger.info(f"Participant left: {participant.identity}")


async def handle_request(request: JobRequest) -> None:
    """Handle incoming job requests"""
    logger.info(f"Received request for room: {request.room.name}")
    
    # Accept any room that starts with "mafia-"
    if request.room.name.startswith("mafia-"):
        await request.accept(
            identity="ptt-agent",
            # This attribute tells clients we support push-to-talk
            attributes={"push-to-talk": "1"},
        )
        logger.info(f"Accepted request for room: {request.room.name}")
    else:
        logger.info(f"Rejected request for room: {request.room.name}")
        await request.reject()


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint, 
            request_fnc=handle_request
        )
    )
