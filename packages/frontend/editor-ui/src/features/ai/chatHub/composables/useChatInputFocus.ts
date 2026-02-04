import { shouldIgnoreCanvasShortcut } from '@/features/workflows/canvas/canvas.utils';
import { useUIStore } from '@/app/stores/ui.store';
import { useActiveElement, useEventListener } from '@vueuse/core';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { computed, toValue } from 'vue';

interface ChatInputRef {
	focus: () => void;
	setText: (text: string) => void;
}

export function useChatInputFocus(
	inputRef: Ref<ChatInputRef | null | undefined>,
	options?: {
		disabled?: MaybeRefOrGetter<boolean>;
	},
) {
	const uiStore = useUIStore();
	const activeElement = useActiveElement();

	const isDisabled = computed(() => toValue(options?.disabled) ?? false);

	const shouldIgnoreKeypress = computed(() => {
		if (isDisabled.value) return true;
		if (uiStore.isAnyModalOpen) return true;
		if (activeElement.value && shouldIgnoreCanvasShortcut(activeElement.value)) return true;
		return false;
	});

	function isPrintableKey(event: KeyboardEvent): boolean {
		return event.key.length === 1;
	}

	function hasModifierKey(event: KeyboardEvent): boolean {
		return event.ctrlKey || event.metaKey || event.altKey;
	}

	function onKeyDown(event: KeyboardEvent) {
		if (shouldIgnoreKeypress.value) return;
		if (event.isComposing) return;
		if (event.repeat) return;
		if (hasModifierKey(event)) return;
		if (!isPrintableKey(event)) return;

		const input = inputRef.value;
		if (!input) return;

		event.preventDefault();
		input.setText(event.key);
		input.focus();
	}

	useEventListener(document, 'keydown', onKeyDown);
}
