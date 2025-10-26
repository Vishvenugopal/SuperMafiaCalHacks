# Judge Mode Fixes - Completed

## Issues Fixed

### 1. Role Reveal Loop Bug ✅
**Problem:** Non-host players were getting stuck in an infinite loop between "I'm Ready" and role reveal screens.

**Root Cause:** 
- Auto-advance timer (lines 190-197) was resetting `roleRevealed` after 5 seconds
- "I'm Ready" button was also resetting `roleRevealed`, causing the loop

**Solution:**
- Removed the 5-second auto-advance timer completely
- Changed "I'm Ready" button to a static status message "✓ Ready! Waiting for all players..."
- Role advancement now only happens when ALL players mark their role as revealed (server-side tracking)

### 2. Profile Picture Support ✅
**Problem:** Judge mode didn't have profile picture upload like classic mode.

**Solution:**
- Added file input with camera capture support on join screen
- Added preview with remove button for uploaded avatars
- Updated `RoomPlayer` interface to include `avatarDataUrl?: string`
- Updated server API (`route.ts`) to store and transmit avatar data
- Display avatars in:
  - Lobby player list (with proper styling matching classic mode)
  - Role reveal screens (both before and after revealing)
  - Game state preservation through `g.addPlayer(name, avatarDataUrl)`

### 3. Syncing Issues ✅
**Problem:** Multiple duplicate polling effects causing potential race conditions.

**Solution:**
- Removed duplicate `get_players` polling effect (lines 496-531)
- Removed duplicate client hydration polling effect (lines 619-640)
- Consolidated to single unified polling in `get_state` effect (lines 555-580)
- All lobby updates now go through the unified `get_state` endpoint

## Code Changes Summary

### Frontend (`app/judge-mode/page.tsx`)
1. Added `playerAvatar` state and `fileRef` for file upload
2. Added profile picture upload UI with preview in join screen
3. Updated `createRoom` and `joinRoom` to send `avatarDataUrl`
4. Updated `startGame` to preserve avatars: `roomPlayers.forEach(p => g.addPlayer(p.name, p.avatarDataUrl))`
5. Enhanced lobby player list UI with avatar circles
6. Added avatars to role reveal screens
7. Removed role reveal auto-advance timer
8. Changed "I'm Ready" button to status text
9. Removed duplicate polling effects

### Backend (`app/api/room/route.ts`)
1. Added `avatarDataUrl?: string` to Room player interface
2. Extracted `avatarDataUrl` from request body
3. Store avatar data when creating room
4. Store avatar data when joining room
5. Return avatar data in all player list responses

## Testing Checklist

- [ ] Create a room with profile picture
- [ ] Join a room with profile picture
- [ ] Start game and verify avatars appear in lobby
- [ ] Verify role reveal doesn't loop (stays on "✓ Ready!" message)
- [ ] Verify game progresses only when all players click "Reveal My Role"
- [ ] Verify avatars appear during role reveal
- [ ] Test with multiple devices simultaneously
- [ ] Verify no console errors during phase transitions

## Consistency with Classic Mode

The implementation now matches the classic werewolf mode:
- Same profile picture upload flow
- Same avatar display styling (purple-pink gradient circles)
- Same file input with camera capture
- Same preview and remove functionality
- Same data structure (`avatarDataUrl` in Player type)

All syncing is handled through a single unified polling mechanism, reducing the chance of race conditions and improving reliability.
