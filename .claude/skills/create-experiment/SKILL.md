---
name: create-experiment
description: Sets up a new A/B experiment in the n8n frontend. Use when creating experiments, feature flags, or A/B tests, or when the user says /experiment or asks to create a new experiment.
allowed-tools: Bash(mkdir:*), Read, Write, Edit, Grep, Glob
---

# Create Experiment

Sets up a new A/B experiment in the n8n frontend editor-ui package using PostHog for variant assignment.

## Experiment System Overview

Experiments in n8n use:
- **PostHog** for variant assignment and tracking
- **Pinia** stores for state management
- **Vue 3 Composition API** for UI
- **Local storage** for persistence
- **Telemetry** for analytics

Location: `packages/frontend/editor-ui/src/experiments/`

## Steps

### 1. Gather Information

Ask the user for:
- **Experiment name**: A slug describing the feature (e.g., `sidebarExpanded`, `resourceCenter`)
- **Experiment number**: Check the highest number in `experiments.ts` and increment by 1
- **Variant type**: Binary (control/variant) or multi-variant
- **Variant names**: For multi-variant experiments (e.g., `variantStarterPack`, `variantSuggestedTemplates`)
- **Additional conditions**: Any extra enablement conditions (e.g., `userIsTrialing`, `isCloudDeployment`)
- **Complexity level**: Simple (composable only) or full (store, components, etc.)

### 2. Find Next Experiment Number

```bash
grep -E "createExperiment\('[0-9]+" packages/frontend/editor-ui/src/app/constants/experiments.ts | \
  sed "s/.*'\([0-9]*\).*/\1/" | sort -n | tail -1
```

Increment this number by 1 for the new experiment.

### 3. Create Experiment Folder Structure

For a **simple experiment** (just a composable):
```
experiments/{experimentName}/
├── index.ts
└── use{ExperimentName}Experiment.ts
```

For a **full experiment** (with store, components, etc.):
```
experiments/{experimentName}/
├── index.ts
├── constants.ts
├── stores/
│   └── {experimentName}.store.ts
├── components/
│   └── {ComponentName}.vue
├── composables/
│   └── use{FeatureName}.ts
└── data/
    └── {dataFile}.ts
```

### 4. Register the Experiment

Add to `packages/frontend/editor-ui/src/app/constants/experiments.ts`:

**Binary experiment:**
```typescript
export const {EXPERIMENT_NAME}_EXPERIMENT = createExperiment('{NUMBER}_{slug}');
```

**Multi-variant experiment:**
```typescript
export const {EXPERIMENT_NAME}_EXPERIMENT = createExperiment('{NUMBER}_{slug}', {
  control: 'control',
  variantA: 'variant-a',
  variantB: 'variant-b',
});
```

Then add to `EXPERIMENTS_TO_TRACK` array:
```typescript
export const EXPERIMENTS_TO_TRACK = [
  // ... existing experiments
  {EXPERIMENT_NAME}_EXPERIMENT.name,
] as const;
```

### 5. Create Store (if full experiment)

File: `experiments/{experimentName}/stores/{experimentName}.store.ts`

```typescript
import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { useLocalStorage } from '@vueuse/core';

import { usePostHog } from '@/app/stores/posthog.store';
import { useTelemetry } from '@/composables/useTelemetry';
import { {EXPERIMENT_NAME}_EXPERIMENT } from '@/app/constants';
import { STORES } from '@/app/constants';

export const use{ExperimentName}Store = defineStore(STORES.{EXPERIMENT_NAME}, () => {
  const posthogStore = usePostHog();
  const telemetry = useTelemetry();

  // Feature detection
  const isFeatureEnabled = computed(() => {
    return (
      posthogStore.getVariant({EXPERIMENT_NAME}_EXPERIMENT.name) ===
      {EXPERIMENT_NAME}_EXPERIMENT.variant
      // Add additional conditions here if needed
      // && cloudPlanStore.userIsTrialing
    );
  });

  // Local storage for persistence (optional)
  const dismissedRef = useLocalStorage('N8N_{FEATURE}_DISMISSED', false);
  const isDismissed = computed(() => dismissedRef.value);

  // Actions
  const dismiss = () => {
    dismissedRef.value = true;
    telemetry.track('User dismissed {feature name} callout');
  };

  // Telemetry
  const trackClick = (source: string) => {
    telemetry.track('User clicked {feature name}', { source });
  };

  return {
    isFeatureEnabled,
    isDismissed,
    dismiss,
    trackClick,
  };
});
```

### 6. Add Store Constant

Add to `packages/frontend/editor-ui/src/app/constants/stores.ts`:

```typescript
export const enum STORES {
  // ... existing stores
  {EXPERIMENT_NAME} = '{experimentName}',
}
```

### 7. Create Simple Composable (if simple experiment)

File: `experiments/{experimentName}/use{ExperimentName}Experiment.ts`

```typescript
import { computed } from 'vue';
import { usePostHog } from '@/app/stores/posthog.store';
import { {EXPERIMENT_NAME}_EXPERIMENT } from '@/app/constants';

export function use{ExperimentName}Experiment() {
  const posthogStore = usePostHog();

  const isEnabled = computed(() => {
    return (
      posthogStore.getVariant({EXPERIMENT_NAME}_EXPERIMENT.name) ===
      {EXPERIMENT_NAME}_EXPERIMENT.variant
    );
  });

  return {
    isEnabled,
  };
}
```

### 8. Create Barrel Export

File: `experiments/{experimentName}/index.ts`

For simple experiment:
```typescript
export * from './use{ExperimentName}Experiment';
```

For full experiment:
```typescript
export * from './stores/{experimentName}.store';
export * from './components/{ComponentName}.vue';
// Add other exports as needed
```

### 9. Create Component (if needed)

File: `experiments/{experimentName}/components/{ComponentName}.vue`

```vue
<script setup lang="ts">
import { use{ExperimentName}Store } from '../stores/{experimentName}.store';

const store = use{ExperimentName}Store();

const handleClick = () => {
  store.trackClick('component');
};
</script>

<template>
  <div :class="$style.container">
    <!-- Component content -->
  </div>
</template>

<style module lang="scss">
.container {
  // Use CSS variables from AGENTS.md
  padding: var(--spacing--sm);
  border-radius: var(--radius--lg);
}
</style>
```

## Naming Conventions

| Item | Convention | Example |
|------|------------|---------|
| Folder | camelCase | `sidebarExpanded` |
| Experiment constant | SCREAMING_SNAKE_CASE | `SIDEBAR_EXPANDED_EXPERIMENT` |
| Experiment name | `{number}_{snake_case}` | `067_sidebar_expanded` |
| Store name | use{Name}Store | `useSidebarExpandedStore` |
| Composable | use{Name}Experiment | `useSidebarExpandedExperiment` |
| LocalStorage key | `N8N_{NAME}` | `N8N_SIDEBAR_EXPANDED_DISMISSED` |

## Telemetry Events

Follow these naming conventions:
- `User clicked {feature}` - User interaction
- `User dismissed {feature} callout` - Dismissal action
- `User created {resource}` - Creation action
- `User is part of experiment` - Experiment participation

Always include relevant metadata:
```typescript
telemetry.track('User clicked feature', {
  source: 'button',
  experimentVariant: posthogStore.getVariant(EXPERIMENT.name),
});
```

## Integration

To use the experiment in the main app:

```typescript
// In any component
import { use{ExperimentName}Store } from '@/experiments/{experimentName}';

const store = use{ExperimentName}Store();

// Conditional rendering
<MyFeature v-if="store.isFeatureEnabled" />
```

## Example: Creating a Simple Experiment

Let's create `068_quick_actions` experiment:

1. Create folder: `experiments/quickActions/`
2. Add to `experiments.ts`:
   ```typescript
   export const QUICK_ACTIONS_EXPERIMENT = createExperiment('068_quick_actions');
   ```
3. Add to `EXPERIMENTS_TO_TRACK`
4. Create `useQuickActionsExperiment.ts`
5. Create `index.ts`

## Example: Creating a Full Experiment

For `069_onboarding_wizard`:

1. Create folder structure with stores/, components/
2. Add to `experiments.ts` with variants
3. Add store constant to `stores.ts`
4. Create Pinia store with feature detection
5. Create Vue components
6. Create barrel exports

## Checklist

- [ ] Experiment number is unique and sequential
- [ ] Experiment registered in `experiments.ts`
- [ ] Added to `EXPERIMENTS_TO_TRACK` array
- [ ] Store constant added (if full experiment)
- [ ] Pinia store created with `isFeatureEnabled`
- [ ] Telemetry tracking implemented
- [ ] LocalStorage key follows naming convention
- [ ] Barrel export created
- [ ] i18n used for all user-facing text
- [ ] CSS variables used for styling
