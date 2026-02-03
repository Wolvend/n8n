# Improved Credentials Modal - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement simplified credential creation modal for the `071_improved_credentials` experiment, improving the node-to-credential flow with a minimal "Quick Connect" modal and connection status pill.

**Architecture:** New Vue components in `QuickConnect/` folder, experiment-gated via existing `useImprovedCredentials` composable. OAuth credentials show one-click connect button, API key credentials show essential fields only with collapsible advanced section.

**Tech Stack:** Vue 3, TypeScript, Pinia, n8n design-system components, vitest for tests

---

## Task 1: Essential Fields Configuration

**Files:**
- Create: `src/features/credentials/components/QuickConnect/essentialFields.ts`
- Test: `src/features/credentials/components/QuickConnect/essentialFields.test.ts`

**Step 1: Write the failing test**

```typescript
// essentialFields.test.ts
import { describe, it, expect } from 'vitest';
import {
	getEssentialFields,
	getApiKeyUrl,
	isOAuthCredential,
	hasAdvancedFields,
} from './essentialFields';

describe('essentialFields', () => {
	describe('getEssentialFields', () => {
		it('returns curated essential fields for OpenAI', () => {
			const result = getEssentialFields('openAiApi');
			expect(result).toEqual(['apiKey']);
		});

		it('returns curated essential fields for Postgres', () => {
			const result = getEssentialFields('postgres');
			expect(result).toEqual(['host', 'database', 'user', 'password']);
		});

		it('returns null for uncurated credentials', () => {
			const result = getEssentialFields('unknownCredential');
			expect(result).toBeNull();
		});
	});

	describe('getApiKeyUrl', () => {
		it('returns URL for OpenAI', () => {
			const result = getApiKeyUrl('openAiApi');
			expect(result).toBe('https://platform.openai.com/api-keys');
		});

		it('returns null for credentials without URL', () => {
			const result = getApiKeyUrl('unknownCredential');
			expect(result).toBeNull();
		});
	});

	describe('isOAuthCredential', () => {
		it('returns true for Google OAuth credentials', () => {
			expect(isOAuthCredential('googleSheetsOAuth2Api')).toBe(true);
			expect(isOAuthCredential('gmailOAuth2')).toBe(true);
		});

		it('returns false for API key credentials', () => {
			expect(isOAuthCredential('openAiApi')).toBe(false);
		});
	});

	describe('hasAdvancedFields', () => {
		it('returns true when credential has more fields than essential', () => {
			// OpenAI has apiKey as essential but also organizationId and baseUrl
			const allFields = ['apiKey', 'organizationId', 'baseUrl'];
			expect(hasAdvancedFields('openAiApi', allFields)).toBe(true);
		});

		it('returns false when all fields are essential', () => {
			const allFields = ['apiKey'];
			expect(hasAdvancedFields('anthropicApi', allFields)).toBe(false);
		});
	});
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/frontend/editor-ui && pnpm test src/features/credentials/components/QuickConnect/essentialFields.test.ts`
Expected: FAIL - module not found

**Step 3: Write minimal implementation**

```typescript
// essentialFields.ts

/**
 * Curated mapping of credential types to their essential fields.
 * Essential fields are shown by default in the Quick Connect modal.
 * All other fields are hidden under "Advanced settings".
 */
export const ESSENTIAL_FIELDS: Record<string, string[]> = {
	// AI providers
	openAiApi: ['apiKey'],
	anthropicApi: ['apiKey'],
	googlePalmApi: ['apiKey'], // Gemini
	// Communication
	telegramApi: ['accessToken'],
	// Databases
	supabaseApi: ['host', 'serviceRole'],
	postgres: ['host', 'database', 'user', 'password'],
};

/**
 * URLs where users can get their API keys.
 * Shown as "Get your API key" link in the modal.
 */
export const API_KEY_URLS: Record<string, string> = {
	openAiApi: 'https://platform.openai.com/api-keys',
	anthropicApi: 'https://console.anthropic.com/settings/keys',
	googlePalmApi: 'https://aistudio.google.com/apikey',
	telegramApi: 'https://core.telegram.org/bots#botfather',
	supabaseApi: 'https://supabase.com/dashboard/project/_/settings/api',
};

/**
 * OAuth credential type patterns.
 * These credentials show a single "Connect" button instead of form fields.
 */
export const OAUTH_CREDENTIAL_PATTERNS = [
	'OAuth2',
	'oAuth2',
	'OAuth',
	'oAuth',
];

/**
 * Get the essential fields for a credential type.
 * Returns null if the credential type is not in the curated list.
 */
export function getEssentialFields(credentialType: string): string[] | null {
	return ESSENTIAL_FIELDS[credentialType] ?? null;
}

/**
 * Get the API key URL for a credential type.
 * Returns null if no URL is configured.
 */
export function getApiKeyUrl(credentialType: string): string | null {
	return API_KEY_URLS[credentialType] ?? null;
}

/**
 * Check if a credential type is OAuth-based.
 */
export function isOAuthCredential(credentialType: string): boolean {
	return OAUTH_CREDENTIAL_PATTERNS.some((pattern) =>
		credentialType.toLowerCase().includes(pattern.toLowerCase()),
	);
}

/**
 * Check if a credential has advanced fields beyond the essential ones.
 */
export function hasAdvancedFields(
	credentialType: string,
	allFieldNames: string[],
): boolean {
	const essential = getEssentialFields(credentialType);
	if (!essential) {
		// Not in curated list, no advanced section
		return false;
	}
	return allFieldNames.some((field) => !essential.includes(field));
}

/**
 * Partition fields into essential and advanced.
 */
export function partitionFields<T extends { name: string }>(
	credentialType: string,
	fields: T[],
): { essential: T[]; advanced: T[] } {
	const essentialNames = getEssentialFields(credentialType);

	if (!essentialNames) {
		// Not curated - show all fields as essential
		return { essential: fields, advanced: [] };
	}

	const essential: T[] = [];
	const advanced: T[] = [];

	for (const field of fields) {
		if (essentialNames.includes(field.name)) {
			essential.push(field);
		} else {
			advanced.push(field);
		}
	}

	// Sort essential fields to match the order in ESSENTIAL_FIELDS
	essential.sort(
		(a, b) => essentialNames.indexOf(a.name) - essentialNames.indexOf(b.name),
	);

	return { essential, advanced };
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/frontend/editor-ui && pnpm test src/features/credentials/components/QuickConnect/essentialFields.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/credentials/components/QuickConnect/essentialFields.ts src/features/credentials/components/QuickConnect/essentialFields.test.ts
git commit -m "feat(editor): Add essential fields configuration for Quick Connect modal"
```

---

## Task 2: Quick Connect Modal Constants

**Files:**
- Modify: `src/features/credentials/credentials.constants.ts`
- Modify: `src/app/stores/ui.store.ts:189-194`

**Step 1: Add modal key constant**

In `credentials.constants.ts`, add:

```typescript
export const QUICK_CONNECT_MODAL_KEY = 'quickConnect';
```

**Step 2: Register modal in UI store**

In `ui.store.ts`, find the `modals` state initialization around line 189 and add the new modal:

```typescript
[QUICK_CONNECT_MODAL_KEY]: {
	open: false,
	mode: 'new' as 'new' | 'edit',
	activeId: '',
	showAuthSelector: false,
},
```

Also add the import at the top:

```typescript
import { CREDENTIAL_EDIT_MODAL_KEY, CREDENTIAL_SELECT_MODAL_KEY, QUICK_CONNECT_MODAL_KEY } from '@/features/credentials/credentials.constants';
```

**Step 3: Add helper method for opening Quick Connect modal**

In `ui.store.ts`, add method near `openNewCredential` (around line 516):

```typescript
const openQuickConnectModal = (credentialType: string) => {
	openModalWithData({
		name: QUICK_CONNECT_MODAL_KEY,
		data: {
			credentialType,
			mode: 'new',
		},
	});
};
```

And export it in the return statement.

**Step 4: Commit**

```bash
git add src/features/credentials/credentials.constants.ts src/app/stores/ui.store.ts
git commit -m "feat(editor): Add Quick Connect modal constants and store setup"
```

---

## Task 3: Quick Connect Modal Component

**Files:**
- Create: `src/features/credentials/components/QuickConnect/QuickConnectModal.vue`
- Test: `src/features/credentials/components/QuickConnect/QuickConnectModal.test.ts`

**Step 1: Write the failing test**

```typescript
// QuickConnectModal.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createComponentRenderer } from '@/__tests__/render';
import { createTestingPinia } from '@pinia/testing';
import QuickConnectModal from './QuickConnectModal.vue';
import { QUICK_CONNECT_MODAL_KEY } from '../../credentials.constants';
import { mockedStore } from '@/__tests__/utils';
import { useUIStore } from '@/app/stores/ui.store';
import { useCredentialsStore } from '../../credentials.store';

vi.mock('vue-router', () => ({
	useRouter: () => ({ push: vi.fn(), resolve: vi.fn().mockReturnValue({ href: '' }) }),
	useRoute: () => ({}),
	RouterLink: vi.fn(),
}));

const renderComponent = createComponentRenderer(QuickConnectModal);

describe('QuickConnectModal', () => {
	beforeEach(() => {
		createTestingPinia();
	});

	it('should render modal with correct title for credential type', async () => {
		const uiStore = mockedStore(useUIStore);
		const credentialsStore = mockedStore(useCredentialsStore);

		uiStore.modalsById = {
			[QUICK_CONNECT_MODAL_KEY]: {
				open: true,
				data: { credentialType: 'openAiApi', mode: 'new' },
			},
		};

		credentialsStore.getCredentialTypeByName.mockReturnValue({
			name: 'openAiApi',
			displayName: 'OpenAI API',
			properties: [{ name: 'apiKey', displayName: 'API Key', type: 'string' }],
		});

		const { getByText } = renderComponent({
			props: { modalName: QUICK_CONNECT_MODAL_KEY },
		});

		expect(getByText('Connect OpenAI')).toBeInTheDocument();
	});

	it('should show OAuth button for OAuth credentials', async () => {
		const uiStore = mockedStore(useUIStore);
		const credentialsStore = mockedStore(useCredentialsStore);

		uiStore.modalsById = {
			[QUICK_CONNECT_MODAL_KEY]: {
				open: true,
				data: { credentialType: 'googleSheetsOAuth2Api', mode: 'new' },
			},
		};

		credentialsStore.getCredentialTypeByName.mockReturnValue({
			name: 'googleSheetsOAuth2Api',
			displayName: 'Google Sheets OAuth2 API',
			properties: [],
		});

		const { getByTestId } = renderComponent({
			props: { modalName: QUICK_CONNECT_MODAL_KEY },
		});

		expect(getByTestId('quick-connect-oauth-button')).toBeInTheDocument();
	});
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/frontend/editor-ui && pnpm test src/features/credentials/components/QuickConnect/QuickConnectModal.test.ts`
Expected: FAIL - component not found

**Step 3: Write the component**

```vue
<!-- QuickConnectModal.vue -->
<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import { N8nModal, N8nButton, N8nText, N8nIcon } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';
import { useTelemetry } from '@/app/composables/useTelemetry';
import { useUIStore } from '@/app/stores/ui.store';
import { useCredentialsStore } from '../../credentials.store';
import { useNDVStore } from '@/features/ndv/shared/ndv.store';
import { useWorkflowsStore } from '@/app/stores/workflows.store';
import { QUICK_CONNECT_MODAL_KEY, CREDENTIAL_EDIT_MODAL_KEY } from '../../credentials.constants';
import { getAppNameFromCredType } from '@/app/utils/nodeTypesUtils';
import { isOAuthCredential } from './essentialFields';
import QuickConnectForm from './QuickConnectForm.vue';
import CredentialIcon from '../CredentialIcon.vue';

const props = defineProps<{
	modalName: string;
}>();

const emit = defineEmits<{
	credentialCreated: [credentialId: string];
}>();

const i18n = useI18n();
const telemetry = useTelemetry();
const uiStore = useUIStore();
const credentialsStore = useCredentialsStore();
const ndvStore = useNDVStore();
const workflowsStore = useWorkflowsStore();

const modalOpenedAt = ref<number>(0);
const state = ref<'form' | 'success' | 'error'>('form');
const errorMessage = ref('');
const createdCredentialId = ref<string | null>(null);

const modalData = computed(() => {
	const modal = uiStore.modalsById[QUICK_CONNECT_MODAL_KEY];
	return modal?.data as { credentialType: string; mode: string } | undefined;
});

const credentialType = computed(() => {
	if (!modalData.value?.credentialType) return null;
	return credentialsStore.getCredentialTypeByName(modalData.value.credentialType);
});

const appName = computed(() => {
	if (!credentialType.value) return '';
	return getAppNameFromCredType(credentialType.value.displayName) || credentialType.value.displayName;
});

const isOAuth = computed(() => {
	if (!modalData.value?.credentialType) return false;
	return isOAuthCredential(modalData.value.credentialType);
});

const activeNode = computed(() => ndvStore.activeNode);

onMounted(() => {
	modalOpenedAt.value = Date.now();
	telemetry.track('credential_quick_connect_modal_opened', {
		credential_type: modalData.value?.credentialType,
		node_type: activeNode.value?.type,
		is_oauth: isOAuth.value,
		workflow_id: workflowsStore.workflowId,
	});
});

onUnmounted(() => {
	if (state.value === 'form') {
		telemetry.track('credential_quick_connect_abandoned', {
			credential_type: modalData.value?.credentialType,
			node_type: activeNode.value?.type,
			stage: 'before_connect',
		});
	}
});

function closeModal() {
	uiStore.closeModal(QUICK_CONNECT_MODAL_KEY);
}

function onSuccess(credentialId: string) {
	createdCredentialId.value = credentialId;
	state.value = 'success';

	telemetry.track('credential_quick_connect_completed', {
		credential_type: modalData.value?.credentialType,
		node_type: activeNode.value?.type,
		time_to_complete_ms: Date.now() - modalOpenedAt.value,
		used_advanced_settings: false, // TODO: track this from form
		workflow_id: workflowsStore.workflowId,
	});
}

function onError(message: string) {
	errorMessage.value = message;
	state.value = 'error';

	telemetry.track('credential_quick_connect_failed', {
		credential_type: modalData.value?.credentialType,
		node_type: activeNode.value?.type,
		error_type: 'connection_failed',
		opened_full_settings: false,
		workflow_id: workflowsStore.workflowId,
	});
}

function onRetry() {
	state.value = 'form';
	errorMessage.value = '';
}

function openFullSettings() {
	telemetry.track('credential_quick_connect_failed', {
		credential_type: modalData.value?.credentialType,
		node_type: activeNode.value?.type,
		error_type: 'user_opened_full_settings',
		opened_full_settings: true,
		workflow_id: workflowsStore.workflowId,
	});

	closeModal();
	if (modalData.value?.credentialType) {
		uiStore.openNewCredential(modalData.value.credentialType, true);
	}
}

function onDone() {
	if (createdCredentialId.value) {
		emit('credentialCreated', createdCredentialId.value);
	}
	closeModal();
}
</script>

<template>
	<N8nModal
		:name="props.modalName"
		:title="''"
		:center="true"
		:show-close="true"
		:width="'400px'"
		:class="$style.modal"
		@close="closeModal"
	>
		<template #header>
			<div :class="$style.header">
				<CredentialIcon
					v-if="credentialType"
					:credential-type-name="credentialType.name"
					:size="32"
				/>
				<div :class="$style.headerText">
					<N8nText :bold="true" size="large">
						{{ i18n.baseText('quickConnect.title', { interpolate: { appName } }) }}
					</N8nText>
					<N8nText size="small" color="text-light">
						{{ i18n.baseText('quickConnect.subtitle') }}
					</N8nText>
				</div>
			</div>
		</template>

		<template #content>
			<!-- Success State -->
			<div v-if="state === 'success'" :class="$style.successState">
				<div :class="$style.successIcon">
					<N8nIcon icon="check-circle" size="xlarge" color="success" />
				</div>
				<N8nText :bold="true" size="large">
					{{ i18n.baseText('quickConnect.success.title') }}
				</N8nText>
				<N8nText size="small" color="text-light">
					{{ i18n.baseText('quickConnect.success.subtitle', { interpolate: { appName } }) }}
				</N8nText>
			</div>

			<!-- Error State -->
			<div v-else-if="state === 'error'" :class="$style.content">
				<div :class="$style.errorBanner">
					<N8nIcon icon="exclamation-triangle" color="danger" />
					<N8nText size="small">
						{{ errorMessage || i18n.baseText('quickConnect.error.default') }}
					</N8nText>
				</div>
				<QuickConnectForm
					v-if="credentialType && modalData"
					:credential-type="credentialType"
					:credential-type-name="modalData.credentialType"
					@success="onSuccess"
					@error="onError"
				/>
			</div>

			<!-- Form State -->
			<div v-else :class="$style.content">
				<QuickConnectForm
					v-if="credentialType && modalData"
					:credential-type="credentialType"
					:credential-type-name="modalData.credentialType"
					@success="onSuccess"
					@error="onError"
				/>
			</div>
		</template>

		<template #footer>
			<div :class="$style.footer">
				<template v-if="state === 'success'">
					<N8nButton
						:label="i18n.baseText('quickConnect.done')"
						type="primary"
						data-test-id="quick-connect-done-button"
						@click="onDone"
					/>
				</template>
				<template v-else-if="state === 'error'">
					<N8nButton
						:label="i18n.baseText('quickConnect.openFullSettings')"
						type="secondary"
						data-test-id="quick-connect-full-settings-button"
						@click="openFullSettings"
					/>
					<N8nButton
						:label="i18n.baseText('quickConnect.tryAgain')"
						type="primary"
						data-test-id="quick-connect-retry-button"
						@click="onRetry"
					/>
				</template>
				<template v-else>
					<N8nButton
						:label="i18n.baseText('quickConnect.cancel')"
						type="tertiary"
						data-test-id="quick-connect-cancel-button"
						@click="closeModal"
					/>
				</template>
			</div>
		</template>
	</N8nModal>
</template>

<style lang="scss" module>
.modal {
	:global(.el-dialog__body) {
		padding: var(--spacing-sm) var(--spacing-lg);
	}
}

.header {
	display: flex;
	align-items: center;
	gap: var(--spacing-sm);
}

.headerText {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-4xs);
}

.content {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-sm);
}

.successState {
	display: flex;
	flex-direction: column;
	align-items: center;
	text-align: center;
	padding: var(--spacing-xl) 0;
	gap: var(--spacing-xs);
}

.successIcon {
	margin-bottom: var(--spacing-sm);
}

.errorBanner {
	display: flex;
	align-items: center;
	gap: var(--spacing-xs);
	padding: var(--spacing-xs) var(--spacing-sm);
	background-color: var(--color--danger--tint-4);
	border-radius: var(--radius);
	border: 1px solid var(--color--danger--tint-3);
}

.footer {
	display: flex;
	justify-content: flex-end;
	gap: var(--spacing-xs);
}
</style>
```

**Step 4: Run test to verify it passes**

Run: `cd packages/frontend/editor-ui && pnpm test src/features/credentials/components/QuickConnect/QuickConnectModal.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/credentials/components/QuickConnect/QuickConnectModal.vue src/features/credentials/components/QuickConnect/QuickConnectModal.test.ts
git commit -m "feat(editor): Add QuickConnectModal component"
```

---

## Task 4: Quick Connect Form Component

**Files:**
- Create: `src/features/credentials/components/QuickConnect/QuickConnectForm.vue`
- Test: `src/features/credentials/components/QuickConnect/QuickConnectForm.test.ts`

**Step 1: Write the failing test**

```typescript
// QuickConnectForm.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createComponentRenderer } from '@/__tests__/render';
import { createTestingPinia } from '@pinia/testing';
import QuickConnectForm from './QuickConnectForm.vue';
import { mockedStore } from '@/__tests__/utils';
import { useCredentialsStore } from '../../credentials.store';

vi.mock('vue-router', () => ({
	useRouter: () => ({ push: vi.fn(), resolve: vi.fn().mockReturnValue({ href: '' }) }),
	useRoute: () => ({}),
	RouterLink: vi.fn(),
}));

const renderComponent = createComponentRenderer(QuickConnectForm);

describe('QuickConnectForm', () => {
	beforeEach(() => {
		createTestingPinia();
	});

	it('should show OAuth button for OAuth credentials', () => {
		const credentialsStore = mockedStore(useCredentialsStore);

		const { getByTestId } = renderComponent({
			props: {
				credentialType: {
					name: 'googleSheetsOAuth2Api',
					displayName: 'Google Sheets OAuth2 API',
					properties: [],
				},
				credentialTypeName: 'googleSheetsOAuth2Api',
			},
		});

		expect(getByTestId('quick-connect-oauth-button')).toBeInTheDocument();
	});

	it('should show essential fields for API key credentials', () => {
		const credentialsStore = mockedStore(useCredentialsStore);

		const { getByTestId } = renderComponent({
			props: {
				credentialType: {
					name: 'openAiApi',
					displayName: 'OpenAI API',
					properties: [
						{ name: 'apiKey', displayName: 'API Key', type: 'string', required: true },
						{ name: 'organizationId', displayName: 'Organization ID', type: 'string' },
					],
				},
				credentialTypeName: 'openAiApi',
			},
		});

		// Should show API key field
		expect(getByTestId('quick-connect-field-apiKey')).toBeInTheDocument();
		// Organization ID should be in advanced section (collapsed)
		expect(getByTestId('quick-connect-advanced-toggle')).toBeInTheDocument();
	});

	it('should show "Get your API key" link when available', () => {
		const credentialsStore = mockedStore(useCredentialsStore);

		const { getByTestId } = renderComponent({
			props: {
				credentialType: {
					name: 'openAiApi',
					displayName: 'OpenAI API',
					properties: [{ name: 'apiKey', displayName: 'API Key', type: 'string' }],
				},
				credentialTypeName: 'openAiApi',
			},
		});

		expect(getByTestId('quick-connect-api-key-link')).toBeInTheDocument();
		expect(getByTestId('quick-connect-api-key-link')).toHaveAttribute(
			'href',
			'https://platform.openai.com/api-keys',
		);
	});
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/frontend/editor-ui && pnpm test src/features/credentials/components/QuickConnect/QuickConnectForm.test.ts`
Expected: FAIL - component not found

**Step 3: Write the component**

```vue
<!-- QuickConnectForm.vue -->
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ICredentialType, INodeProperties, ICredentialDataDecryptedObject } from 'n8n-workflow';
import {
	N8nButton,
	N8nText,
	N8nLink,
	N8nIcon,
	N8nCollapse,
	N8nCollapseItem,
	N8nTooltip,
} from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';
import { useCredentialsStore } from '../../credentials.store';
import { useUIStore } from '@/app/stores/ui.store';
import { useRootStore } from '@n8n/stores/useRootStore';
import { useProjectsStore } from '@/features/collaboration/projects/projects.store';
import { useToast } from '@/app/composables/useToast';
import CredentialInputs from '../CredentialEdit/CredentialInputs.vue';
import OauthButton from '../CredentialEdit/OauthButton.vue';
import GoogleAuthButton from '../CredentialEdit/GoogleAuthButton.vue';
import {
	isOAuthCredential,
	getApiKeyUrl,
	partitionFields,
	getEssentialFields,
} from './essentialFields';
import type { IUpdateInformation } from '@/Interface';

const props = defineProps<{
	credentialType: ICredentialType;
	credentialTypeName: string;
}>();

const emit = defineEmits<{
	success: [credentialId: string];
	error: [message: string];
}>();

const i18n = useI18n();
const credentialsStore = useCredentialsStore();
const uiStore = useUIStore();
const rootStore = useRootStore();
const projectsStore = useProjectsStore();
const toast = useToast();

const isLoading = ref(false);
const showAdvanced = ref(false);
const credentialData = ref<ICredentialDataDecryptedObject>({});
const credentialId = ref<string | null>(null);

const isOAuth = computed(() => isOAuthCredential(props.credentialTypeName));
const isGoogleOAuth = computed(() => props.credentialTypeName.toLowerCase().includes('google'));
const apiKeyUrl = computed(() => getApiKeyUrl(props.credentialTypeName));
const documentationUrl = computed(() => props.credentialType.documentationUrl || '');

const credentialProperties = computed<INodeProperties[]>(() => {
	return props.credentialType.properties || [];
});

const { essential: essentialProperties, advanced: advancedProperties } = computed(() => {
	return partitionFields(props.credentialTypeName, credentialProperties.value);
}).value;

const hasAdvancedProperties = computed(() => advancedProperties.length > 0);

const isEssentialFieldsFilled = computed(() => {
	const essentialFieldNames = getEssentialFields(props.credentialTypeName);
	if (!essentialFieldNames) {
		// Not curated - check required fields
		return credentialProperties.value
			.filter((p) => p.required)
			.every((p) => credentialData.value[p.name]);
	}
	return essentialFieldNames.every((name) => credentialData.value[name]);
});

const homeProject = computed(() => {
	return projectsStore.currentProject ?? projectsStore.personalProject;
});

// Initialize default values
watch(
	() => props.credentialType,
	(type) => {
		if (!type) return;
		for (const property of type.properties) {
			if (property.default !== undefined && credentialData.value[property.name] === undefined) {
				credentialData.value[property.name] = property.default as string;
			}
		}
	},
	{ immediate: true },
);

function onDataChange(data: IUpdateInformation) {
	credentialData.value = {
		...credentialData.value,
		[data.name]: data.value,
	};
}

async function saveCredential(): Promise<string | null> {
	try {
		const name = await credentialsStore.getNewCredentialName({
			credentialTypeName: props.credentialTypeName,
		});

		const newCredential = await credentialsStore.createNewCredential({
			name,
			type: props.credentialTypeName,
			data: credentialData.value,
			...(homeProject.value ? { projectId: homeProject.value.id } : {}),
		});

		return newCredential.id;
	} catch (error) {
		toast.showError(error, i18n.baseText('quickConnect.error.saveFailed'));
		return null;
	}
}

async function testCredential(id: string): Promise<boolean> {
	try {
		const result = await credentialsStore.testCredential({
			credentialId: id,
			credentialTypeName: props.credentialTypeName,
		});
		return result.status === 'OK';
	} catch {
		return false;
	}
}

async function onSave() {
	isLoading.value = true;
	try {
		const id = await saveCredential();
		if (!id) {
			emit('error', i18n.baseText('quickConnect.error.saveFailed'));
			return;
		}

		credentialId.value = id;
		const testPassed = await testCredential(id);

		if (testPassed) {
			emit('success', id);
		} else {
			emit('error', i18n.baseText('quickConnect.error.testFailed'));
		}
	} finally {
		isLoading.value = false;
	}
}

async function onOAuthConnect() {
	isLoading.value = true;
	try {
		// First save the credential
		const id = await saveCredential();
		if (!id) {
			emit('error', i18n.baseText('quickConnect.error.saveFailed'));
			return;
		}
		credentialId.value = id;

		// Then trigger OAuth flow
		// The OAuth flow will handle the success/error via callbacks
		// This is handled by the parent component watching for credential updates
	} finally {
		isLoading.value = false;
	}
}
</script>

<template>
	<div :class="$style.form">
		<!-- OAuth Flow -->
		<template v-if="isOAuth">
			<div :class="$style.oauthSection">
				<GoogleAuthButton
					v-if="isGoogleOAuth"
					data-test-id="quick-connect-oauth-button"
					:is-loading="isLoading"
					@click="onOAuthConnect"
				/>
				<OauthButton
					v-else
					:is-google-o-auth-type="false"
					data-test-id="quick-connect-oauth-button"
					@click="onOAuthConnect"
				/>
			</div>
		</template>

		<!-- API Key / Form Flow -->
		<template v-else>
			<!-- Essential Fields -->
			<div :class="$style.essentialFields">
				<CredentialInputs
					:credential-properties="essentialProperties"
					:credential-data="credentialData"
					:show-validation-warnings="false"
					data-test-id="quick-connect-essential-fields"
					@update="onDataChange"
				/>
			</div>

			<!-- API Key Help Link -->
			<div v-if="apiKeyUrl" :class="$style.helpLinks">
				<N8nLink
					:href="apiKeyUrl"
					:new-window="true"
					data-test-id="quick-connect-api-key-link"
				>
					<N8nIcon icon="external-link-alt" size="small" />
					{{ i18n.baseText('quickConnect.getApiKey') }}
				</N8nLink>
				<N8nTooltip
					v-if="documentationUrl"
					:content="i18n.baseText('quickConnect.viewDocs')"
					placement="top"
				>
					<N8nLink
						:href="documentationUrl"
						:new-window="true"
						data-test-id="quick-connect-docs-link"
					>
						<N8nIcon icon="question-circle" size="small" />
					</N8nLink>
				</N8nTooltip>
			</div>

			<!-- Advanced Settings -->
			<N8nCollapse
				v-if="hasAdvancedProperties"
				v-model="showAdvanced"
				:class="$style.advancedSection"
			>
				<N8nCollapseItem
					:title="i18n.baseText('quickConnect.advancedSettings')"
					name="advanced"
					data-test-id="quick-connect-advanced-toggle"
				>
					<CredentialInputs
						:credential-properties="advancedProperties"
						:credential-data="credentialData"
						:show-validation-warnings="false"
						data-test-id="quick-connect-advanced-fields"
						@update="onDataChange"
					/>
				</N8nCollapseItem>
			</N8nCollapse>

			<!-- Save Button -->
			<div :class="$style.saveSection">
				<N8nButton
					:label="isLoading ? i18n.baseText('quickConnect.connecting') : i18n.baseText('quickConnect.save')"
					:loading="isLoading"
					:disabled="!isEssentialFieldsFilled"
					type="primary"
					size="large"
					:class="$style.saveButton"
					data-test-id="quick-connect-save-button"
					@click="onSave"
				/>
			</div>
		</template>
	</div>
</template>

<style lang="scss" module>
.form {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-sm);
}

.oauthSection {
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: var(--spacing-lg) 0;
}

.essentialFields {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-xs);
}

.helpLinks {
	display: flex;
	align-items: center;
	gap: var(--spacing-sm);
	font-size: var(--font-size--2xs);
}

.advancedSection {
	margin-top: var(--spacing-xs);
	border: 1px solid var(--color--foreground);
	border-radius: var(--radius);
}

.saveSection {
	margin-top: var(--spacing-sm);
}

.saveButton {
	width: 100%;
}
</style>
```

**Step 4: Run test to verify it passes**

Run: `cd packages/frontend/editor-ui && pnpm test src/features/credentials/components/QuickConnect/QuickConnectForm.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/credentials/components/QuickConnect/QuickConnectForm.vue src/features/credentials/components/QuickConnect/QuickConnectForm.test.ts
git commit -m "feat(editor): Add QuickConnectForm component with essential fields and OAuth support"
```

---

## Task 5: Credential Connection Status Component

**Files:**
- Create: `src/features/credentials/components/QuickConnect/CredentialConnectionStatus.vue`
- Test: `src/features/credentials/components/QuickConnect/CredentialConnectionStatus.test.ts`

**Step 1: Write the failing test**

```typescript
// CredentialConnectionStatus.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createComponentRenderer } from '@/__tests__/render';
import { createTestingPinia } from '@pinia/testing';
import CredentialConnectionStatus from './CredentialConnectionStatus.vue';
import { mockedStore } from '@/__tests__/utils';
import { useCredentialsStore } from '../../credentials.store';
import userEvent from '@testing-library/user-event';

vi.mock('vue-router', () => ({
	useRouter: () => ({ push: vi.fn(), resolve: vi.fn().mockReturnValue({ href: '' }) }),
	useRoute: () => ({}),
	RouterLink: vi.fn(),
}));

const renderComponent = createComponentRenderer(CredentialConnectionStatus);

describe('CredentialConnectionStatus', () => {
	beforeEach(() => {
		createTestingPinia();
	});

	it('should show connect button when no credential selected', () => {
		const { getByTestId } = renderComponent({
			props: {
				appName: 'OpenAI',
				credentialType: 'openAiApi',
				selectedCredentialId: null,
				credentialOptions: [],
			},
		});

		expect(getByTestId('credential-connect-button')).toBeInTheDocument();
		expect(getByTestId('credential-connect-button')).toHaveTextContent('Connect OpenAI');
	});

	it('should show connected pill when credential selected', () => {
		const credentialsStore = mockedStore(useCredentialsStore);
		credentialsStore.getCredentialTypeByName.mockReturnValue({
			name: 'openAiApi',
			displayName: 'OpenAI API',
		});

		const { getByTestId } = renderComponent({
			props: {
				appName: 'OpenAI',
				credentialType: 'openAiApi',
				selectedCredentialId: 'cred-123',
				credentialOptions: [
					{ id: 'cred-123', name: 'My OpenAI Key', typeDisplayName: 'OpenAI API' },
				],
			},
		});

		expect(getByTestId('credential-connection-pill')).toBeInTheDocument();
		expect(getByTestId('credential-connection-pill')).toHaveTextContent('My OpenAI Key');
	});

	it('should show dropdown with other credentials when pill clicked', async () => {
		const credentialsStore = mockedStore(useCredentialsStore);
		credentialsStore.getCredentialTypeByName.mockReturnValue({
			name: 'openAiApi',
			displayName: 'OpenAI API',
		});

		const { getByTestId } = renderComponent({
			props: {
				appName: 'OpenAI',
				credentialType: 'openAiApi',
				selectedCredentialId: 'cred-123',
				credentialOptions: [
					{ id: 'cred-123', name: 'My OpenAI Key', typeDisplayName: 'OpenAI API' },
					{ id: 'cred-456', name: 'Work OpenAI', typeDisplayName: 'OpenAI API' },
				],
			},
		});

		await userEvent.click(getByTestId('credential-connection-pill'));

		expect(getByTestId('credential-option-cred-456')).toBeInTheDocument();
		expect(getByTestId('credential-connect-another')).toBeInTheDocument();
	});
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/frontend/editor-ui && pnpm test src/features/credentials/components/QuickConnect/CredentialConnectionStatus.test.ts`
Expected: FAIL - component not found

**Step 3: Write the component**

```vue
<!-- CredentialConnectionStatus.vue -->
<script setup lang="ts">
import { computed, ref } from 'vue';
import {
	N8nButton,
	N8nText,
	N8nIcon,
	N8nPopover,
} from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';
import { useCredentialsStore } from '../../credentials.store';
import CredentialIcon from '../CredentialIcon.vue';
import type { CredentialOption } from '../CredentialPicker/CredentialsDropdown.vue';

const props = defineProps<{
	appName: string;
	credentialType: string;
	selectedCredentialId: string | null;
	credentialOptions: CredentialOption[];
	disabled?: boolean;
}>();

const emit = defineEmits<{
	connect: [];
	select: [credentialId: string];
}>();

const i18n = useI18n();
const credentialsStore = useCredentialsStore();

const showPopover = ref(false);

const selectedCredential = computed(() => {
	if (!props.selectedCredentialId) return null;
	return props.credentialOptions.find((c) => c.id === props.selectedCredentialId);
});

const otherCredentials = computed(() => {
	return props.credentialOptions.filter((c) => c.id !== props.selectedCredentialId);
});

const credentialTypeInfo = computed(() => {
	return credentialsStore.getCredentialTypeByName(props.credentialType);
});

function onConnect() {
	emit('connect');
}

function onSelectCredential(credentialId: string) {
	showPopover.value = false;
	emit('select', credentialId);
}

function onConnectAnother() {
	showPopover.value = false;
	emit('connect');
}
</script>

<template>
	<div :class="$style.container">
		<!-- Disconnected State -->
		<N8nButton
			v-if="!selectedCredential"
			:label="i18n.baseText('credentialConnectionStatus.connect', { interpolate: { appName } })"
			type="primary"
			size="small"
			:disabled="props.disabled"
			data-test-id="credential-connect-button"
			@click="onConnect"
		/>

		<!-- Connected State -->
		<N8nPopover
			v-else
			v-model:visible="showPopover"
			trigger="click"
			placement="bottom-start"
			:width="250"
		>
			<template #reference>
				<button
					type="button"
					:class="$style.connectionPill"
					:disabled="props.disabled"
					data-test-id="credential-connection-pill"
				>
					<CredentialIcon
						v-if="credentialTypeInfo"
						:credential-type-name="credentialTypeInfo.name"
						:size="16"
					/>
					<N8nText size="small" :bold="true" :class="$style.pillText">
						{{ selectedCredential.name }}
					</N8nText>
					<N8nIcon icon="check" size="small" :class="$style.checkIcon" />
					<N8nIcon icon="chevron-down" size="small" :class="$style.chevron" />
				</button>
			</template>

			<div :class="$style.popoverContent">
				<!-- Other credentials -->
				<div v-if="otherCredentials.length > 0" :class="$style.credentialsList">
					<button
						v-for="credential in otherCredentials"
						:key="credential.id"
						type="button"
						:class="$style.credentialItem"
						:data-test-id="`credential-option-${credential.id}`"
						@click="onSelectCredential(credential.id)"
					>
						<CredentialIcon
							v-if="credentialTypeInfo"
							:credential-type-name="credentialTypeInfo.name"
							:size="16"
						/>
						<div :class="$style.credentialInfo">
							<N8nText size="small" :bold="true">{{ credential.name }}</N8nText>
							<N8nText v-if="credential.homeProject" size="small" color="text-light">
								{{ credential.homeProject.name }}
							</N8nText>
						</div>
					</button>
				</div>

				<!-- Divider -->
				<div v-if="otherCredentials.length > 0" :class="$style.divider" />

				<!-- Connect another -->
				<button
					type="button"
					:class="$style.connectAnother"
					data-test-id="credential-connect-another"
					@click="onConnectAnother"
				>
					<N8nIcon icon="plus" size="small" />
					<N8nText size="small">
						{{ i18n.baseText('credentialConnectionStatus.connectAnother', { interpolate: { appName } }) }}
					</N8nText>
				</button>
			</div>
		</N8nPopover>
	</div>
</template>

<style lang="scss" module>
.container {
	display: inline-flex;
}

.connectionPill {
	display: inline-flex;
	align-items: center;
	gap: var(--spacing--3xs);
	padding: var(--spacing--4xs) var(--spacing--xs);
	background-color: var(--color--success--tint-4);
	border: 1px solid var(--color--success--tint-3);
	border-radius: var(--radius--lg);
	cursor: pointer;
	transition: all 0.2s ease;

	&:hover:not(:disabled) {
		background-color: var(--color--success--tint-3);
	}

	&:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
}

.pillText {
	max-width: 150px;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.checkIcon {
	color: var(--color--success);
}

.chevron {
	color: var(--color--text--tint-1);
}

.popoverContent {
	display: flex;
	flex-direction: column;
}

.credentialsList {
	display: flex;
	flex-direction: column;
	padding: var(--spacing--4xs) 0;
}

.credentialItem {
	display: flex;
	align-items: center;
	gap: var(--spacing--xs);
	padding: var(--spacing--xs) var(--spacing--sm);
	background: none;
	border: none;
	cursor: pointer;
	text-align: left;
	width: 100%;

	&:hover {
		background-color: var(--color--background--light-2);
	}
}

.credentialInfo {
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.divider {
	height: 1px;
	background-color: var(--color--foreground);
	margin: var(--spacing--4xs) 0;
}

.connectAnother {
	display: flex;
	align-items: center;
	gap: var(--spacing--xs);
	padding: var(--spacing--xs) var(--spacing--sm);
	background: none;
	border: none;
	cursor: pointer;
	color: var(--color--primary);
	font-weight: var(--font-weight--bold);

	&:hover {
		background-color: var(--color--background--light-2);
	}
}
</style>
```

**Step 4: Run test to verify it passes**

Run: `cd packages/frontend/editor-ui && pnpm test src/features/credentials/components/QuickConnect/CredentialConnectionStatus.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/credentials/components/QuickConnect/CredentialConnectionStatus.vue src/features/credentials/components/QuickConnect/CredentialConnectionStatus.test.ts
git commit -m "feat(editor): Add CredentialConnectionStatus pill component"
```

---

## Task 6: Add i18n Translations

**Files:**
- Modify: `packages/@n8n/i18n/src/locales/en.json`

**Step 1: Add translations**

Add to the English locale file:

```json
{
	"quickConnect.title": "Connect {appName}",
	"quickConnect.subtitle": "to continue with your workflow",
	"quickConnect.success.title": "Connected!",
	"quickConnect.success.subtitle": "{appName} is ready to use",
	"quickConnect.error.default": "Connection failed. Please try again.",
	"quickConnect.error.saveFailed": "Failed to save credential",
	"quickConnect.error.testFailed": "Connection test failed. Please check your credentials.",
	"quickConnect.done": "Done",
	"quickConnect.cancel": "Cancel",
	"quickConnect.save": "Save",
	"quickConnect.connecting": "Connecting...",
	"quickConnect.tryAgain": "Try again",
	"quickConnect.openFullSettings": "Open full settings",
	"quickConnect.getApiKey": "Get your API key",
	"quickConnect.viewDocs": "View documentation",
	"quickConnect.advancedSettings": "Advanced settings",
	"credentialConnectionStatus.connect": "Connect {appName}",
	"credentialConnectionStatus.connectAnother": "Connect another {appName}"
}
```

**Step 2: Commit**

```bash
git add packages/@n8n/i18n/src/locales/en.json
git commit -m "feat(i18n): Add translations for Quick Connect modal"
```

---

## Task 7: Register Modal in Modals.vue

**Files:**
- Modify: `src/app/components/Modals.vue:45-47` (imports)
- Modify: `src/app/components/Modals.vue:129-133` (template)

**Step 1: Add import**

Add to imports at top of file:

```typescript
import { QUICK_CONNECT_MODAL_KEY } from '@/features/credentials/credentials.constants';
import QuickConnectModal from '@/features/credentials/components/QuickConnect/QuickConnectModal.vue';
```

**Step 2: Add modal registration in template**

Add after the `CREDENTIAL_EDIT_MODAL_KEY` ModalRoot (around line 133):

```vue
<ModalRoot :name="QUICK_CONNECT_MODAL_KEY">
	<template #default="{ modalName }">
		<QuickConnectModal :modal-name="modalName" />
	</template>
</ModalRoot>
```

**Step 3: Commit**

```bash
git add src/app/components/Modals.vue
git commit -m "feat(editor): Register QuickConnectModal in modal system"
```

---

## Task 8: Update CredentialPicker for Experiment

**Files:**
- Modify: `src/features/credentials/components/CredentialPicker/CredentialPicker.vue`
- Test: Update `src/features/credentials/components/CredentialPicker/CredentialPicker.test.ts`

**Step 1: Update the test**

Add new test cases:

```typescript
import { useImprovedCredentials } from '@/experiments/improvedCredentials';

vi.mock('@/experiments/improvedCredentials', () => ({
	useImprovedCredentials: vi.fn(() => ({ isEnabled: { value: false } })),
}));

describe('CredentialPicker with improved credentials experiment', () => {
	beforeEach(() => {
		createTestingPinia();
		credentialsStore = mockedStore(useCredentialsStore);
		credentialsStore.state.credentials = TEST_CREDENTIALS;
		credentialsStore.state.credentialTypes = TEST_CREDENTIAL_TYPES;
	});

	it('should show CredentialConnectionStatus when experiment is enabled and has credentials', () => {
		vi.mocked(useImprovedCredentials).mockReturnValue({
			isEnabled: { value: true },
		});

		const { getByTestId } = renderComponent({
			props: {
				appName: 'OpenAI',
				credentialType: 'openAiApi',
				selectedCredentialId: 'cred-123',
			},
		});

		expect(getByTestId('credential-connection-pill')).toBeInTheDocument();
	});

	it('should show connect button when experiment is enabled and no credentials', () => {
		vi.mocked(useImprovedCredentials).mockReturnValue({
			isEnabled: { value: true },
		});

		credentialsStore.state.credentials = {};

		const { getByTestId } = renderComponent({
			props: {
				appName: 'OpenAI',
				credentialType: 'openAiApi',
				selectedCredentialId: null,
			},
		});

		expect(getByTestId('credential-connect-button')).toBeInTheDocument();
	});

	it('should open QuickConnectModal when connect clicked in experiment', async () => {
		vi.mocked(useImprovedCredentials).mockReturnValue({
			isEnabled: { value: true },
		});

		const uiStore = mockedStore(useUIStore);
		credentialsStore.state.credentials = {};

		const { getByTestId } = renderComponent({
			props: {
				appName: 'OpenAI',
				credentialType: 'openAiApi',
				selectedCredentialId: null,
			},
		});

		await userEvent.click(getByTestId('credential-connect-button'));

		expect(uiStore.openQuickConnectModal).toHaveBeenCalledWith('openAiApi');
	});
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/frontend/editor-ui && pnpm test src/features/credentials/components/CredentialPicker/CredentialPicker.test.ts`
Expected: FAIL - new tests fail

**Step 3: Update the component**

Modify `CredentialPicker.vue`:

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { listenForModalChanges, useUIStore } from '@/app/stores/ui.store';
import { listenForCredentialChanges, useCredentialsStore } from '../../credentials.store';
import { assert } from '@n8n/utils/assert';
import CredentialsDropdown from './CredentialsDropdown.vue';
import CredentialConnectionStatus from '../QuickConnect/CredentialConnectionStatus.vue';
import { useI18n } from '@n8n/i18n';
import { CREDENTIAL_EDIT_MODAL_KEY, QUICK_CONNECT_MODAL_KEY } from '../../credentials.constants';
import { useImprovedCredentials } from '@/experiments/improvedCredentials';

import { N8nButton, N8nIconButton, N8nTooltip } from '@n8n/design-system';
import { getResourcePermissions } from '@n8n/permissions';
import { useProjectsStore } from '@/features/collaboration/projects/projects.store';
import { useToast } from '@/app/composables/useToast';
import type { ICredentialsDecryptedResponse, ICredentialsResponse } from '../../credentials.types';
import { useMessage } from '@/app/composables/useMessage';
import { MODAL_CONFIRM } from '@/app/constants';

// ... existing props and emits ...

const { isEnabled: isImprovedCredentialsEnabled } = useImprovedCredentials();

// ... existing code ...

const createNewCredential = () => {
	if (isImprovedCredentialsEnabled.value) {
		uiStore.openQuickConnectModal(props.credentialType);
	} else {
		uiStore.openNewCredential(props.credentialType, true);
	}
	wasModalOpenedFromHere.value = true;
	emit('credentialModalOpened', undefined);
};

// ... rest of existing code ...

// Update modal listener to include QUICK_CONNECT_MODAL_KEY
listenForModalChanges({
	store: uiStore,
	onModalClosed(modalName) {
		if (
			(modalName === CREDENTIAL_EDIT_MODAL_KEY || modalName === QUICK_CONNECT_MODAL_KEY) &&
			wasModalOpenedFromHere.value
		) {
			wasModalOpenedFromHere.value = false;
		}
	},
});
</script>

<template>
	<div>
		<!-- Improved Credentials Experiment -->
		<template v-if="isImprovedCredentialsEnabled">
			<CredentialConnectionStatus
				:app-name="props.appName"
				:credential-type="props.credentialType"
				:selected-credential-id="props.selectedCredentialId"
				:credential-options="credentialOptions"
				:disabled="!credentialPermissions.create"
				data-test-id="credential-connection-status"
				@connect="createNewCredential"
				@select="onCredentialSelected"
			/>
		</template>

		<!-- Control Group (existing behavior) -->
		<template v-else>
			<div v-if="credentialOptions.length > 0 || props.hideCreateNew" :class="$style.dropdown">
				<!-- ... existing dropdown code ... -->
			</div>

			<N8nButton
				v-else-if="!props.hideCreateNew"
				:label="`Create new ${props.appName} credential`"
				data-test-id="create-credential"
				:disabled="!credentialPermissions.create"
				@click="createNewCredential"
			/>
		</template>
	</div>
</template>
```

**Step 4: Run test to verify it passes**

Run: `cd packages/frontend/editor-ui && pnpm test src/features/credentials/components/CredentialPicker/CredentialPicker.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/features/credentials/components/CredentialPicker/CredentialPicker.vue src/features/credentials/components/CredentialPicker/CredentialPicker.test.ts
git commit -m "feat(editor): Integrate Quick Connect flow in CredentialPicker for experiment"
```

---

## Task 9: Create Index File for QuickConnect Components

**Files:**
- Create: `src/features/credentials/components/QuickConnect/index.ts`

**Step 1: Create index file**

```typescript
// index.ts
export { default as QuickConnectModal } from './QuickConnectModal.vue';
export { default as QuickConnectForm } from './QuickConnectForm.vue';
export { default as CredentialConnectionStatus } from './CredentialConnectionStatus.vue';
export * from './essentialFields';
```

**Step 2: Commit**

```bash
git add src/features/credentials/components/QuickConnect/index.ts
git commit -m "chore(editor): Add index file for QuickConnect components"
```

---

## Task 10: Run Full Test Suite and Typecheck

**Step 1: Run typecheck**

Run: `cd packages/frontend/editor-ui && pnpm typecheck`
Expected: PASS with no errors

**Step 2: Run linter**

Run: `cd packages/frontend/editor-ui && pnpm lint`
Expected: PASS or fix any issues

**Step 3: Run all credential-related tests**

Run: `cd packages/frontend/editor-ui && pnpm test src/features/credentials`
Expected: All tests PASS

**Step 4: Commit any fixes**

```bash
git add -A
git commit -m "fix(editor): Fix lint and type errors in Quick Connect implementation"
```

---

## Summary

This implementation plan creates:

1. **Essential fields configuration** (`essentialFields.ts`) - Maps credential types to their essential vs. advanced fields
2. **QuickConnectModal** - Minimal modal for connecting apps
3. **QuickConnectForm** - Form handling OAuth and API key flows
4. **CredentialConnectionStatus** - Pill component replacing the dropdown
5. **i18n translations** - All user-facing strings
6. **CredentialPicker integration** - Experiment-gated switch between old and new flows

The experiment is controlled by the existing `useImprovedCredentials` composable, which checks the PostHog feature flag `071_improved_credentials`.
