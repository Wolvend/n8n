/**
 * Factory function for creating memory instances.
 * Returns LangChain-compatible memory objects that work with n8n's AI Agent.
 */

import { BufferMemory, BufferWindowMemory } from '@langchain/classic/memory';

import { ChatHistoryAdapter } from '../adapters/chatHistoryAdapter';
import type { MemoryOptions, FactoryContext } from '../types';

/**
 * Create a memory instance from the provided options.
 *
 * @param context - The n8n execution context (this from supplyData)
 * @param options - Memory configuration options
 * @returns A LangChain-compatible memory instance
 *
 * @example
 * // Buffer window memory with custom chat history
 * const memory = createMemory(this, {
 *   type: 'bufferWindow',
 *   chatHistory: new MyChatHistory(connectionString),
 *   k: 10,
 * });
 */
export function createMemory(context: FactoryContext, options: MemoryOptions): unknown {
	// Wrap the SDK ChatHistory in a LangChain adapter
	const chatHistory = new ChatHistoryAdapter(options.chatHistory);

	const baseConfig = {
		chatHistory,
		memoryKey: options.memoryKey ?? 'chat_history',
		inputKey: options.inputKey ?? 'input',
		outputKey: options.outputKey ?? 'output',
		returnMessages: options.returnMessages ?? true,
		humanPrefix: options.humanPrefix ?? 'Human',
		aiPrefix: options.aiPrefix ?? 'AI',
	};

	switch (options.type) {
		case 'buffer':
			return new BufferMemory(baseConfig);

		case 'bufferWindow':
			return new BufferWindowMemory({
				...baseConfig,
				k: options.k,
			});

		case 'tokenBuffer':
			// TokenBufferMemory requires an LLM for token counting
			// For now, use BufferMemory as fallback
			// TODO: Implement proper TokenBufferMemory support
			console.warn('TokenBufferMemory not yet fully supported, using BufferMemory');
			return new BufferMemory(baseConfig);

		default:
			throw new Error(`Unknown memory type: ${(options as { type: string }).type}`);
	}
}
