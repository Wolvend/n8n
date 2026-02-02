import {
	NodeConnectionTypes,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
} from 'n8n-workflow';

import { createChatModel } from '@n8n/ai-node-sdk';

import type { LemonadeApiCredentialsType } from '../../../credentials/LemonadeApi.credentials';

import { getConnectionHintNoticeField } from '@utils/sharedFields';
import { getProxyAgent } from '@utils/httpProxyAgent';

import { lemonadeModel, lemonadeOptions, lemonadeDescription } from '../LMLemonade/description';
import { makeN8nLlmFailedAttemptHandler } from '../n8nLlmFailedAttemptHandler';
import { N8nLlmTracing } from '../N8nLlmTracing';

export class LmChatLemonade implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Lemonade Chat Model',

		name: 'lmChatLemonade',
		icon: 'file:lemonade.svg',
		group: ['transform'],
		version: 1,
		description: 'Language Model Lemonade Chat',
		defaults: {
			name: 'Lemonade Chat Model',
		},
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Language Models', 'Root Nodes'],
				'Language Models': ['Chat Models (Recommended)'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.n8n.io/integrations/builtin/cluster-nodes/sub-nodes/n8n-nodes-langchain.lmchatlemonade/',
					},
				],
			},
		},

		inputs: [],

		outputs: [NodeConnectionTypes.AiLanguageModel],
		outputNames: ['Model'],
		...lemonadeDescription,
		properties: [
			getConnectionHintNoticeField([NodeConnectionTypes.AiChain, NodeConnectionTypes.AiAgent]),
			lemonadeModel,
			lemonadeOptions,
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const credentials = (await this.getCredentials('lemonadeApi')) as LemonadeApiCredentialsType;

		const modelName = this.getNodeParameter('model', itemIndex) as string;
		const options = this.getNodeParameter('options', itemIndex, {}) as {
			temperature?: number;
			topP?: number;
			frequencyPenalty?: number;
			presencePenalty?: number;
			maxTokens?: number;
			stop?: string;
		};

		// Process stop sequences
		let stopSequences: string[] | undefined;
		if (options.stop) {
			stopSequences = options.stop
				.split(',')
				.map((s) => s.trim())
				.filter((s) => s.length > 0);
			if (stopSequences.length === 0) {
				stopSequences = undefined;
			}
		}

		// Build headers
		const headers: Record<string, string> = {};
		if (credentials.apiKey) {
			headers.Authorization = `Bearer ${credentials.apiKey}`;
		}

		// Create model using the SDK
		const model = createChatModel(this, {
			type: 'openaiCompatible',
			apiKey: credentials.apiKey || 'lemonade-placeholder-key',
			model: modelName,
			baseUrl: credentials.baseUrl,
			temperature: options.temperature,
			maxTokens: options.maxTokens && options.maxTokens > 0 ? options.maxTokens : undefined,
			topP: options.topP,
			frequencyPenalty: options.frequencyPenalty,
			presencePenalty: options.presencePenalty,
			stopSequences,
			headers,
			callbacks: [new N8nLlmTracing(this)],
			onFailedAttempt: makeN8nLlmFailedAttemptHandler(this),
			clientOptions: {
				fetchOptions: {
					dispatcher: getProxyAgent(credentials.baseUrl ?? '', {}),
				},
			},
		});

		return {
			response: model,
		};
	}
}
