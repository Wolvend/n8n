import type { RedisChatMessageHistoryInput } from '@langchain/redis';
import { RedisChatMessageHistory } from '@langchain/redis';

import { toLcMessage } from './message-utils';
import { fromLcMessage } from '../converters/message';
import { BaseChatHistory } from '../memory/base-chat-history';
import type { Message } from '../types/message';

export interface RedisChatHistoryConfig {
	/** Redis client instance - pass your connected client directly */
	client: RedisChatMessageHistoryInput['client'];
	sessionId: string;
	sessionTTL?: number;
}

/** Redis-backed chat history using @langchain/redis internally. */
export class RedisChatHistory extends BaseChatHistory {
	private readonly lcHistory: RedisChatMessageHistory;

	constructor(config: RedisChatHistoryConfig) {
		super();

		const lcConfig: RedisChatMessageHistoryInput = {
			client: config.client,
			sessionId: config.sessionId,
		};

		if (config.sessionTTL !== undefined && config.sessionTTL > 0) {
			lcConfig.sessionTTL = config.sessionTTL;
		}

		this.lcHistory = new RedisChatMessageHistory(lcConfig);
	}

	async getMessages(): Promise<Message[]> {
		const lcMessages = await this.lcHistory.getMessages();
		return lcMessages.map(fromLcMessage);
	}

	async addMessage(message: Message): Promise<void> {
		const lcMessage = toLcMessage(message);
		await this.lcHistory.addMessage(lcMessage);
	}

	async addMessages(messages: Message[]): Promise<void> {
		const lcMessages = messages.map(toLcMessage);
		await this.lcHistory.addMessages(lcMessages);
	}

	async clear(): Promise<void> {
		await this.lcHistory.clear();
	}
}
