import { zodToJsonSchema as zodToJsonSchemaLib } from 'zod-to-json-schema';

import type { JSONSchema, Tool, ToolChoice } from '../types/tools';

/**
 * Convert SDK Tool to OpenAI function format.
 * Use when calling OpenAI-compatible APIs in custom model implementations.
 */
export function toOpenAITool(tool: Tool): {
	type: 'function';
	function: {
		name: string;
		description?: string;
		parameters: JSONSchema;
		strict?: boolean;
	};
} {
	const parameters = isZodSchema(tool.parameters)
		? zodToJsonSchema(tool.parameters)
		: (tool.parameters as JSONSchema);

	return {
		type: 'function',
		function: {
			name: tool.name,
			description: tool.description,
			parameters,
			strict: tool.strict,
		},
	};
}

/**
 * Convert SDK Tool to Anthropic format.
 * Use when calling Anthropic API in custom model implementations.
 */
export function toAnthropicTool(tool: Tool): {
	name: string;
	description?: string;
	input_schema: JSONSchema;
} {
	const inputSchema = isZodSchema(tool.parameters)
		? zodToJsonSchema(tool.parameters)
		: (tool.parameters as JSONSchema);

	return {
		name: tool.name,
		description: tool.description,
		input_schema: inputSchema,
	};
}

/**
 * Convert SDK ToolChoice to provider-specific format.
 */
export function toProviderToolChoice(
	choice: ToolChoice,
	provider: 'openai' | 'anthropic' | 'google',
): unknown {
	if (choice === 'auto') {
		return provider === 'anthropic' ? { type: 'auto' } : 'auto';
	}

	if (choice === 'required') {
		if (provider === 'openai') return 'required';
		if (provider === 'anthropic') return { type: 'any' };
		if (provider === 'google') return 'any';
	}

	if (choice === 'none') {
		if (provider === 'openai') return 'none';
		if (provider === 'anthropic') return { type: 'auto', disable_parallel_tool_use: true };
		return 'none';
	}

	// Specific tool choice
	if (typeof choice === 'object' && choice.type === 'tool') {
		if (provider === 'openai') {
			return {
				type: 'function',
				function: { name: choice.toolName },
			};
		}
		if (provider === 'anthropic') {
			return {
				type: 'tool',
				name: choice.toolName,
			};
		}
	}

	return choice;
}

/**
 * Convert Zod schema to JSON Schema.
 */
export function zodToJsonSchema(schema: unknown): JSONSchema {
	if (!isZodSchema(schema)) {
		return schema as JSONSchema;
	}

	try {
		// Use the zod-to-json-schema library
		const result = zodToJsonSchemaLib(schema as Parameters<typeof zodToJsonSchemaLib>[0], {
			$refStrategy: 'none',
		});
		return result as JSONSchema;
	} catch {
		// Fallback for unsupported schemas
		return { type: 'object', properties: {} };
	}
}

/**
 * Safely parse tool arguments from JSON string.
 */
export function parseToolArguments(argumentsString: string): Record<string, unknown> {
	try {
		return JSON.parse(argumentsString) as Record<string, unknown>;
	} catch {
		console.error('Failed to parse tool arguments:', argumentsString);
		return {};
	}
}

/**
 * Check if a value is a Zod schema
 */
function isZodSchema(value: unknown): boolean {
	return (
		typeof value === 'object' &&
		value !== null &&
		'_def' in value &&
		typeof (value as { _def: unknown })._def === 'object'
	);
}
