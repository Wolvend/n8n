import { computed, watch } from 'vue';
import { defineStore } from 'pinia';

import { usePostHog } from '@/app/stores/posthog.store';
import { useTelemetry } from '@/app/composables/useTelemetry';
import { IMPROVED_CREDENTIALS_EXPERIMENT } from '@/app/constants';
import { STORES } from '@n8n/stores';

export const useImprovedCredentialsStore = defineStore(
	STORES.EXPERIMENT_IMPROVED_CREDENTIALS,
	() => {
		const posthogStore = usePostHog();
		const telemetry = useTelemetry();

		const isFeatureEnabled = computed(() => {
			return (
				posthogStore.getVariant(IMPROVED_CREDENTIALS_EXPERIMENT.name) ===
				IMPROVED_CREDENTIALS_EXPERIMENT.variant
			);
		});

		// Track experiment participation
		const trackExperimentParticipation = () => {
			const variant = posthogStore.getVariant(IMPROVED_CREDENTIALS_EXPERIMENT.name);
			if (variant) {
				telemetry.track('User is part of experiment', {
					name: IMPROVED_CREDENTIALS_EXPERIMENT.name,
					variant,
				});
			}
		};

		let hasTrackedExperiment = false;
		watch(
			() => isFeatureEnabled.value,
			(enabled) => {
				if (enabled && !hasTrackedExperiment) {
					hasTrackedExperiment = true;
					trackExperimentParticipation();
				}
			},
			{ immediate: true },
		);

		return {
			isFeatureEnabled,
		};
	},
);
