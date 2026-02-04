import { LangchainAdapter } from 'src/adapters/langchain';
import type { ChatModel } from 'src/types/chat-model';

export function createChatModel(model: ChatModel) {
	return new LangchainAdapter(model);
}
