import { BaseChatMemory as LangchainBaseChatMemory } from '@langchain/community/memory/chat_memory';
import { ChatMessageHistory as LangchainChatMessageHistory } from '@langchain/community/stores/message/in_memory';
import type { BaseChatMessageHistory as LangchainBaseChatMessageHistory } from '@langchain/core/chat_history';
import type { InputValues, MemoryVariables, OutputValues } from '@langchain/core/memory';

import { toLcMessage } from '../converters/message';
import type { ChatMemory } from '../types/memory';

/** Internal adapter - used by supplyMemory() */
export class LangchainMemoryAdapter extends LangchainBaseChatMemory {
	private readonly n8nMemory: ChatMemory;
	override chatHistory: LangchainBaseChatMessageHistory;

	constructor(memory: ChatMemory) {
		super({
			returnMessages: true,
			inputKey: 'input',
			outputKey: 'output',
		});
		this.n8nMemory = memory;
		this.chatHistory = new LangchainChatMessageHistory();
	}

	get memoryKeys(): string[] {
		return ['chat_history'];
	}

	async loadMemoryVariables(_values: InputValues): Promise<MemoryVariables> {
		const messages = await this.n8nMemory.loadMessages();
		const lcMessages = messages.map(toLcMessage);

		await this.chatHistory.clear();
		await this.chatHistory.addMessages(lcMessages);

		return {
			chat_history: lcMessages,
		};
	}

	async saveContext(inputValues: InputValues, outputValues: OutputValues): Promise<void> {
		const input = inputValues.input as string;
		const output = outputValues.output as string;
		await this.n8nMemory.saveContext(input, output);
	}

	async clear(): Promise<void> {
		await this.n8nMemory.clear();
		await this.chatHistory.clear();
	}
}
