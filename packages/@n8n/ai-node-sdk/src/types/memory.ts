import type { Message } from './messages';

/**
 * Interface for custom chat message storage.
 * Community nodes implement this for their storage backends.
 */
export interface ChatHistory {
	/** Retrieve all messages from storage */
	getMessages(): Promise<Message[]>;

	/** Add a single message to storage */
	addMessage(message: Message): Promise<void>;

	/**
	 * Add multiple messages to storage.
	 * Optional - SDK provides default implementation if omitted.
	 */
	addMessages?(messages: Message[]): Promise<void>;

	/** Clear all messages from storage */
	clear(): Promise<void>;
}

/**
 * Options for createMemory factory - discriminated union
 */
export type MemoryOptions =
	| BufferMemoryOptions
	| BufferWindowMemoryOptions
	| TokenBufferMemoryOptions;

interface BaseMemoryOptions {
	chatHistory: ChatHistory;
	memoryKey?: string; // Default: 'chat_history'
	inputKey?: string; // Default: 'input'
	outputKey?: string; // Default: 'output'
	returnMessages?: boolean; // Default: true
	humanPrefix?: string; // Default: 'Human'
	aiPrefix?: string; // Default: 'AI'
}

export interface BufferMemoryOptions extends BaseMemoryOptions {
	type: 'buffer';
}

export interface BufferWindowMemoryOptions extends BaseMemoryOptions {
	type: 'bufferWindow';
	/** Number of recent messages to keep */
	k: number;
}

export interface TokenBufferMemoryOptions extends BaseMemoryOptions {
	type: 'tokenBuffer';
	/** Maximum number of tokens to keep */
	maxTokenLimit: number;
}
