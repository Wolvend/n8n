/**
 * Message types for the AI Node SDK.
 * These types are provider-agnostic and handle all content types.
 */

export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/**
 * Content block types - each message contains one content block.
 * Multi-block responses (e.g., text + tool call) become multiple Message objects.
 */
export type ContentBlock =
	| TextContent
	| ReasoningContent
	| FileContent
	| ToolCallContent
	| ToolResultContent;

export interface TextContent {
	type: 'text';
	text: string;
	metadata?: Record<string, unknown>;
}

export interface ReasoningContent {
	type: 'reasoning';
	text: string;
	metadata?: Record<string, unknown>;
}

export interface FileContent {
	type: 'file';
	/** IANA media type, e.g. 'image/png', 'audio/mp3' */
	mediaType: string;
	/** Base64 string or binary data */
	data: string | Uint8Array;
	metadata?: Record<string, unknown>;
}

export interface ToolCallContent {
	type: 'tool-call';
	toolCallId: string;
	toolName: string;
	/** Stringified JSON arguments */
	input: string;
	metadata?: Record<string, unknown>;
}

export interface ToolResultContent {
	type: 'tool-result';
	toolCallId: string;
	result: unknown;
	isError?: boolean;
	metadata?: Record<string, unknown>;
}

export interface Message {
	role: MessageRole;
	content: ContentBlock;
	name?: string;
}

/**
 * Helper to create a text message
 */
export function textMessage(role: MessageRole, text: string): Message {
	return { role, content: { type: 'text', text } };
}

/**
 * Helper to create a tool result message
 */
export function toolResultMessage(toolCallId: string, result: unknown, isError = false): Message {
	return {
		role: 'tool',
		content: { type: 'tool-result', toolCallId, result, isError },
	};
}
