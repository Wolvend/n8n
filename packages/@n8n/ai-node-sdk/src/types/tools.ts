import type { ZodTypeAny } from 'zod';

/**
 * JSON Schema type for tool parameters
 */
export interface JSONSchema {
	type?: string;
	properties?: Record<string, JSONSchema>;
	items?: JSONSchema;
	required?: string[];
	description?: string;
	enum?: unknown[];
	default?: unknown;
	[key: string]: unknown;
}

/**
 * Tool definition for function calling
 */
export interface Tool {
	name: string;
	description?: string;
	/** JSON Schema or Zod schema for parameters */
	parameters: JSONSchema | ZodTypeAny;
	/** If true, model must follow schema strictly */
	strict?: boolean;
	/** Optional execution function for automatic tool handling */
	execute?: (args: Record<string, unknown>) => Promise<unknown>;
}

/**
 * Tool call made by the model
 */
export interface ToolCall {
	id: string;
	name: string;
	arguments: Record<string, unknown>;
	argumentsRaw?: string;
}

/**
 * Tool choice configuration
 */
export type ToolChoice =
	| 'auto' // Model decides whether to call tools
	| 'required' // Model must call at least one tool
	| 'none' // Model must not call any tools
	| { type: 'tool'; toolName: string }; // Force call of specific tool
