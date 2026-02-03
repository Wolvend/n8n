/**
 * Split In Batches Composite Handler Plugin
 *
 * Handles SplitInBatchesBuilder structures for processing data in batches.
 * This handles the named syntax pattern: splitInBatches(sibNode, { done: ..., each: ... })
 */

import type { CompositeHandlerPlugin, MutablePluginContext } from '../types';
import type { NodeInstance, ConnectionTarget } from '../../types/base';

/**
 * Shape of a SplitInBatchesBuilder for type checking
 */
interface SplitInBatchesBuilderShape {
	sibNode: NodeInstance<string, string, unknown>;
	_doneNodes: NodeInstance<string, string, unknown>[];
	_eachNodes: NodeInstance<string, string, unknown>[];
	_doneTarget?:
		| NodeInstance<string, string, unknown>
		| NodeInstance<string, string, unknown>[]
		| null;
	_eachTarget?:
		| NodeInstance<string, string, unknown>
		| NodeInstance<string, string, unknown>[]
		| null;
}

/**
 * Type guard for SplitInBatchesBuilder shape
 */
function isSplitInBatchesBuilderShape(value: unknown): value is SplitInBatchesBuilderShape {
	if (value === null || typeof value !== 'object') return false;

	// Check for required properties
	return 'sibNode' in value && '_doneNodes' in value && '_eachNodes' in value;
}

/**
 * Handler for Split In Batches composite structures.
 *
 * Recognizes SplitInBatchesBuilder patterns and adds the SIB node and its
 * done/each targets to the workflow graph.
 */
export const splitInBatchesHandler: CompositeHandlerPlugin<SplitInBatchesBuilderShape> = {
	id: 'core:split-in-batches',
	name: 'Split In Batches Handler',
	priority: 100,

	canHandle(input: unknown): input is SplitInBatchesBuilderShape {
		return isSplitInBatchesBuilderShape(input);
	},

	addNodes(input: SplitInBatchesBuilderShape, ctx: MutablePluginContext): string {
		// Add the SIB node first (with connections to targets)
		const sibMainConns = new Map<number, ConnectionTarget[]>();

		// Process done target (output 0)
		if (input._doneTarget !== null && input._doneTarget !== undefined) {
			const doneTarget = input._doneTarget;
			if (Array.isArray(doneTarget)) {
				// Fan-out: multiple targets from done output
				const targets: ConnectionTarget[] = [];
				for (const target of doneTarget) {
					const targetHead = ctx.addBranchToGraph(target);
					targets.push({ node: targetHead, type: 'main', index: 0 });
				}
				sibMainConns.set(0, targets);
			} else {
				const targetHead = ctx.addBranchToGraph(doneTarget);
				sibMainConns.set(0, [{ node: targetHead, type: 'main', index: 0 }]);
			}
		}

		// Process each target (output 1)
		if (input._eachTarget !== null && input._eachTarget !== undefined) {
			const eachTarget = input._eachTarget;
			if (Array.isArray(eachTarget)) {
				// Fan-out: multiple targets from each output
				const targets: ConnectionTarget[] = [];
				for (const target of eachTarget) {
					const targetHead = ctx.addBranchToGraph(target);
					targets.push({ node: targetHead, type: 'main', index: 0 });
				}
				sibMainConns.set(1, targets);
			} else {
				const targetHead = ctx.addBranchToGraph(eachTarget);
				sibMainConns.set(1, [{ node: targetHead, type: 'main', index: 0 }]);
			}
		}

		// Add the SIB node with connections
		const sibConns = new Map<string, Map<number, ConnectionTarget[]>>();
		sibConns.set('main', sibMainConns);
		ctx.nodes.set(input.sibNode.name, {
			instance: input.sibNode,
			connections: sibConns,
		});

		// Return the SIB node name as the head of this composite
		return input.sibNode.name;
	},
};
