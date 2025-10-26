# Judge Mode Implementation Plan

## Current Status
I'm about to write a complete Judge mode that adapts the full Werewolf game (970 lines) for multi-device play with Judge voting.

## Key Changes from Werewolf:
1. **Multi-device room system** - Players join via room codes (already built ✅)
2. **Private role assignment** - Each device sees only their own role  
3. **All night phases** - Werewolf kills, Seer peeks, Medic protects (same as Werewolf)
4. **Discussion phase** - Players talk to Judge with voice (not narrator)
5. **Judge voting** - Only AI Judge votes (not players)
6. **Narrator** - Still exists for game flow announcements

## File Structure:
- Imports and constants
- Multi-device state (room sync)
- Lobby with room creation
- Role assignment (per-device)
- Night phases (all roles)
- Day reveal
- Discussion with Judge
- Judge voting (AI decides)
- Lynch resolve
- Game over

## Writing Now...
Creating the full judge-mode/page.tsx file with all phases working multi-device.
