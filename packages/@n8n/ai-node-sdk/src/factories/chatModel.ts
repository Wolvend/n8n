/**
 * Factory function for creating chat models.
 * Returns LangChain-compatible objects that work with n8n's AI Agent.
 */

import { ChatOpenAI } from '@langchain/openai';

import { ChatModelAdapter } from '../adapters/chatModelAdapter';
import type { ChatModelOptions, FactoryContext } from '../types/chatModel';

/**
 * Create a chat model from the provided options.
 *
 * @param context - The n8n execution context (this from supplyData)
 * @param options - Chat model configuration options
 * @returns A LangChain-compatible chat model
 *
 * @example
 * // OpenAI-compatible model
 * const model = createChatModel(this, {
 *   type: 'openaiCompatible',
 *   apiKey: credentials.apiKey,
 *   model: 'gpt-4',
 * });
 *
 * @example
 * // Custom model with generate/stream functions
 * const model = createChatModel(this, {
 *   type: 'custom',
 *   name: 'my-model',
 *   generate: async (messages, config) => {
 *     const response = await fetch(...);
 *     return { text: response.content, finishReason: 'stop' };
 *   },
 * });
 */
export function createChatModel(_context: FactoryContext, options: ChatModelOptions): unknown {
	if (options.type === 'openaiCompatible') {
		// Build configuration object
		const configuration: Record<string, unknown> = {
			baseURL: options.baseUrl,
			defaultHeaders: options.headers,
			...options.clientOptions,
		};

		// Use LangChain's ChatOpenAI for OpenAI-compatible APIs
		const model = new ChatOpenAI({
			openAIApiKey: options.apiKey,
			modelName: options.model,
			temperature: options.temperature,
			maxTokens: options.maxTokens,
			topP: options.topP,
			frequencyPenalty: options.frequencyPenalty,
			presencePenalty: options.presencePenalty,
			stop: options.stopSequences,
			timeout: options.timeout,
			maxRetries: options.maxRetries,
			configuration,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			callbacks: options.callbacks as any,
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			onFailedAttempt: options.onFailedAttempt as any,
		});

		return model;
	}

	if (options.type === 'custom') {
		// Use our adapter for custom implementations
		const adapter = new ChatModelAdapter(options);
		return adapter;
	}

	throw new Error(`Unknown chat model type: ${(options as { type: string }).type}`);
}
