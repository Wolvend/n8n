import type { ToolCall } from './tools';

/**
 * Result from a chat model generation
 */
export interface GenerateResult {
	/** Provider-specific response ID */
	id?: string;
	/** Generated text content */
	text: string;
	/** Why generation stopped */
	finishReason?: 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other';
	/** Token usage for monitoring/billing */
	usage?: TokenUsage;
	/** Tool calls made by the model */
	toolCalls?: ToolCall[];
	/** Raw provider response for debugging */
	rawResponse?: unknown;
}

/**
 * Token usage statistics
 */
export interface TokenUsage {
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
}

/**
 * Streaming chunk from a chat model
 */
export interface StreamChunk {
	type: 'text-delta' | 'tool-call-delta' | 'finish' | 'error';
	/** Text fragment for streaming display */
	textDelta?: string;
	/** Partial tool call for progressive assembly */
	toolCallDelta?: {
		id?: string;
		name?: string;
		argumentsDelta?: string;
	};
	finishReason?: string;
	usage?: TokenUsage;
	error?: unknown;
}
