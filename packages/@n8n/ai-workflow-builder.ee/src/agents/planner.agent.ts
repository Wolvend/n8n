/**
 * Planner Agent using LangChain v1 createAgent API
 *
 * Generates a structured workflow plan for user approval (Plan Mode).
 */
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { SystemMessage } from '@langchain/core/messages';
import { createAgent } from 'langchain';
import { z } from 'zod';

import { buildPlannerPrompt } from '@/prompts';

export const plannerOutputSchema = z.object({
	summary: z.string().describe('1-2 sentence description of the workflow outcome'),
	trigger: z.string().describe('What starts the workflow (manual, schedule, webhook, etc.)'),
	steps: z
		.array(
			z.object({
				description: z.string().describe('What this step does'),
				subSteps: z.array(z.string()).optional(),
				suggestedNodes: z
					.array(z.string())
					.optional()
					.describe('Suggested internal n8n node type names (when known)'),
			}),
		)
		.min(1)
		.describe('Ordered list of workflow steps'),
	additionalSpecs: z
		.array(z.string())
		.optional()
		.describe('Optional assumptions, edge cases, or notes'),
});

export type PlannerOutput = z.infer<typeof plannerOutputSchema>;

export interface PlannerAgentConfig {
	llm: BaseChatModel;
}

export function createPlannerAgent(config: PlannerAgentConfig) {
	const plannerPromptText = buildPlannerPrompt();

	const systemPrompt = new SystemMessage({
		content: [
			{
				type: 'text',
				text: plannerPromptText,
				cache_control: { type: 'ephemeral' },
			},
		],
	});

	return createAgent({
		model: config.llm,
		tools: [],
		systemPrompt,
		responseFormat: plannerOutputSchema,
	});
}

export type PlannerAgentType = ReturnType<typeof createPlannerAgent>;
