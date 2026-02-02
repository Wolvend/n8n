/**
 * LangChain adapter for SDK ChatHistory.
 * This adapter wraps custom chat history implementations to work with LangChain memory.
 */

import { BaseChatMessageHistory } from '@langchain/core/chat_history';
import {
	AIMessage,
	BaseMessage,
	HumanMessage,
	SystemMessage,
	ToolMessage,
} from '@langchain/core/messages';

import type { ChatHistory } from '../types/memory';
import type { Message, MessageRole, TextContent } from '../types/messages';

/**
 * Convert SDK Message to LangChain BaseMessage
 */
function sdkMessageToLangChain(message: Message): BaseMessage {
	const text =
		message.content.type === 'text' ? message.content.text : JSON.stringify(message.content);

	switch (message.role) {
		case 'system':
			return new SystemMessage(text);
		case 'user':
			return new HumanMessage(text);
		case 'assistant':
			return new AIMessage(text);
		case 'tool':
			if (message.content.type === 'tool-result') {
				return new ToolMessage({
					content:
						typeof message.content.result === 'string'
							? message.content.result
							: JSON.stringify(message.content.result),
					tool_call_id: message.content.toolCallId,
				});
			}
			return new AIMessage(text);
		default:
			return new HumanMessage(text);
	}
}

/**
 * Convert LangChain BaseMessage to SDK Message
 */
function langChainMessageToSdk(message: BaseMessage): Message {
	const type = message._getType();
	let role: MessageRole;

	switch (type) {
		case 'system':
			role = 'system';
			break;
		case 'human':
			role = 'user';
			break;
		case 'ai':
			role = 'assistant';
			break;
		case 'tool':
			role = 'tool';
			break;
		default:
			role = 'user';
	}

	const content =
		typeof message.content === 'string' ? message.content : JSON.stringify(message.content);

	return {
		role,
		content: { type: 'text', text: content } as TextContent,
	};
}

/**
 * LangChain adapter that wraps a custom SDK ChatHistory
 */
export class ChatHistoryAdapter extends BaseChatMessageHistory {
	lc_namespace = ['langchain', 'stores', 'message', 'sdk'];

	private chatHistory: ChatHistory;
	private addMessagesFn: (messages: Message[]) => Promise<void>;

	constructor(chatHistory: ChatHistory) {
		super();
		this.chatHistory = chatHistory;

		// Create addMessages function with fallback
		this.addMessagesFn =
			chatHistory.addMessages?.bind(chatHistory) ??
			(async (msgs: Message[]) => {
				for (const m of msgs) {
					await chatHistory.addMessage(m);
				}
			});
	}

	override async getMessages(): Promise<BaseMessage[]> {
		const sdkMessages = await this.chatHistory.getMessages();
		return sdkMessages.map(sdkMessageToLangChain);
	}

	override async addMessage(message: BaseMessage): Promise<void> {
		const sdkMessage = langChainMessageToSdk(message);
		await this.chatHistory.addMessage(sdkMessage);
	}

	async addUserMessage(message: string): Promise<void> {
		await this.addMessage(new HumanMessage(message));
	}

	async addAIMessage(message: string): Promise<void> {
		await this.addMessage(new AIMessage(message));
	}

	override async addMessages(messages: BaseMessage[]): Promise<void> {
		const sdkMessages = messages.map(langChainMessageToSdk);
		await this.addMessagesFn(sdkMessages);
	}

	override async clear(): Promise<void> {
		await this.chatHistory.clear();
	}
}
