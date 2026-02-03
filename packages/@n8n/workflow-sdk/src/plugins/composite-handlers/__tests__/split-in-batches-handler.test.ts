import { splitInBatchesHandler } from '../split-in-batches-handler';
import type { NodeInstance, GraphNode } from '../../../types/base';
import type { MutablePluginContext } from '../../types';

// Helper to create a mock split-in-batches node
function createMockSibNode(name = 'Split In Batches'): NodeInstance<string, string, unknown> {
	return {
		type: 'n8n-nodes-base.splitInBatches',
		name,
		version: '3',
		config: { parameters: { batchSize: 10 } },
	} as unknown as NodeInstance<string, string, unknown>;
}

// Helper to create a mock node
function createMockNode(name: string): NodeInstance<string, string, unknown> {
	return {
		type: 'n8n-nodes-base.set',
		name,
		version: '1',
		config: { parameters: {} },
	} as NodeInstance<string, string, unknown>;
}

// Type for named syntax split-in-batches builder
interface SplitInBatchesBuilderLike {
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

// Helper to create a mock SplitInBatchesBuilder with named syntax
function createSplitInBatchesBuilder(
	options: {
		sibNodeName?: string;
		doneTarget?:
			| NodeInstance<string, string, unknown>
			| NodeInstance<string, string, unknown>[]
			| null;
		eachTarget?:
			| NodeInstance<string, string, unknown>
			| NodeInstance<string, string, unknown>[]
			| null;
	} = {},
): SplitInBatchesBuilderLike {
	return {
		sibNode: createMockSibNode(options.sibNodeName),
		_doneNodes: [],
		_eachNodes: [],
		_doneTarget: options.doneTarget,
		_eachTarget: options.eachTarget,
	};
}

// Helper to create a mock MutablePluginContext
function createMockContext(): MutablePluginContext {
	const nodes = new Map<string, GraphNode>();
	return {
		nodes,
		workflowId: 'test-workflow',
		workflowName: 'Test Workflow',
		settings: {},
		addNodeWithSubnodes: jest.fn((node: NodeInstance<string, string, unknown>) => {
			nodes.set(node.name, {
				instance: node,
				connections: new Map(),
			});
			return node.name;
		}),
		addBranchToGraph: jest.fn((branch: unknown) => {
			const branchNode = branch as NodeInstance<string, string, unknown>;
			nodes.set(branchNode.name, {
				instance: branchNode,
				connections: new Map(),
			});
			return branchNode.name;
		}),
	};
}

describe('splitInBatchesHandler', () => {
	describe('metadata', () => {
		it('has correct id', () => {
			expect(splitInBatchesHandler.id).toBe('core:split-in-batches');
		});

		it('has correct name', () => {
			expect(splitInBatchesHandler.name).toBe('Split In Batches Handler');
		});

		it('has high priority', () => {
			expect(splitInBatchesHandler.priority).toBeGreaterThanOrEqual(100);
		});
	});

	describe('canHandle', () => {
		it('returns true for SplitInBatchesBuilder', () => {
			const builder = createSplitInBatchesBuilder();
			expect(splitInBatchesHandler.canHandle(builder)).toBe(true);
		});

		it('returns false for regular NodeInstance', () => {
			const node = createMockNode('Regular Node');
			expect(splitInBatchesHandler.canHandle(node)).toBe(false);
		});

		it('returns false for null', () => {
			expect(splitInBatchesHandler.canHandle(null)).toBe(false);
		});

		it('returns false for undefined', () => {
			expect(splitInBatchesHandler.canHandle(undefined)).toBe(false);
		});
	});

	describe('addNodes', () => {
		it('returns the SIB node name as head', () => {
			const builder = createSplitInBatchesBuilder({ sibNodeName: 'My SIB' });
			const ctx = createMockContext();

			const headName = splitInBatchesHandler.addNodes(builder, ctx);

			expect(headName).toBe('My SIB');
		});

		it('adds SIB node to the context nodes map', () => {
			const builder = createSplitInBatchesBuilder();
			const ctx = createMockContext();

			splitInBatchesHandler.addNodes(builder, ctx);

			expect(ctx.nodes.has('Split In Batches')).toBe(true);
			expect(ctx.nodes.get('Split In Batches')?.instance).toBe(builder.sibNode);
		});

		it('adds done target using addBranchToGraph (output 0)', () => {
			const doneNode = createMockNode('Done Node');
			const builder = createSplitInBatchesBuilder({ doneTarget: doneNode });
			const ctx = createMockContext();

			splitInBatchesHandler.addNodes(builder, ctx);

			expect(ctx.addBranchToGraph).toHaveBeenCalledWith(doneNode);
		});

		it('creates connection from SIB output 0 to done target', () => {
			const doneNode = createMockNode('Done Node');
			const builder = createSplitInBatchesBuilder({ doneTarget: doneNode });
			const ctx = createMockContext();

			splitInBatchesHandler.addNodes(builder, ctx);

			const sibNode = ctx.nodes.get('Split In Batches');
			const mainConns = sibNode?.connections.get('main');
			const output0Conns = mainConns?.get(0);

			expect(output0Conns).toBeDefined();
			expect(output0Conns).toContainEqual(
				expect.objectContaining({ node: 'Done Node', type: 'main', index: 0 }),
			);
		});

		it('adds each target using addBranchToGraph (output 1)', () => {
			const eachNode = createMockNode('Each Node');
			const builder = createSplitInBatchesBuilder({ eachTarget: eachNode });
			const ctx = createMockContext();

			splitInBatchesHandler.addNodes(builder, ctx);

			expect(ctx.addBranchToGraph).toHaveBeenCalledWith(eachNode);
		});

		it('creates connection from SIB output 1 to each target', () => {
			const eachNode = createMockNode('Each Node');
			const builder = createSplitInBatchesBuilder({ eachTarget: eachNode });
			const ctx = createMockContext();

			splitInBatchesHandler.addNodes(builder, ctx);

			const sibNode = ctx.nodes.get('Split In Batches');
			const mainConns = sibNode?.connections.get('main');
			const output1Conns = mainConns?.get(1);

			expect(output1Conns).toBeDefined();
			expect(output1Conns).toContainEqual(
				expect.objectContaining({ node: 'Each Node', type: 'main', index: 0 }),
			);
		});

		it('handles array done target (fan-out)', () => {
			const done1 = createMockNode('Done 1');
			const done2 = createMockNode('Done 2');
			const builder = createSplitInBatchesBuilder({ doneTarget: [done1, done2] });
			const ctx = createMockContext();

			splitInBatchesHandler.addNodes(builder, ctx);

			// Both should be added
			expect(ctx.addBranchToGraph).toHaveBeenCalledWith(done1);
			expect(ctx.addBranchToGraph).toHaveBeenCalledWith(done2);

			// Output 0 should connect to both
			const sibNode = ctx.nodes.get('Split In Batches');
			const mainConns = sibNode?.connections.get('main');
			const output0Conns = mainConns?.get(0);

			expect(output0Conns).toHaveLength(2);
			expect(output0Conns).toContainEqual(expect.objectContaining({ node: 'Done 1' }));
			expect(output0Conns).toContainEqual(expect.objectContaining({ node: 'Done 2' }));
		});

		it('handles array each target (fan-out)', () => {
			const each1 = createMockNode('Each 1');
			const each2 = createMockNode('Each 2');
			const builder = createSplitInBatchesBuilder({ eachTarget: [each1, each2] });
			const ctx = createMockContext();

			splitInBatchesHandler.addNodes(builder, ctx);

			// Both should be added
			expect(ctx.addBranchToGraph).toHaveBeenCalledWith(each1);
			expect(ctx.addBranchToGraph).toHaveBeenCalledWith(each2);

			// Output 1 should connect to both
			const sibNode = ctx.nodes.get('Split In Batches');
			const mainConns = sibNode?.connections.get('main');
			const output1Conns = mainConns?.get(1);

			expect(output1Conns).toHaveLength(2);
			expect(output1Conns).toContainEqual(expect.objectContaining({ node: 'Each 1' }));
			expect(output1Conns).toContainEqual(expect.objectContaining({ node: 'Each 2' }));
		});

		it('handles null done target (no connection at output 0)', () => {
			const eachNode = createMockNode('Each Node');
			const builder = createSplitInBatchesBuilder({ doneTarget: null, eachTarget: eachNode });
			const ctx = createMockContext();

			splitInBatchesHandler.addNodes(builder, ctx);

			const sibNode = ctx.nodes.get('Split In Batches');
			const mainConns = sibNode?.connections.get('main');

			// Output 0 should have no connections
			expect(mainConns?.get(0)).toBeUndefined();
			// Output 1 should have connection
			expect(mainConns?.get(1)).toBeDefined();
		});

		it('handles both done and each targets', () => {
			const doneNode = createMockNode('Done Node');
			const eachNode = createMockNode('Each Node');
			const builder = createSplitInBatchesBuilder({ doneTarget: doneNode, eachTarget: eachNode });
			const ctx = createMockContext();

			splitInBatchesHandler.addNodes(builder, ctx);

			// Both should be added
			expect(ctx.addBranchToGraph).toHaveBeenCalledWith(doneNode);
			expect(ctx.addBranchToGraph).toHaveBeenCalledWith(eachNode);

			const sibNode = ctx.nodes.get('Split In Batches');
			const mainConns = sibNode?.connections.get('main');

			expect(mainConns?.get(0)).toContainEqual(expect.objectContaining({ node: 'Done Node' }));
			expect(mainConns?.get(1)).toContainEqual(expect.objectContaining({ node: 'Each Node' }));
		});
	});
});
