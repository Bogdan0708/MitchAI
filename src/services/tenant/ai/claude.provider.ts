/**
 * Claude/Anthropic Provider
 *
 * Integration with Anthropic Claude models (Claude 3.5 Sonnet, Haiku, Opus)
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseAIProvider } from './base.provider';
import {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIProviderConfig,
  AIMessage
} from './types';

export class ClaudeProvider extends BaseAIProvider {
  private client: Anthropic;

  constructor(config: AIProviderConfig) {
    super(config);

    this.client = new Anthropic({
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY
    });
  }

  get name(): AIProvider {
    return 'claude';
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const model = this.getModel(request);
    const temperature = this.getTemperature(request);
    const maxTokens = this.getMaxTokens(request);

    // Extract system message and user/assistant messages
    const { systemPrompt, messages } = this.extractSystemMessage(request.messages);

    try {
      const { result, latencyMs } = await this.measureLatency(async () => {
        return await this.withRetry(async () => {
          return await this.client.messages.create({
            model,
            max_tokens: maxTokens,
            temperature,
            system: systemPrompt,
            messages: messages.map((m) => ({
              role: m.role as 'user' | 'assistant',
              content: m.content
            }))
          });
        });
      });

      const content =
        result.content[0].type === 'text' ? result.content[0].text : '';

      return {
        content,
        provider: this.name,
        model,
        usage: {
          inputTokens: result.usage.input_tokens,
          outputTokens: result.usage.output_tokens,
          totalTokens: result.usage.input_tokens + result.usage.output_tokens
        },
        responseTimeMs: latencyMs,
        finishReason: this.mapStopReason(result.stop_reason)
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

    const { systemPrompt, messages } = this.extractSystemMessage(request.messages);

    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const stream = await this.client.messages.stream({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: messages.map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }))
      });

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          const content = event.delta.text;
          fullContent += content;
          onChunk(content);
        }

        if (event.type === 'message_delta' && event.usage) {
          outputTokens = event.usage.output_tokens;
        }
      }

      // Get final message for complete usage stats
      const finalMessage = await stream.finalMessage();
      inputTokens = finalMessage.usage.input_tokens;
      outputTokens = finalMessage.usage.output_tokens;

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
        await this.client.messages.create({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'test' }]
        });
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
   * Claude requires system message to be separate from conversation
   */
  private extractSystemMessage(messages: AIMessage[]): {
    systemPrompt: string;
    messages: AIMessage[];
  } {
    const systemMessages = messages.filter((m) => m.role === 'system');
    const conversationMessages = messages.filter((m) => m.role !== 'system');

    // Ensure conversation starts with user message
    if (conversationMessages[0]?.role !== 'user') {
      conversationMessages.unshift({
        role: 'user',
        content: 'Hello'
      });
    }

    return {
      systemPrompt: systemMessages.map((m) => m.content).join('\n\n'),
      messages: conversationMessages
    };
  }

  private mapStopReason(
    reason: string | null
  ): 'stop' | 'length' | 'error' | 'content_filter' {
    switch (reason) {
      case 'end_turn':
      case 'stop_sequence':
        return 'stop';
      case 'max_tokens':
        return 'length';
      default:
        return 'stop';
    }
  }
}
