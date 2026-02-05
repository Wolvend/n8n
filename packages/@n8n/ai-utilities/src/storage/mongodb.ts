import type { MongoDBChatMessageHistoryInput } from '@langchain/mongodb';
import { MongoDBChatMessageHistory } from '@langchain/mongodb';

import { fromLcMessage, toLcMessage } from '../converters/message';
import { BaseChatHistory } from '../memory/base-chat-history';
import type { Message } from '../types/message';

export interface MongoDBChatHistoryConfig {
	/** MongoDB collection instance - pass your connected collection directly */
	collection: MongoDBChatMessageHistoryInput['collection'];
	sessionId: string;
}

/** MongoDB-backed chat history using @langchain/mongodb internally. */
export class MongoDBChatHistory extends BaseChatHistory {
	private readonly lcHistory: MongoDBChatMessageHistory;

	constructor(config: MongoDBChatHistoryConfig) {
		super();
		this.lcHistory = new MongoDBChatMessageHistory({
			collection: config.collection,
			sessionId: config.sessionId,
		});
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
