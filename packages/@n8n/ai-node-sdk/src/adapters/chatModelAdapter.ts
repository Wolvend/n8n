/**
 * LangChain adapter for SDK ChatModel.
 * This adapter wraps custom chat model implementations to work with LangChain.
 */

import type { CallbackManagerForLLMRun } from '@langchain/core/callbacks/manager';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { AIMessage, AIMessageChunk, BaseMessage } from '@langchain/core/messages';
import { ChatGenerationChunk, type ChatResult } from '@langchain/core/outputs';

import type { Message, MessageRole, TextContent, ToolCallContent } from '../types/messages';
import type { GenerateResult } from '../types/results';
import type { CustomChatModelOptions, ChatModelConfig } from '../types/chatModel';
import type { Tool } from '../types/tools';

interface ToolUseBlock {
	type: 'tool_use';
	id: string;
	name: string;
	input: unknown;
}

interface TextBlock {
	type: 'text';
	text: string;
}

type ContentBlock = string | TextBlock | ToolUseBlock;

/**
 * Convert LangChain BaseMessage to SDK Message format
 */
function convertToSdkMessage(msg: BaseMessage): Message | Message[] {
	const role = langChainRoleToSdkRole(msg._getType());

	if (typeof msg.content === 'string') {
		return {
			role,
			content: { type: 'text', text: msg.content } as TextContent,
		};
	}

	// Handle array content (multi-block messages)
	if (Array.isArray(msg.content)) {
		const messages: Message[] = [];
		for (const block of msg.content as ContentBlock[]) {
			if (typeof block === 'string') {
				messages.push({ role, content: { type: 'text', text: block } });
			} else if (block.type === 'text') {
				messages.push({ role, content: { type: 'text', text: block.text } });
			} else if (block.type === 'tool_use') {
				messages.push({
					role: 'assistant',
					content: {
						type: 'tool-call',
						toolCallId: block.id,
						toolName: block.name,
						input: JSON.stringify(block.input),
					} as ToolCallContent,
				});
			}
		}
		if (messages.length === 0) {
			return { role, content: { type: 'text', text: '' } };
		}
		if (messages.length === 1) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			return messages[0]!;
		}
		return messages;
	}

	// Default to text
	return {
		role,
		content: { type: 'text', text: String(msg.content) } as TextContent,
	};
}

/**
 * Convert LangChain message type to SDK role
 */
function langChainRoleToSdkRole(type: string): MessageRole {
	switch (type) {
		case 'system':
			return 'system';
		case 'human':
			return 'user';
		case 'ai':
			return 'assistant';
		case 'tool':
			return 'tool';
		default:
			return 'user';
	}
}

/**
 * Convert SDK GenerateResult to LangChain ChatResult
 */
function convertToLangChainResult(result: GenerateResult, modelId: string): ChatResult {
	const aiMessage = new AIMessage({
		content: result.text,
		tool_calls: result.toolCalls?.map((tc) => ({
			id: tc.id,
			name: tc.name,
			args: tc.arguments,
		})),
		usage_metadata: result.usage
			? {
					input_tokens: result.usage.promptTokens,
					output_tokens: result.usage.completionTokens,
					total_tokens: result.usage.totalTokens,
				}
			: undefined,
		response_metadata: {
			model: modelId,
		},
		id: result.id,
	});

	return {
		generations: [
			{
				text: result.text,
				message: aiMessage,
			},
		],
		llmOutput: {
			tokenUsage: result.usage,
			finishReason: result.finishReason,
		},
	};
}

/**
 * LangChain adapter that wraps a custom SDK chat model
 */
export class ChatModelAdapter extends BaseChatModel {
	private options: CustomChatModelOptions;
	private boundTools: Tool[] = [];

	constructor(options: CustomChatModelOptions) {
		super({});
		this.options = options;
	}

	override _llmType(): string {
		return `sdk-custom-${this.options.name}`;
	}

	get modelId(): string {
		return this.options.name;
	}

	override async _generate(
		messages: BaseMessage[],
		options: this['ParsedCallOptions'],
	): Promise<ChatResult> {
		// Convert LangChain messages to SDK format
		const sdkMessages = messages.flatMap(convertToSdkMessage);

		// Extract options safely
		const opts = options as Record<string, unknown> | undefined;

		// Build config from options
		const config: ChatModelConfig = {
			maxTokens: opts?.max_tokens as number | undefined,
			temperature: opts?.temperature as number | undefined,
			stopSequences: opts?.stop as string[] | undefined,
			tools: this.boundTools.length > 0 ? this.boundTools : undefined,
		};

		// Call the custom generate function
		const result = await this.options.generate(sdkMessages, config);

		return convertToLangChainResult(result, this.options.name);
	}

	override async *_streamResponseChunks(
		messages: BaseMessage[],
		options: this['ParsedCallOptions'],
		runManager?: CallbackManagerForLLMRun,
	): AsyncGenerator<ChatGenerationChunk> {
		if (!this.options.stream) {
			// Fall back to non-streaming
			const result = await this._generate(messages, options);
			const text = result.generations[0]?.text ?? '';
			yield new ChatGenerationChunk({
				message: new AIMessageChunk({ content: text }),
				text,
			});
			return;
		}

		const sdkMessages = messages.flatMap(convertToSdkMessage);

		// Extract options safely
		const opts = options as Record<string, unknown> | undefined;

		const config: ChatModelConfig = {
			maxTokens: opts?.max_tokens as number | undefined,
			temperature: opts?.temperature as number | undefined,
			stopSequences: opts?.stop as string[] | undefined,
			tools: this.boundTools.length > 0 ? this.boundTools : undefined,
		};

		const stream = this.options.stream(sdkMessages, config);

		for await (const chunk of stream) {
			if (chunk.type === 'text-delta' && chunk.textDelta) {
				const chunkResult = new ChatGenerationChunk({
					message: new AIMessageChunk({ content: chunk.textDelta }),
					text: chunk.textDelta,
				});
				yield chunkResult;
				await runManager?.handleLLMNewToken(chunk.textDelta);
			}
		}
	}

	override bindTools(tools: Tool[]): ChatModelAdapter {
		const newAdapter = new ChatModelAdapter(this.options);
		newAdapter.boundTools = [...this.boundTools, ...tools];
		return newAdapter;
	}
}
