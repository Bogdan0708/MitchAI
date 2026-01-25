/**
 * Google Gemini Provider
 *
 * Integration with Google Gemini models (Gemini 1.5 Flash, Pro, etc.)
 */

import { BaseAIProvider } from './base.provider';
import {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIProviderConfig
} from './types';

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
      role: string;
    };
    finishReason: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export class GeminiProvider extends BaseAIProvider {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: AIProviderConfig) {
    super(config);

    this.apiKey = config.apiKey || process.env.GOOGLE_AI_KEY || '';
    this.baseUrl = config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  }

  get name(): AIProvider {
    return 'gemini';
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const model = this.getModel(request);
    const temperature = this.getTemperature(request);
    const maxTokens = this.getMaxTokens(request);

    try {
      const { result, latencyMs } = await this.measureLatency(async () => {
        return await this.withRetry(async () => {
          // Convert messages to Gemini format
          const contents = this.convertMessages(request.messages);

          const response = await fetch(
            `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                contents,
                generationConfig: {
                  temperature,
                  maxOutputTokens: maxTokens,
                  topP: request.topP
                }
              })
            }
          );

          if (!response.ok) {
            const error = await response.text();
            throw new Error(`Gemini API error: ${response.status} - ${error}`);
          }

          return (await response.json()) as GeminiResponse;
        });
      });

      const candidate = result.candidates?.[0];
      const content = candidate?.content?.parts?.map(p => p.text).join('') || '';
      const usage = result.usageMetadata || { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 };

      return {
        content,
        provider: this.name,
        model,
        usage: {
          inputTokens: usage.promptTokenCount,
          outputTokens: usage.candidatesTokenCount,
          totalTokens: usage.totalTokenCount
        },
        responseTimeMs: latencyMs,
        finishReason: this.mapFinishReason(candidate?.finishReason)
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
      const contents = this.convertMessages(request.messages);

      const response = await fetch(
        `${this.baseUrl}/models/${model}:streamGenerateContent?key=${this.apiKey}&alt=sse`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature,
              maxOutputTokens: maxTokens
            }
          })
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
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
              const parsed = JSON.parse(data) as GeminiResponse;
              const content = parsed.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
              if (content) {
                fullContent += content;
                onChunk(content);
              }

              if (parsed.usageMetadata) {
                inputTokens = parsed.usageMetadata.promptTokenCount;
                outputTokens = parsed.usageMetadata.candidatesTokenCount;
              }
            } catch {
              // Ignore parse errors for partial chunks
            }
          }
        }
      }

      // Estimate tokens if not provided
      if (!inputTokens) {
        inputTokens = this.estimateTokens(request.messages.map(m => m.content).join(' '));
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
        const response = await fetch(
          `${this.baseUrl}/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'test' }] }],
              generationConfig: { maxOutputTokens: 5 }
            })
          }
        );

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

  private convertMessages(messages: AICompletionRequest['messages']): Array<{
    role: string;
    parts: Array<{ text: string }>;
  }> {
    // Gemini uses 'user' and 'model' roles, and system prompts are handled differently
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

    let systemPrompt = '';

    for (const msg of messages) {
      if (msg.role === 'system') {
        // Prepend system prompt to the first user message
        systemPrompt = msg.content + '\n\n';
      } else if (msg.role === 'user') {
        contents.push({
          role: 'user',
          parts: [{ text: systemPrompt + msg.content }]
        });
        systemPrompt = ''; // Clear after first use
      } else if (msg.role === 'assistant') {
        contents.push({
          role: 'model',
          parts: [{ text: msg.content }]
        });
      }
    }

    return contents;
  }

  private mapFinishReason(
    reason: string | undefined
  ): 'stop' | 'length' | 'error' | 'content_filter' {
    switch (reason) {
      case 'STOP':
        return 'stop';
      case 'MAX_TOKENS':
        return 'length';
      case 'SAFETY':
        return 'content_filter';
      default:
        return 'stop';
    }
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
