/**
 * Ollama Provider
 *
 * Integration with Ollama local server
 * Zero cost, runs locally, supports many open-source models
 */

import { BaseAIProvider } from './base.provider';
import {
  AIProvider,
  AICompletionRequest,
  AICompletionResponse,
  AIProviderConfig
} from './types';


interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
  digest: string;
}

export class OllamaProvider extends BaseAIProvider {
  private baseUrl: string;

  constructor(config: AIProviderConfig) {
    super(config);

    // Default Ollama server URL
    this.baseUrl = config.baseUrl || process.env.OLLAMA_URL || 'http://localhost:11434';
  }

  get name(): AIProvider {
    return 'ollama';
  }

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const model = this.getModel(request);
    const temperature = this.getTemperature(request);
    const maxTokens = this.getMaxTokens(request);

    try {
      const { result, latencyMs } = await this.measureLatency(async () => {
        const response = await fetch(`${this.baseUrl}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model,
            messages: request.messages.map((m) => ({
              role: m.role,
              content: m.content
            })),
            options: {
              temperature,
              num_predict: maxTokens,
              top_p: request.topP
            },
            stream: false
          })
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Ollama error: ${response.status} - ${error}`);
        }

        return (await response.json()) as OllamaChatResponse;
      });

      // Calculate tokens from response metrics or estimate
      const inputTokens = result.prompt_eval_count || this.estimateTokens(
        request.messages.map((m) => m.content).join(' ')
      );
      const outputTokens = result.eval_count || this.estimateTokens(result.message.content);

      return {
        content: result.message.content,
        provider: this.name,
        model: result.model,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens: inputTokens + outputTokens
        },
        responseTimeMs: latencyMs,
        finishReason: result.done ? 'stop' : 'length'
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
    let actualModel = model;

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content
          })),
          options: {
            temperature,
            num_predict: maxTokens
          },
          stream: true
        })
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama error: ${response.status} - ${error}`);
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
          if (!line.trim()) continue;

          try {
            const parsed = JSON.parse(line) as OllamaChatResponse;

            if (parsed.message?.content) {
              fullContent += parsed.message.content;
              onChunk(parsed.message.content);
            }

            if (parsed.model) {
              actualModel = parsed.model;
            }

            // Get final token counts
            if (parsed.done) {
              inputTokens = parsed.prompt_eval_count || 0;
              outputTokens = parsed.eval_count || 0;
            }
          } catch {
            // Ignore parse errors
          }
        }
      }

      const latencyMs = Date.now() - startTime;
      this.lastLatency = latencyMs;

      // Estimate if not provided
      if (!inputTokens) {
        inputTokens = this.estimateTokens(
          request.messages.map((m) => m.content).join(' ')
        );
      }
      if (!outputTokens) {
        outputTokens = this.estimateTokens(fullContent);
      }

      return {
        content: fullContent,
        provider: this.name,
        model: actualModel,
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
        const response = await fetch(`${this.baseUrl}/api/tags`);
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
   * Get list of available models in Ollama
   */
  async getAvailableModels(): Promise<OllamaModel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        return [];
      }

      const data = await response.json() as { models?: OllamaModel[] };
      return data.models || [];
    } catch {
      return [];
    }
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(modelName: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: modelName })
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model: ${response.status}`);
    }

    // Stream pull progress
    const reader = response.body?.getReader();
    if (reader) {
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        console.log(decoder.decode(value));
      }
    }
  }

  /**
   * Check if a specific model is available
   */
  async isModelAvailable(modelName: string): Promise<boolean> {
    const models = await this.getAvailableModels();
    return models.some((m) => m.name === modelName || m.name.startsWith(modelName));
  }

  /**
   * Generate embeddings (useful for RAG)
   */
  async generateEmbeddings(text: string, model: string = 'nomic-embed-text'): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/api/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        prompt: text
      })
    });

    if (!response.ok) {
      throw new Error(`Embeddings failed: ${response.status}`);
    }

    const data = await response.json() as { embedding: number[] };
    return data.embedding;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
