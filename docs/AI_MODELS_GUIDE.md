# 🤖 AI Models Guide - Adding & Using Multiple Models

**Created:** 2025-06-26  
**Location:** `src/services/tenant/ai/`

---

## Current Setup

### Providers Available

| Provider | Type | Default Model | Cost | Status |
|----------|------|---------------|------|--------|
| **OpenAI** | Cloud | gpt-4o-mini | $0.15-0.60/1M tokens | ✅ Ready |
| **Claude** | Cloud | claude-3-5-sonnet | $3-15/1M tokens | ✅ Ready |
| **Gemini** | Cloud | gemini-1.5-flash | $0.075-0.30/1M tokens | ✅ Ready |
| **Perplexity** | Cloud | sonar | $1/1M tokens | ✅ Ready |
| **Ollama** | Local | llama3.2 | Free | ✅ Ready |
| **LM Studio** | Local | local-model | Free | ✅ Ready |

### Files Structure

```
src/services/tenant/ai/
├── base.provider.ts      # Abstract base class
├── openai.provider.ts    # OpenAI implementation
├── claude.provider.ts    # Anthropic implementation
├── gemini.provider.ts    # Google implementation
├── perplexity.provider.ts # Perplexity implementation
├── ollama.provider.ts    # Ollama local
├── lmstudio.provider.ts  # LM Studio local
├── router.ts             # Main router (fallback, task routing)
├── types.ts              # Types, models, costs, task mapping
└── index.ts              # Exports
```

---

## Part 1: Adding a New Model to Existing Provider

### Example: Add GPT-4o to OpenAI

**Step 1:** Update `types.ts`

```typescript
// In PROVIDER_MODELS.openai.models
models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini'],

// Add cost
costPer1kTokens: {
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'o1-preview': { input: 0.015, output: 0.060 },  // NEW
  'o1-mini': { input: 0.003, output: 0.012 },     // NEW
  // ...
}
```

**Step 2:** Use the model in requests

```typescript
const response = await aiRouter.complete({
  messages: [{ role: 'user', content: 'Complex reasoning task' }],
  model: 'o1-preview',  // Specify the model
  tenantId: tenant.id
}, 'openai');  // Specify provider
```

---

## Part 2: Adding a New Provider (e.g., Mistral, Groq, Together AI)

### Step 1: Create Provider File

Create `src/services/tenant/ai/mistral.provider.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';  // Or appropriate SDK
import {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIProviderConfig
} from './types';
import { BaseAIProvider } from './base.provider';

export class MistralProvider extends BaseAIProvider {
  private client: any;  // MistralClient

  constructor(config: AIProviderConfig) {
    super(config);
    
    if (config.apiKey) {
      // Initialize Mistral client
      this.client = new MistralClient({ apiKey: config.apiKey });
    }
  }

  get name(): AIProvider {
    return 'mistral' as AIProvider;
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const startTime = Date.now();
    
    try {
      const response = await this.client.chat.completions.create({
        model: this.getModel(request),
        messages: request.messages,
        max_tokens: this.getMaxTokens(request),
        temperature: this.getTemperature(request)
      });

      return {
        content: response.choices[0].message.content || '',
        provider: this.name,
        model: response.model,
        usage: {
          inputTokens: response.usage?.prompt_tokens || 0,
          outputTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0
        },
        responseTimeMs: Date.now() - startTime,
        finishReason: response.choices[0].finish_reason as any
      };
    } catch (error) {
      this.markUnavailable((error as Error).message);
      throw error;
    }
  }

  async stream(
    request: AICompletionRequest,
    onChunk: (chunk: string) => void
  ): Promise<AICompletionResponse> {
    // Implement streaming...
    // Similar to complete but with stream: true
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.complete({
        messages: [{ role: 'user', content: 'ping' }],
        maxTokens: 5
      });
      this.isAvailable = true;
      return true;
    } catch {
      this.isAvailable = false;
      return false;
    }
  }
}
```

### Step 2: Update Types

In `types.ts`:

```typescript
// Add to AIProvider type
export type AIProvider = 'openai' | 'claude' | 'perplexity' | 'gemini' | 
                         'lm_studio' | 'ollama' | 'mistral';  // NEW

// Add to PROVIDER_MODELS
mistral: {
  default: 'mistral-large-latest',
  models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
  costPer1kTokens: {
    'mistral-large-latest': { input: 0.003, output: 0.009 },
    'mistral-small-latest': { input: 0.001, output: 0.003 },
    'codestral-latest': { input: 0.001, output: 0.003 }
  }
}
```

### Step 3: Register in Router

In `router.ts`:

```typescript
import { MistralProvider } from './mistral.provider';

// In initializeProviders():
if (providerConfigs.mistral?.enabled !== false) {
  this.providers.set(
    'mistral',
    new MistralProvider({
      provider: 'mistral',
      enabled: true,
      priority: 2,
      defaultModel: PROVIDER_MODELS.mistral.default,
      maxTokens: 4096,
      temperature: 0.7,
      rateLimit: 60,
      ...providerConfigs.mistral
    })
  );
}
```

### Step 4: Add Environment Variable

In `.env`:

```bash
MISTRAL_API_KEY=your-api-key-here
```

### Step 5: Update Default Router

In `router.ts` `createDefaultRouter()`:

```typescript
mistral: {
  provider: 'mistral',
  enabled: !!process.env.MISTRAL_API_KEY,
  apiKey: process.env.MISTRAL_API_KEY,
  defaultModel: 'mistral-large-latest',
  maxTokens: 4096,
  temperature: 0.7,
  rateLimit: 60,
  priority: 2
}
```

---

## Part 3: Using Parallel Execution

### Method 1: Code-Level Parallel (Promise.all)

Add this to `router.ts`:

```typescript
/**
 * Execute request on multiple providers in parallel
 * Returns all responses for consensus/comparison
 */
async parallel(
  request: AICompletionRequest,
  providers?: AIProvider[]
): Promise<{
  responses: AICompletionResponse[];
  consensus: {
    score: number;
    themes: string[];
    bestResponse: AICompletionResponse;
  };
}> {
  // Get providers to use
  const targetProviders = providers 
    ? providers.map(p => this.providers.get(p)).filter(Boolean)
    : this.getSortedProviders().slice(0, 3);  // Default: top 3

  if (targetProviders.length === 0) {
    throw new Error('No providers available for parallel execution');
  }

  // Execute in parallel
  const results = await Promise.allSettled(
    targetProviders.map(provider => provider!.complete(request))
  );

  // Collect successful responses
  const responses: AICompletionResponse[] = [];
  const errors: string[] = [];

  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      responses.push(result.value);
    } else {
      errors.push(`${targetProviders[i]!.name}: ${result.reason}`);
    }
  });

  if (responses.length === 0) {
    throw new Error(`All providers failed: ${errors.join(', ')}`);
  }

  // Calculate consensus
  const consensus = this.calculateConsensus(responses);

  // Track usage for all successful responses
  if (this.config.trackUsage && request.tenantId) {
    for (const response of responses) {
      const provider = this.providers.get(response.provider);
      if (provider) {
        await this.trackUsage({
          tenantId: request.tenantId,
          provider: response.provider,
          model: response.model,
          inputTokens: response.usage.inputTokens,
          outputTokens: response.usage.outputTokens,
          costUsd: provider.calculateCost(
            response.usage.inputTokens,
            response.usage.outputTokens,
            response.model
          ),
          requestType: request.requestType || 'parallel'
        });
      }
    }
  }

  return { responses, consensus };
}

/**
 * Calculate consensus between multiple AI responses
 */
private calculateConsensus(responses: AICompletionResponse[]): {
  score: number;
  themes: string[];
  bestResponse: AICompletionResponse;
} {
  if (responses.length === 1) {
    return { score: 1, themes: [], bestResponse: responses[0] };
  }

  // Extract words from each response
  const wordSets = responses.map(r => 
    new Set(r.content.toLowerCase().match(/\b\w{4,}\b/g) || [])
  );

  // Calculate Jaccard similarity between all pairs
  let totalSimilarity = 0;
  let pairs = 0;

  for (let i = 0; i < wordSets.length; i++) {
    for (let j = i + 1; j < wordSets.length; j++) {
      const intersection = [...wordSets[i]].filter(w => wordSets[j].has(w));
      const union = new Set([...wordSets[i], ...wordSets[j]]);
      totalSimilarity += intersection.length / union.size;
      pairs++;
    }
  }

  const score = pairs > 0 ? totalSimilarity / pairs : 0;

  // Find common themes (words appearing in majority of responses)
  const wordCounts = new Map<string, number>();
  wordSets.forEach(set => {
    set.forEach(word => {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    });
  });

  const threshold = Math.ceil(responses.length / 2);
  const themes = [...wordCounts.entries()]
    .filter(([_, count]) => count >= threshold)
    .map(([word]) => word)
    .slice(0, 10);

  // Best response = longest (usually most detailed)
  const bestResponse = responses.reduce((a, b) => 
    a.content.length > b.content.length ? a : b
  );

  return { score, themes, bestResponse };
}
```

### Usage:

```typescript
// Parallel execution with specific providers
const result = await aiRouter.parallel(
  {
    messages: [{ 
      role: 'user', 
      content: 'Should we add a vegan option to our menu?' 
    }],
    tenantId: tenant.id
  },
  ['openai', 'claude', 'gemini']  // Compare these 3
);

console.log('Consensus score:', result.consensus.score);  // 0-1
console.log('Common themes:', result.consensus.themes);
console.log('Best response:', result.consensus.bestResponse.content);
console.log('All responses:', result.responses);
```

---

### Method 2: n8n Workflow (Already Built!)

You already have `parallel-ai-consensus.json` workflow.

**Trigger via HTTP:**

```bash
curl -X POST http://localhost:5678/webhook/parallel-ai \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Should we raise prices by 10%?",
    "providers": ["anthropic", "openai"],
    "temperature": 0.3,
    "max_tokens": 300
  }'
```

**Trigger from code:**

```typescript
async function getParallelConsensus(prompt: string): Promise<any> {
  const response = await fetch('http://localhost:5678/webhook/parallel-ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt,
      providers: ['anthropic', 'openai'],
      temperature: 0.5
    })
  });
  return response.json();
}
```

---

## Part 4: Task-Based Routing (Auto Provider Selection)

The router already has smart provider selection based on task type.

### Available Task Types

```typescript
type AITaskType = 
  // Content
  | 'chat' | 'menu_description' | 'review_response' | 'translation'
  // Compliance  
  | 'haccp_analysis' | 'incident_report' | 'training_content'
  // Reviews
  | 'sentiment_analysis' | 'topic_extraction' | 'competitive_analysis'
  // Social
  | 'caption_generation' | 'script_writing' | 'hashtag_research'
  // Intelligence
  | 'insight_generation' | 'anomaly_detection' | 'recommendation'
  // General
  | 'research' | 'fact_check' | 'creative' | 'code' | 'cost_sensitive';
```

### Usage:

```typescript
// Router auto-selects best provider for task
const response = await aiRouter.completeForTask(
  {
    messages: [{ role: 'user', content: 'Analyze competitor reviews' }],
    tenantId: tenant.id
  },
  'competitive_analysis'  // → Routes to Perplexity (has web search)
);

// Cost-sensitive routes to local
const cheapResponse = await aiRouter.completeForTask(
  {
    messages: [{ role: 'user', content: 'Generate 50 product descriptions' }],
    tenantId: tenant.id
  },
  'cost_sensitive'  // → Routes to Ollama/LM Studio (free)
);
```

### Customize Task Routing

In `types.ts`, modify `TASK_PROVIDER_MAP`:

```typescript
export const TASK_PROVIDER_MAP: Record<AITaskType, AIProvider[]> = {
  // Change menu descriptions to prefer Mistral
  menu_description: ['mistral', 'claude', 'openai'],
  
  // Add new task
  seo_content: ['perplexity', 'openai', 'claude'],
  
  // Cost-sensitive uses local first
  cost_sensitive: ['ollama', 'lm_studio', 'gemini', 'openai'],
};
```

---

## Part 5: Local-First Strategy

### Enable Local Priority

In `.env`:

```bash
ENABLE_LOCAL_AI=true
LOCAL_AI_FIRST=true
LM_STUDIO_URL=http://host.docker.internal:1234/v1
OLLAMA_URL=http://host.docker.internal:11434
```

This sets local providers (Ollama, LM Studio) to priority 1.

### How It Works

1. Request comes in
2. Router sorts providers by priority
3. With `LOCAL_AI_FIRST=true`:
   - Ollama/LM Studio: priority 1 (tried first)
   - Cloud providers: priority 2-4 (fallback)
4. If local fails → automatic fallback to cloud

### Cost Savings

| Task Volume | Cloud Only | Local First | Savings |
|-------------|-----------|-------------|---------|
| 1,000/day | $3-5 | $0.30-0.50 | ~90% |
| 10,000/day | $30-50 | $3-5 | ~90% |

---

## Part 6: Quick Reference

### Add New Model (Existing Provider)
1. Update `types.ts` → `PROVIDER_MODELS.{provider}.models`
2. Add cost in `costPer1kTokens`
3. Use: `aiRouter.complete({ model: 'new-model' }, 'provider')`

### Add New Provider
1. Create `{provider}.provider.ts` extending `BaseAIProvider`
2. Update `types.ts` → `AIProvider` type, `PROVIDER_MODELS`
3. Register in `router.ts` → `initializeProviders()`
4. Add env var for API key
5. Update `createDefaultRouter()`

### Parallel Execution
```typescript
// Code
const result = await aiRouter.parallel(request, ['openai', 'claude']);

// n8n
POST /webhook/parallel-ai { prompt, providers: ['anthropic', 'openai'] }
```

### Task Routing
```typescript
await aiRouter.completeForTask(request, 'task_type');
```

### Check Provider Status
```typescript
const status = aiRouter.getAllStatus();
const health = await aiRouter.healthCheckAll();
```

---

## API Endpoints (Implemented!)

### POST /api/v1/ai/parallel
Execute on multiple providers with consensus analysis.

```bash
curl -X POST http://localhost:3000/api/v1/ai/parallel \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "prompt": "Should we add a vegan option to our menu?",
    "providers": ["openai", "claude", "gemini"],
    "temperature": 0.7,
    "maxTokens": 500
  }'
```

**Response:**
```json
{
  "success": true,
  "consensus": {
    "score": 0.73,
    "level": "high",
    "themes": ["vegan", "menu", "customer", "demand"],
    "recommendation": "Yes, adding a vegan option would..."
  },
  "responses": [
    { "provider": "openai", "model": "gpt-4o-mini", "content": "...", "tokens": 245, "timeMs": 1234 },
    { "provider": "claude", "model": "claude-3-5-sonnet", "content": "...", "tokens": 312, "timeMs": 1456 },
    { "provider": "gemini", "model": "gemini-1.5-flash", "content": "...", "tokens": 198, "timeMs": 890 }
  ],
  "errors": [],
  "metadata": {
    "providersQueried": ["openai", "claude", "gemini"],
    "successCount": 3,
    "failureCount": 0,
    "totalTokens": 755,
    "totalCostUsd": 0.0023,
    "totalTimeMs": 1456
  }
}
```

### POST /api/v1/ai/race
Return first successful response (speed over consensus).

```bash
curl -X POST http://localhost:3000/api/v1/ai/race \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "prompt": "Quick translation: Hello in Romanian",
    "providers": ["openai", "claude", "gemini"]
  }'
```

### GET /api/v1/ai/status
Check all provider health.

```bash
curl http://localhost:3000/api/v1/ai/status \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### GET /api/v1/ai/usage?days=30
Get AI usage stats for your tenant.

```bash
curl "http://localhost:3000/api/v1/ai/usage?days=30" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Environment Variables Summary

```bash
# Cloud Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_KEY=...
PERPLEXITY_API_KEY=pplx-...
MISTRAL_API_KEY=...          # If added

# Local Providers  
ENABLE_LOCAL_AI=true
LOCAL_AI_FIRST=true          # Prefer local over cloud
LM_STUDIO_URL=http://localhost:1234/v1
OLLAMA_URL=http://localhost:11434

# Router Config
DEFAULT_AI_PROVIDER=openai
AI_ENABLE_FALLBACK=true
```
