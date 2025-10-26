# Baseten Chinese Response Fix

## Problem
The GLM-4.6 model from Baseten defaults to Chinese responses despite English-only instructions.

## Solutions Implemented

### 1. **Stronger Prompts** ✅
- Added bilingual instructions in system prompt
- Explicit `[RESPOND IN ENGLISH ONLY]` markers
- Reduced temperature to 0.5 for more consistent behavior
- Added `response_format: { type: "text" }` parameter

### 2. **Chinese Detection Filter** ✅
```typescript
// Detects Chinese characters and replaces with English fallback
const hasChinese = /[\u4e00-\u9fa5]/.test(response)
if (hasChinese) {
  return 'The game continues. Stay alert and trust your instincts.'
}
```

### 3. **Better Model Alternatives**

#### Option A: Use JanitorAI Instead (Recommended)
JanitorAI's models are better at following English-only instructions:

```typescript
// In your .env.local
JANITOR_AI_API_KEY=your_key_here

// In game settings, select:
AI Provider: janitorai
```

#### Option B: Use Different Baseten Model
Try these English-first models on Baseten:

```env
# In .env.local, replace GLM-4.6 with:
BASETEN_MODEL_ID=meta-llama/Llama-3.2-3B-Instruct
# or
BASETEN_MODEL_ID=mistralai/Mistral-7B-Instruct-v0.2
# or
BASETEN_MODEL_ID=google/gemma-2-9b-it
```

#### Option C: Use OpenAI API
Most reliable for English responses:

```typescript
// Add to .env.local
OPENAI_API_KEY=your_key_here

// Add new function in route.ts:
async function callOpenAI(question: string, gameContext?: any) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a game narrator for Werewolf. Keep responses brief (1-2 sentences).' },
        { role: 'user', content: question }
      ],
      max_tokens: 100,
      temperature: 0.7
    })
  })
  const data = await response.json()
  return data.choices[0].message.content
}
```

## Current Behavior

With the fixes:
1. ✅ Stronger English-only prompts sent to model
2. ✅ Chinese responses automatically detected
3. ✅ Fallback to English generic responses
4. ⚠️ Console warning logged when Chinese detected

## Recommended Action

**Switch to JanitorAI or use a different Baseten model** for better English-only responses. GLM-4.6 is primarily a Chinese language model, so it will always have a tendency to respond in Chinese.

### Quick Test
```bash
# Test with JanitorAI
# 1. Add JANITOR_AI_API_KEY to .env.local
# 2. In game settings, select "janitorai" as AI provider
# 3. Start a game and test narrator responses
```

## Model Comparison

| Model | Language | Quality | Speed | Cost |
|-------|----------|---------|-------|------|
| GLM-4.6 | Chinese-first | Good | Fast | Low |
| JanitorAI | English | Good | Medium | Low |
| Llama-3.2 | English | Excellent | Fast | Low |
| GPT-3.5 | English | Excellent | Fast | Medium |

**Recommendation**: Use Llama-3.2-3B-Instruct on Baseten for best English-only results at low cost.
