/**
 * @n8n/ai-node-sdk
 *
 * SDK for building AI community nodes for n8n.
 * Provides a stable, LangChain-agnostic API for creating chat models, memory, and more.
 */

// Factory functions
export { createChatModel } from './factories/chatModel';
export { createMemory } from './factories/memory';

// Types - Messages
export type {
	Message,
	MessageRole,
	ContentBlock,
	TextContent,
	ReasoningContent,
	FileContent,
	ToolCallContent,
	ToolResultContent,
} from './types/messages';
export { textMessage, toolResultMessage } from './types/messages';

// Types - Tools
export type { Tool, ToolCall, ToolChoice, JSONSchema } from './types/tools';

// Types - Results
export type { GenerateResult, StreamChunk, TokenUsage } from './types/results';

// Types - Chat Model
export type {
	ChatModelOptions,
	ChatModelConfig,
	OpenAICompatibleModelOptions,
	CustomChatModelOptions,
	FactoryContext,
} from './types/chatModel';

// Types - Memory
export type {
	ChatHistory,
	MemoryOptions,
	BufferMemoryOptions,
	BufferWindowMemoryOptions,
	TokenBufferMemoryOptions,
} from './types/memory';

// Utility functions
export {
	toOpenAITool,
	toAnthropicTool,
	toProviderToolChoice,
	zodToJsonSchema,
	parseToolArguments,
} from './utils/toolConversion';
