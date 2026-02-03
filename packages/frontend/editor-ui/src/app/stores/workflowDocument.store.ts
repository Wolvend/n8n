import { defineStore, getActivePinia, type StoreGeneric } from 'pinia';
import { STORES } from '@n8n/stores';
import { ref, readonly } from 'vue';
import { useWorkflowsStore } from './workflows.store';

// Pinia internal type - _s is the store registry Map
type PiniaInternal = ReturnType<typeof getActivePinia> & {
	_s: Map<string, StoreGeneric>;
};

type WorkflowDocumentId = `${string}@${string}`;

type Action<N, P> = { name: N; payload: P };

type SetTagsAction = Action<'setTags', { tags: string[] }>;

/**
 * Gets the store ID for a workflow document store.
 */
export function getWorkflowDocumentStoreId(id: string) {
	return `${STORES.WORKFLOW_DOCUMENTS}/${id}`;
}

/**
 * Creates a workflow document store for a specific workflow ID.
 *
 * Note: We use a factory function rather than a module-level cache because
 * Pinia store instances must be tied to the active Pinia instance. A module-level
 * cache would cause test isolation issues where stale store references persist
 * across test runs with different Pinia instances.
 *
 * Pinia internally handles store deduplication per-instance via the store ID.
 */
export function useWorkflowDocumentStore(id: WorkflowDocumentId) {
	return defineStore(getWorkflowDocumentStoreId(id), () => {
		const workflowsStore = useWorkflowsStore();

		const [workflowId, workflowVersion] = id.split('@');

		/**
		 * Tags
		 */

		const tags = ref<string[]>([]);

		function setTags(newTags: string[]) {
			onChange({ name: 'setTags', payload: { tags: newTags } });
		}

		/**
		 * Handle actions in a CRDT like manner
		 */

		function onChange(action: SetTagsAction) {
			if (action.name === 'setTags') {
				tags.value = action.payload.tags;
			}
		}

		/**
		 * Subscribe to workflow changes
		 */

		const unsubscribe = workflowsStore.$subscribe((mutation, state) => {
			if (mutation.storeId === workflowsStore.$id && state.workflow?.id === workflowId) {
				setTags((state.workflow.tags as string[]) || []);
			}
		});

		return {
			workflowId,
			workflowVersion,
			tags: readonly(tags),
			setTags,
			unsubscribe,
		};
	})();
}

/**
 * Disposes a workflow document store by ID.
 * Call this when a workflow document is unloaded (e.g., when navigating away from NodeView).
 *
 * This removes the store from Pinia's internal registry, freeing memory and preventing
 * stale stores from accumulating over time.
 */
export function disposeWorkflowDocumentStore(id: string) {
	const pinia = getActivePinia() as PiniaInternal;
	if (!pinia) return;

	const storeId = getWorkflowDocumentStoreId(id);

	// Check if the store exists in the Pinia state
	if (pinia.state.value[storeId]) {
		// Get the store instance
		const store = pinia._s.get(storeId);
		if (store) {
			// Unsubscribe from workflowsStore before disposing
			store.unsubscribe?.();
			store.$dispose();
		}
		// Remove from Pinia's state
		delete pinia.state.value[storeId];
	}
}
