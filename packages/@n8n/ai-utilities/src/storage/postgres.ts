import type { PostgresChatMessageHistoryInput } from '@langchain/community/stores/message/postgres';
import { PostgresChatMessageHistory } from '@langchain/community/stores/message/postgres';

import { fromLcMessage, toLcMessage } from '../converters/message';
import { BaseChatHistory } from '../memory/base-chat-history';
import type { Message } from '../types/message';

export interface PostgresChatHistoryConfig {
	/** pg Pool instance - pass your connected pool directly */
	pool: PostgresChatMessageHistoryInput['pool'];
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
