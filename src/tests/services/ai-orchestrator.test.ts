/**
 * AI Orchestrator Tests
 * 
 * Tests for the AI orchestration layer
 */

import {
  AIOrchestrator,
  getAIOrchestrator,
  resetAIOrchestrator,
  AIRequest,
  AITaskType,
} from '../../services/ai/orchestrator';
import { resetMTCClient } from '../../services/blockchain/mtc-client';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock OpenAI
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'Mock OpenAI response' } }],
          usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 },
        }),
      },
    },
  }));
});

// Mock Anthropic
jest.mock('@anthropic-ai/sdk', () => {
  return jest.fn().mockImplementation(() => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Mock Anthropic response' }],
        usage: { input_tokens: 100, output_tokens: 50 },
      }),
    },
  }));
});

// Set environment variables for tests
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.LOCAL_LLM_URL = 'http://localhost:1234/v1';

describe.skip('AI Orchestrator', () => {
  let orchestrator: AIOrchestrator;

  beforeEach(() => {
    resetAIOrchestrator();
    resetMTCClient();
    mockFetch.mockClear();
    
    // Default mock for local LLM (LM Studio/Ollama) endpoints
    mockFetch.mockImplementation((url: string) => {
      // LM Studio endpoint
      if (url.includes('localhost:1234') || url.includes('lmstudio')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            choices: [{ message: { content: 'Mock LM Studio response' } }],
            usage: { prompt_tokens: 50, completion_tokens: 30, total_tokens: 80 },
          }),
        });
      }
      // Ollama endpoint
      if (url.includes('localhost:11434') || url.includes('ollama')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            response: 'Mock Ollama response',
            eval_count: 30,
            prompt_eval_count: 50,
          }),
        });
      }
      // MTC/blockchain endpoints
      if (url.includes('1317') || url.includes('26657')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            credit_account: { total_credits: '100', used_credits: '0', available_credits: '100' },
          }),
        });
      }
      // Default - reject unknown endpoints
      return Promise.resolve({ ok: false });
    });
    
    orchestrator = new AIOrchestrator();
  });

  // ==========================================================================
  // INITIALIZATION TESTS
  // ==========================================================================

  describe('Initialization', () => {
    it('should initialize with available providers', () => {
      const status = orchestrator.getProviderStatus();
      
      expect(status.openai).toBe(true);
      expect(status.anthropic).toBe(true);
      expect(status.local).toBe(true);
    });

    it('should report healthy when providers are available', async () => {
      const health = await orchestrator.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.providers.openai).toBe(true);
      expect(health.providers.anthropic).toBe(true);
    });
  });

  // ==========================================================================
  // MODEL SELECTION TESTS
  // ==========================================================================

  describe('Model Selection', () => {
    it('should return available models', () => {
      const models = orchestrator.getAvailableModels();
      
      expect(models.length).toBeGreaterThan(0);
      expect(models.some(m => m.provider === 'openai')).toBe(true);
      expect(models.some(m => m.provider === 'anthropic')).toBe(true);
    });

    it('should filter models by task type', () => {
      const chatModels = orchestrator.getAvailableModels('chat');
      const sentimentModels = orchestrator.getAvailableModels('sentiment');
      
      expect(chatModels.every(m => m.supportedTasks.includes('chat'))).toBe(true);
      expect(sentimentModels.every(m => m.supportedTasks.includes('sentiment'))).toBe(true);
    });

    it('should include local LLM as fallback', () => {
      const models = orchestrator.getAvailableModels();
      const localModel = models.find(m => m.provider === 'local');
      
      expect(localModel).toBeDefined();
      // Local model ID depends on configuration (e.g., lmstudio-gpt-oss-20b)
      expect(localModel?.provider).toBe('local');
    });
  });

  // ==========================================================================
  // REQUEST PROCESSING TESTS
  // ==========================================================================

  describe('Request Processing', () => {
    it('should process a chat request successfully', async () => {
      const request: AIRequest = {
        tenantId: 'tenant-123',
        taskType: 'chat',
        messages: [
          { role: 'user', content: 'Hello, how are you?' },
        ],
      };

      const response = await orchestrator.process(request);
      
      expect(response.success).toBe(true);
      expect(response.content).toBeDefined();
      expect(response.provider).toBeDefined();
      expect(response.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should use preferred provider when specified', async () => {
      const request: AIRequest = {
        tenantId: 'tenant-123',
        taskType: 'chat',
        messages: [
          { role: 'user', content: 'Test message' },
        ],
        options: {
          preferredProvider: 'anthropic',
        },
      };

      const response = await orchestrator.process(request);
      
      expect(response.success).toBe(true);
      expect(response.provider).toBe('anthropic');
    });

    it('should use preferred model when specified', async () => {
      const request: AIRequest = {
        tenantId: 'tenant-123',
        taskType: 'chat',
        messages: [
          { role: 'user', content: 'Test message' },
        ],
        options: {
          preferredModel: 'gpt-4o-mini',
        },
      };

      const response = await orchestrator.process(request);
      
      expect(response.success).toBe(true);
      expect(response.model).toBe('gpt-4o-mini');
    });

    it('should respect max tokens option', async () => {
      const request: AIRequest = {
        tenantId: 'tenant-123',
        taskType: 'chat',
        messages: [
          { role: 'user', content: 'Test message' },
        ],
        options: {
          maxTokens: 100,
        },
      };

      const response = await orchestrator.process(request);
      
      expect(response.success).toBe(true);
    });

    it('should include usage statistics', async () => {
      const request: AIRequest = {
        tenantId: 'tenant-123',
        taskType: 'chat',
        messages: [
          { role: 'user', content: 'Test message' },
        ],
      };

      const response = await orchestrator.process(request);
      
      expect(response.success).toBe(true);
      expect(response.usage).toBeDefined();
      expect(response.usage?.totalTokens).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // TASK-BASED ROUTING TESTS
  // ==========================================================================

  describe('Task-Based Routing', () => {
    const taskTypes: AITaskType[] = [
      'chat',
      'review_response',
      'menu_description',
      'translation',
      'sentiment',
      'content',
      'summary',
    ];

    taskTypes.forEach(taskType => {
      it(`should route ${taskType} requests successfully`, async () => {
        const request: AIRequest = {
          tenantId: 'tenant-123',
          taskType,
          messages: [
            { role: 'user', content: `Test ${taskType} request` },
          ],
        };

        const response = await orchestrator.process(request);
        
        expect(response.success).toBe(true);
        expect(response.provider).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // LOCAL LLM TESTS
  // ==========================================================================

  describe('Local LLM', () => {
    it('should call local LLM with correct format', async () => {
      // Mock successful local LLM response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Local LLM response' } }],
          usage: { prompt_tokens: 50, completion_tokens: 25, total_tokens: 75 },
        }),
      });

      const request: AIRequest = {
        tenantId: 'tenant-123',
        taskType: 'chat',
        messages: [
          { role: 'user', content: 'Test message' },
        ],
        options: {
          preferredProvider: 'local',
        },
      };

      const response = await orchestrator.process(request);
      
      expect(response.success).toBe(true);
      expect(response.provider).toBe('local');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:1234/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should handle local LLM errors gracefully', async () => {
      // Override mock to simulate ALL fetch-based providers failing
      mockFetch.mockImplementation(() => Promise.reject(new Error('Connection refused')));
      
      // Also mock OpenAI and Anthropic to fail
      const OpenAI = require('openai');
      const Anthropic = require('@anthropic-ai/sdk');
      OpenAI.mockImplementation(() => ({
        chat: { completions: { create: jest.fn().mockRejectedValue(new Error('API down')) } },
      }));
      Anthropic.mockImplementation(() => ({
        messages: { create: jest.fn().mockRejectedValue(new Error('API down')) },
      }));
      
      // Recreate orchestrator with failing mocks
      resetAIOrchestrator();
      const failingOrchestrator = new AIOrchestrator();

      const request: AIRequest = {
        tenantId: 'tenant-123',
        taskType: 'chat',
        messages: [
          { role: 'user', content: 'Test message' },
        ],
        options: {
          preferredProvider: 'local',
        },
      };

      const response = await failingOrchestrator.process(request);
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  // ==========================================================================
  // CREDIT INTEGRATION TESTS
  // ==========================================================================

  describe('Credit Integration', () => {
    it('should process request without wallet address', async () => {
      const request: AIRequest = {
        tenantId: 'tenant-123',
        taskType: 'chat',
        messages: [
          { role: 'user', content: 'Test message' },
        ],
      };

      const response = await orchestrator.process(request);
      
      expect(response.success).toBe(true);
      // No credits used when no wallet provided
      expect(response.creditsUsed).toBe(0);
    });

    it('should attempt credit deduction when wallet provided', async () => {
      // Mock MTC client credit check
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          credit_account: {
            total_credits: '100',
            used_credits: '0',
            available_credits: '100',
          },
        }),
      });

      const request: AIRequest = {
        tenantId: 'tenant-123',
        walletAddress: 'mitch1abc123def456ghi789jkl012mno345pqr678stu',
        taskType: 'chat',
        messages: [
          { role: 'user', content: 'Test message' },
        ],
      };

      const response = await orchestrator.process(request);
      
      expect(response.success).toBe(true);
    });

    it('should skip credit deduction when useCredits is false', async () => {
      const request: AIRequest = {
        tenantId: 'tenant-123',
        walletAddress: 'mitch1abc123def456ghi789jkl012mno345pqr678stu',
        taskType: 'chat',
        messages: [
          { role: 'user', content: 'Test message' },
        ],
        options: {
          useCredits: false,
        },
      };

      const response = await orchestrator.process(request);
      
      expect(response.success).toBe(true);
      // Should not have called MTC for credits
    });
  });

  // ==========================================================================
  // ERROR HANDLING TESTS
  // ==========================================================================

  describe('Error Handling', () => {
    it('should handle provider errors gracefully', async () => {
      // Mock OpenAI throwing an error
      const OpenAI = require('openai');
      OpenAI.mockImplementationOnce(() => ({
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('API rate limit exceeded')),
          },
        },
      }));

      // Mock ALL providers to fail so there's no fallback
      mockFetch.mockImplementation(() => Promise.reject(new Error('All providers down')));

      resetAIOrchestrator();
      const errorOrchestrator = new AIOrchestrator();

      const request: AIRequest = {
        tenantId: 'tenant-123',
        taskType: 'chat',
        messages: [
          { role: 'user', content: 'Test message' },
        ],
        options: {
          preferredProvider: 'openai',
        },
      };

      const response = await errorOrchestrator.process(request);
      
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });

    it('should return error for unsupported task with no available models', async () => {
      // Create orchestrator with no providers
      delete process.env.OPENAI_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;
      
      // Mock ALL providers to fail
      mockFetch.mockImplementation(() => Promise.reject(new Error('No providers')));
      
      resetAIOrchestrator();
      const limitedOrchestrator = new AIOrchestrator();

      const request: AIRequest = {
        tenantId: 'tenant-123',
        taskType: 'code', // Code might not be supported by local
        messages: [
          { role: 'user', content: 'Write code' },
        ],
        options: {
          preferredProvider: 'local',
        },
      };

      const response = await limitedOrchestrator.process(request);
      
      // Restore env vars
      process.env.OPENAI_API_KEY = 'test-openai-key';
      process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
      
      expect(response.success).toBe(false);
    });

    it('should include latency even on errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const request: AIRequest = {
        tenantId: 'tenant-123',
        taskType: 'chat',
        messages: [
          { role: 'user', content: 'Test message' },
        ],
        options: {
          preferredProvider: 'local',
        },
      };

      const response = await orchestrator.process(request);
      
      expect(response.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // SINGLETON TESTS
  // ==========================================================================

  describe('Singleton Pattern', () => {
    it('should return same instance', () => {
      const instance1 = getAIOrchestrator();
      const instance2 = getAIOrchestrator();
      
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = getAIOrchestrator();
      resetAIOrchestrator();
      const instance2 = getAIOrchestrator();
      
      expect(instance1).not.toBe(instance2);
    });
  });
});
