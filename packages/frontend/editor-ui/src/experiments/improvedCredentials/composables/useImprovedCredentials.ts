import { useImprovedCredentialsStore } from '../stores/improvedCredentials.store';

export function useImprovedCredentials() {
	const store = useImprovedCredentialsStore();

	return {
		isEnabled: store.isFeatureEnabled,
	};
}
