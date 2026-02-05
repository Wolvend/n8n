<script setup lang="ts">
import WorkflowHistoryVersionFormModal from './WorkflowHistoryVersionFormModal.vue';
import type { WorkflowHistoryVersionFormModalEventBusEvents } from './WorkflowHistoryVersionFormModal.vue';
import { WORKFLOW_HISTORY_PUBLISH_MODAL_KEY } from '@/app/constants';
import { useI18n } from '@n8n/i18n';
import { useWorkflowActivate } from '@/app/composables/useWorkflowActivate';
import { createEventBus } from '@n8n/utils/event-bus';
import type { EventBus } from '@n8n/utils/event-bus';
import { useUIStore } from '@/app/stores/ui.store';

export type WorkflowHistoryPublishModalEventBusEvents = {
	publish: { versionId: string; name: string; description: string };
	cancel: undefined;
};

const props = defineProps<{
	modalName: string;
	data: {
		versionId: string;
		workflowId: string;
		formattedCreatedAt: string;
		versionName?: string;
		description?: string;
		eventBus: EventBus<WorkflowHistoryPublishModalEventBusEvents>;
	};
}>();

const i18n = useI18n();
const workflowActivate = useWorkflowActivate();
const uiStore = useUIStore();

const formEventBus = createEventBus<WorkflowHistoryVersionFormModalEventBusEvents>();

formEventBus.on(
	'submit',
	async (submitData: { versionId: string; name: string; description: string }) => {
		const { success } = await workflowActivate.publishWorkflow(
			props.data.workflowId,
			submitData.versionId,
			{
				name: submitData.name,
				description: submitData.description,
			},
		);

		if (success) {
			props.data.eventBus.emit('publish', submitData);
			uiStore.closeModal(WORKFLOW_HISTORY_PUBLISH_MODAL_KEY);
		}
	},
);

formEventBus.on('cancel', () => {
	props.data.eventBus.emit('cancel');
});
</script>

<template>
	<WorkflowHistoryVersionFormModal
		:modal-name="WORKFLOW_HISTORY_PUBLISH_MODAL_KEY"
		:modal-title="i18n.baseText('workflows.publishModal.title')"
		:submit-button-label="i18n.baseText('workflows.publish')"
		:data="{
			...data,
			eventBus: formEventBus,
		}"
	/>
</template>
