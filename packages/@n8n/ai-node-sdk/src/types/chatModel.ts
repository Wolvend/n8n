import type { ISupplyDataFunctions } from 'n8n-workflow';

import type { Message } from './messages';
import type { GenerateResult, StreamChunk } from './results';
import type { Tool, ToolChoice } from './tools';

/**
 * Configuration options for chat model generation
 */
export interface ChatModelConfig {
	maxTokens?: number;
	temperature?: number;
	topP?: number;
	topK?: number;
	presencePenalty?: number;
	frequencyPenalty?: number;
	stopSequences?: string[];
	seed?: number;
	timeout?: number;
	maxRetries?: number;
	abortSignal?: AbortSignal;
	headers?: Record<string, string>;
	tools?: Tool[];
	toolChoice?: ToolChoice;
	/** Provider-specific options */
	providerOptions?: Record<string, unknown>;
}

/**
 * Options for createChatModel factory - discriminated union
 */
export type ChatModelOptions = OpenAICompatibleModelOptions | CustomChatModelOptions;

/**
 * For models implementing the OpenAI API spec.
 * Covers: OpenAI, Azure OpenAI, Ollama, LM Studio, vLLM, Together AI, etc.
 */
export interface OpenAICompatibleModelOptions {
	type: 'openaiCompatible';

	// Required
	apiKey: string;
	model: string;

	// Optional - defaults to OpenAI
	baseUrl?: string;

	// Common parameters
	temperature?: number;
	maxTokens?: number;
	topP?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
	stopSequences?: string[];

	// Advanced
	timeout?: number;
	maxRetries?: number;
	headers?: Record<string, string>;

	// LangChain-specific options (for advanced internal use)
	/** LangChain callbacks for tracing/logging */
	callbacks?: unknown[];
	/** Error handler for failed attempts */
	onFailedAttempt?: (error: unknown) => Promise<void>;
	/** Additional configuration passed to the underlying client */
	clientOptions?: Record<string, unknown>;
}

/**
 * For models with non-OpenAI APIs.
 * Implement generate() and optionally stream() for full control.
 */
export interface CustomChatModelOptions {
	type: 'custom';

	/** Model identifier for logging/display */
	name: string;

	/** Required: generate a response from messages */
	generate: (messages: Message[], config?: ChatModelConfig) => Promise<GenerateResult>;

	/** Optional: streaming support for real-time token display */
	stream?: (messages: Message[], config?: ChatModelConfig) => AsyncIterable<StreamChunk>;

	/** Optional: bind tools for function calling */
	withTools?: (tools: Tool[]) => CustomChatModelOptions;
}

/**
 * Context required for factory functions
 */
export type FactoryContext = ISupplyDataFunctions;
