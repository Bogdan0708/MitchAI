/**
 * Perplexity Provider
 *
 * Integration with Perplexity AI models (Sonar series with online search)
 * Great for real-time information and research queries
 */

import { BaseAIProvider } from './base.provider';
import {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIProviderConfig
} from './types';


interface PerplexityResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  citations?: string[];
}

export class PerplexityProvider extends BaseAIProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: AIProviderConfig) {
    super(config);

    this.apiKey = config.apiKey || process.env.PERPLEXITY_API_KEY || '';
    this.baseUrl = config.baseUrl || 'https://api.perplexity.ai';
  }

  get name(): AIProvider {
    return 'perplexity';
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const model = this.getModel(request);
    const temperature = this.getTemperature(request);
    const maxTokens = this.getMaxTokens(request);

    try {
      const { result, latencyMs } = await this.measureLatency(async () => {
        return await this.withRetry(async () => {
          const response = await fetch(`${this.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
              model,
              messages: request.messages.map((m) => ({
                role: m.role,
                content: m.content
              })),
              max_tokens: maxTokens,
              temperature,
              top_p: request.topP
            })
          });

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`Perplexity API error: ${response.status} - ${error}`);
          }

          return (await response.json()) as PerplexityResponse;
        });
      });

      const choice = result.choices[0];

      return {
        content: choice.message.content,
        provider: this.name,
        model,
        usage: {
          inputTokens: result.usage.prompt_tokens,
          outputTokens: result.usage.completion_tokens,
          totalTokens: result.usage.total_tokens
        },
        responseTimeMs: latencyMs,
        finishReason: this.mapFinishReason(choice.finish_reason),
        metadata: {
          citations: result.citations
        }
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
    const model = this.getModel(request);
    const temperature = this.getTemperature(request);
    const maxTokens = this.getMaxTokens(request);
    const startTime = Date.now();

    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content
          })),
          max_tokens: maxTokens,
          temperature,
          stream: true
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Perplexity API error: ${response.status} - ${error}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || '';
              if (content) {
                fullContent += content;
                onChunk(content);
              }

              // Update usage from final chunk
              if (parsed.usage) {
                inputTokens = parsed.usage.prompt_tokens;
                outputTokens = parsed.usage.completion_tokens;
              }
            } catch {
              // Ignore parse errors for partial chunks
            }
          }
        }
      }

      // Estimate tokens if not provided
      if (!inputTokens) {
        inputTokens = this.estimateTokens(
          request.messages.map((m) => m.content).join(' ')
        );
      }
      if (!outputTokens) {
        outputTokens = this.estimateTokens(fullContent);
      }

      const latencyMs = Date.now() - startTime;
      this.lastLatency = latencyMs;

      return {
        content: fullContent,
        provider: this.name,
        model,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens
        },
        responseTimeMs: latencyMs,
        finishReason: 'stop'
      };
    } catch (error) {
      this.markUnavailable((error as Error).message);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const { latencyMs } = await this.measureLatency(async () => {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`
          },
          body: JSON.stringify({
            model: 'sonar',
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 5
          })
        });

        if (!response.ok) {
          throw new Error(`Health check failed: ${response.status}`);
        }
      });

      this.isAvailable = true;
      this.lastLatency = latencyMs;
      return true;
    } catch (error) {
      this.markUnavailable((error as Error).message);
      return false;
    }
  }

  /**
   * Perplexity-specific: Search with citations
   * Useful for research and fact-checking
   */
  async searchWithCitations(query: string): Promise<{
    answer: string;
    citations: string[];
  }> {
    const response = await this.complete({
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful research assistant. Provide accurate information with citations.'
        },
        {
          role: 'user',
          content: query
        }
      ],
      model: 'sonar-pro' // Use larger model for research
    });

    return {
      answer: response.content,
      citations: (response.metadata?.citations as string[]) || []
    };
  }

  private mapFinishReason(
    reason: string
  ): 'stop' | 'length' | 'error' | 'content_filter' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      default:
        return 'stop';
    }
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
