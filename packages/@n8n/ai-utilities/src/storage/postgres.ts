import { PostgresChatMessageHistory } from '@langchain/community/stores/message/postgres';
import type { Pool } from 'pg';

import { toLcMessage } from './message-utils';
import { fromLcMessage } from '../converters/message';
import { BaseChatHistory } from '../memory/base-chat-history';
import type { Message } from '../types/message';

export interface PostgresChatHistoryConfig {
	pool: Pool;
	sessionId: string;
	tableName?: string;
}

/** PostgreSQL-backed chat history using @langchain/community internally. */
export class PostgresChatHistory extends BaseChatHistory {
	private readonly lcHistory: PostgresChatMessageHistory;

	constructor(config: PostgresChatHistoryConfig) {
		super();
		this.lcHistory = new PostgresChatMessageHistory({
			pool: config.pool,
			sessionId: config.sessionId,
			tableName: config.tableName ?? 'n8n_chat_histories',
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
