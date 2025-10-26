# Known Issues & Fixes

## ✅ FIXED Issues

### 1. Wolf Icon Revealing Identity (FIXED)
**Problem:** During player discussion phase, werewolves showed 🐺 icon, revealing their identity.

**Fix:** Changed to show 🧑 for all players during PlayerTalking phase.

### 2. React useEffect Error When Host Eliminated (FIXED)
**Problem:** Error "Minified React error #310" when host got eliminated and continued.

**Fix:** Removed entire `g` store object from useEffect dependency arrays. Only keeping specific properties like `g.phase.kind`.

---

## ⚠️ REMAINING Issues

### 3. Werewolf Kills Not Working (ARCHITECTURE ISSUE)
**Problem:** When werewolf kills someone, they don't die the next day.

**Root Cause:** Judge-mode is multi-device, meaning each player runs the game independently. When a werewolf clicks to kill someone:
1. It updates THEIR local `nightActions.killTargetId`
2. But the HOST's `nightActions` remains empty
3. When host calls `resolveNight()`, it only uses HOST's nightActions
4. Result: No kill is recorded

**Current Architecture:**
```
Werewolf Device:
└── g.nightActions.killTargetId = "player123" ✅ (local only)

Host Device:
└── g.nightActions.killTargetId = undefined ❌ (doesn't know about werewolf's action)

When host calls resolveNight():
└── Uses HOST's nightActions (empty) → No kill happens
```

**Proper Fix Needed:**
Need to implement server-side night action aggregation:

```typescript
// In API route
case 'submit_night_action':
  room.nightActions = room.nightActions || {}
  room.nightActions[deviceId] = {
    role: body.role,
    action: body.action, // 'kill', 'protect', 'peek'
    targetId: body.targetId
  }
  break

// When host calls resolveNight, fetch all night actions:
case 'get_night_actions':
  return {
    killTargetId: findAction(room.nightActions, 'kill'),
    protectId: findAction(room.nightActions, 'protect'),
    peekTargetId: findAction(room.nightActions, 'peek')
  }
```

Then host would:
1. Fetch night actions from server
2. Apply them to local state
3. Call resolveNight()
4. Push updated snapshot

**Temporary Workaround:**
Use single-device werewolf mode (`/werewolf`) where all actions happen on one device.

---

### 4. No Narrator for Player Discussion Phase
**Problem:** When PlayerTalking phase starts, there's no narrator announcement.

**Fix Needed:** Add narrator call when entering PlayerTalking phase:

```typescript
// In judge-mode page.tsx, when phase changes to PlayerTalking
if (g.phase.kind === 'PlayerTalking' && !narratorCalled) {
  getNarratorResponse('The village gathers to discuss. Players should talk among themselves and figure out who the werewolf might be. Keep it brief, 1-2 sentences.')
  setNarratorCalled(true)
}
```

---

### 5. Skip Vote for Player Discussion
**Problem:** No way to skip player discussion if everyone is done talking early.

**Fix Needed:** Add vote-to-skip mechanism:

1. Add skip votes to room state
2. Add "Ready to Continue" button in PlayerTalking UI
3. Track who voted to skip
4. When all alive players vote skip, auto-advance to Discussion
5. Reset skip votes when entering new PlayerTalking phase

```typescript
// In judge-mode page.tsx PlayerTalking section
<Button onClick={async () => {
  await fetch('/api/room', {
    method: 'POST',
    body: JSON.stringify({
      action: 'vote_skip',
      roomCode,
      deviceId
    })
  })
}}>
  Ready to Continue ({skipVotes}/{alivePlayers.length})
</Button>
```

---

## 🎯 Priority

1. **HIGH:** Fix werewolf kills (architecture change needed)
2. **MEDIUM:** Add narrator for player discussion
3. **LOW:** Add skip vote mechanism

---

## 📝 Notes

- The werewolf kill issue is fundamental and requires refactoring how night actions work in judge-mode
- Consider whether judge-mode should be the primary mode or if single-device mode should be recommended
- All other issues are cosmetic/UX improvements
