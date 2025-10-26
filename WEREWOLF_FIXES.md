# Classic Werewolf Mode Fixes

## Issues Fixed

### 1. **No AI Voice/Audio**
**Problem**: The Baseten API (GLM-4.6 model) was returning empty content (`"\n"`) with Chinese text in the reasoning field, causing:
- Empty dialogue boxes (nothing to display)
- No TTS voice output (nothing to speak)

**Solution**: 
- Added validation to detect empty/whitespace responses before processing
- Implemented context-aware English fallback responses for common game scenarios:
  - Night phase announcements
  - Day/dawn announcements  
  - Voting/lynch announcements
  - Death/elimination announcements
  - General game continuation messages

### 2. **Chinese Language Responses**
**Problem**: The GLM-4.6 model was responding in Chinese despite English-only instructions.

**Solution**:
- Strengthened system prompt to be more explicit about English-only requirement
- Removed mixed-language instructions that might confuse the model
- Enhanced Chinese character detection with better fallback logic
- Added empty response detection (catches cases where content is just whitespace)

### 3. **No Dialogue Box Showing**
**Problem**: When API returned empty/invalid responses, `hostResponse` state was set to empty string, preventing dialogue box from rendering.

**Solution**: 
- Fallback responses ensure `hostResponse` always has valid content
- Dialogue box will now show even when API fails, using contextual English messages

## Technical Changes

### File: `app/api/host/route.ts`

1. **Empty Response Detection** (Lines 94-109):
```typescript
if (!trimmed || trimmed.length < 3) {
  console.warn('⚠️ Baseten returned empty/invalid response, using English fallback')
  // Context-aware fallback responses
}
```

2. **Improved System Prompt** (Lines 27-28):
- Removed confusing mixed-language instructions
- Clearer "English only" directive
- Added "dramatic and atmospheric" guidance for better narration

3. **Enhanced Fallback Logic** (Lines 98-127):
- Checks for night, day, vote, death, and general scenarios
- Provides appropriate dramatic responses for each context

## Testing Recommendations

1. **Start a new game** in Classic Werewolf mode
2. **Verify narrator speaks** at night phase transitions
3. **Check dialogue box appears** with English text
4. **Test voice output** (should use TTS or ElevenLabs if configured)
5. **Ask questions** using the microphone button to test user interaction

## Fallback Behavior

If Baseten continues to have issues:
- System will automatically use English fallback responses
- Fallbacks are contextual based on game phase
- Voice synthesis will still work with fallback text
- Game remains fully playable

## Alternative: Switch to JanitorAI

If Baseten GLM-4.6 continues returning Chinese/empty responses:
1. Go to lobby settings
2. Change "AI Provider" to "JanitorAI"
3. Ensure `JANITOR_AI_API_KEY` is set in environment variables

## Notes

- The GLM-4.6 model appears to have a language preference issue
- Fallback system ensures game is never broken by API issues
- All fallback responses are dramatic and game-appropriate
- TTS will work with both API responses and fallbacks
