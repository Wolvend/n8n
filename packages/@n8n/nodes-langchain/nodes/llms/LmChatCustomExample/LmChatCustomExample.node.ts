/**
 * Example node demonstrating the @n8n/ai-node-sdk usage.
 * This shows how community developers can create custom chat model nodes.
 */

import {
	NodeConnectionTypes,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
} from 'n8n-workflow';

import {
	createChatModel,
	type Message,
	type GenerateResult,
	type StreamChunk,
	type ChatModelConfig,
} from '@n8n/ai-node-sdk';

import { getConnectionHintNoticeField } from '@utils/sharedFields';

export class LmChatCustomExample implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Custom Chat Model (SDK Example)',
		name: 'lmChatCustomExample',
		icon: 'fa:robot',
		group: ['transform'],
		version: 1,
		description: 'Example of a custom chat model using @n8n/ai-node-sdk',
		defaults: {
			name: 'Custom Chat Model',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models', 'Root Nodes'],
				'Language Models': ['Chat Models (Recommended)'],
			},
		},

		inputs: [],
		outputs: [NodeConnectionTypes.AiLanguageModel],
		outputNames: ['Model'],
		credentials: [
			{
				name: 'httpHeaderAuth',
				required: false,
			},
		],
		properties: [
			getConnectionHintNoticeField([NodeConnectionTypes.AiChain, NodeConnectionTypes.AiAgent]),
			{
				displayName: 'Base URL',
				name: 'baseUrl',
				type: 'string',
				default: 'https://api.example.com',
				required: true,
				description: 'The base URL of the API',
			},
			{
				displayName: 'Model Name',
				name: 'model',
				type: 'string',
				default: 'custom-model-v1',
				required: true,
			},
			{
				displayName: 'Options',
				name: 'options',
				type: 'collection',
				placeholder: 'Add Option',
				default: {},
				options: [
					{
						displayName: 'Temperature',
						name: 'temperature',
						type: 'number',
						default: 0.7,
						typeOptions: { minValue: 0, maxValue: 2 },
						description: 'Controls randomness in the output',
					},
					{
						displayName: 'Max Tokens',
						name: 'maxTokens',
						type: 'number',
						default: 1024,
						description: 'Maximum number of tokens to generate',
					},
				],
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const baseUrl = this.getNodeParameter('baseUrl', itemIndex) as string;
		const modelName = this.getNodeParameter('model', itemIndex) as string;
		const options = this.getNodeParameter('options', itemIndex, {}) as {
			temperature?: number;
			maxTokens?: number;
		};

		// Get credentials if provided
		let apiKey = '';
		try {
			const credentials = await this.getCredentials('httpHeaderAuth');
			apiKey = credentials.value as string;
		} catch {
			// No credentials provided, continue without auth
		}

		// Create a custom chat model using the SDK
		const model = createChatModel(this, {
			type: 'custom',
			name: modelName,

			// Generate function - called for non-streaming requests
			generate: async (messages: Message[], config?: ChatModelConfig): Promise<GenerateResult> => {
				// Convert SDK messages to API format
				const apiMessages = messages.map((m) => ({
					role: m.role,
					content: m.content.type === 'text' ? m.content.text : JSON.stringify(m.content),
				}));

				// Make the API request using n8n's httpRequest helper
				const requestOptions: Parameters<typeof this.helpers.httpRequest>[0] = {
					method: 'POST',
					url: `${baseUrl}/v1/chat/completions`,
					body: {
						model: modelName,
						messages: apiMessages,
						temperature: config?.temperature ?? options.temperature ?? 0.7,
						max_tokens: config?.maxTokens ?? options.maxTokens ?? 1024,
					},
					headers: {} as Record<string, string>,
				};

				if (apiKey) {
					requestOptions.headers = { Authorization: `Bearer ${apiKey}` };
				}

				const response = await this.helpers.httpRequest(requestOptions);

				// Parse response and return in SDK format
				const choice = response.choices?.[0];
				return {
					text: choice?.message?.content ?? '',
					finishReason: choice?.finish_reason === 'stop' ? 'stop' : 'other',
					usage: response.usage
						? {
								promptTokens: response.usage.prompt_tokens ?? 0,
								completionTokens: response.usage.completion_tokens ?? 0,
								totalTokens: response.usage.total_tokens ?? 0,
							}
						: undefined,
					toolCalls: choice?.message?.tool_calls?.map(
						(tc: { id: string; function: { name: string; arguments: string } }) => ({
							id: tc.id,
							name: tc.function.name,
							arguments: JSON.parse(tc.function.arguments),
						}),
					),
					rawResponse: response,
				};
			},

			// Optional: streaming support
			stream: async function* (
				messages: Message[],
				config?: ChatModelConfig,
			): AsyncIterable<StreamChunk> {
				const apiMessages = messages.map((m) => ({
					role: m.role,
					content: m.content.type === 'text' ? m.content.text : JSON.stringify(m.content),
				}));

				// For streaming, we'd use fetch with ReadableStream
				// This is a simplified example - real implementation would parse SSE
				const response = await fetch(`${baseUrl}/v1/chat/completions`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
					},
					body: JSON.stringify({
						model: modelName,
						messages: apiMessages,
						temperature: config?.temperature ?? options.temperature ?? 0.7,
						max_tokens: config?.maxTokens ?? options.maxTokens ?? 1024,
						stream: true,
					}),
				});

				if (!response.body) {
					yield { type: 'error', error: 'No response body' };
					return;
				}

				const reader = response.body.getReader();
				const decoder = new TextDecoder();

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					const chunk = decoder.decode(value);
					// Parse SSE format: "data: {...}\n\n"
					for (const line of chunk.split('\n')) {
						if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;

						try {
							const data = JSON.parse(line.slice(6));
							const delta = data.choices?.[0]?.delta;

							if (delta?.content) {
								yield { type: 'text-delta', textDelta: delta.content };
							}
						} catch {
							// Skip malformed lines
						}
					}
				}

				yield { type: 'finish', finishReason: 'stop' };
			},
		});

		return {
			response: model,
		};
	}
}
