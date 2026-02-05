import {
	AIMessage,
	HumanMessage,
	SystemMessage,
	ToolMessage,
	type BaseMessage,
} from '@langchain/core/messages';

import type { Message, MessageContent } from '../types/message';

/** Convert n8n Message to LangChain BaseMessage */
export function toLcMessage(message: Message): BaseMessage {
	const text = message.content
		.filter((c): c is MessageContent & { type: 'text' } => c.type === 'text')
		.map((c) => c.text)
		.join('');

	switch (message.role) {
		case 'system':
			return new SystemMessage(text);
		case 'human':
			return new HumanMessage(text);
		case 'ai':
			return new AIMessage(text);
		case 'tool': {
			const toolResult = message.content.find((c) => c.type === 'tool-result');
			if (toolResult && 'toolCallId' in toolResult) {
				return new ToolMessage({
					content:
						typeof toolResult.result === 'string'
							? toolResult.result
							: JSON.stringify(toolResult.result),
					tool_call_id: toolResult.toolCallId,
				});
			}
			return new AIMessage(text);
		}
		default:
			return new HumanMessage(text);
	}
}
