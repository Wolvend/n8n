# Improved Credentials Modal - Design Document

**Experiment:** `071_improved_credentials`
**Date:** 2026-02-03
**Status:** Ready for implementation

## Overview

Simplify the credential creation flow when users add credentials from a node on the canvas. The goal is to reduce friction so users connect fast and continue building their workflow.

### Key Changes

1. Rename "Credentials" to "Connect [App Name]" in this flow
2. New minimal "Quick Connect" modal replacing the full credential modal
3. New connection status pill replacing the credentials dropdown in nodes
4. OAuth credentials show connect button only, hide all fields
5. API key credentials show only essential fields, hide advanced options

### Scope

- **In scope:** Node-to-credential flow only (variant group)
- **Out of scope:** Credentials page, editing existing credentials, control group

## Modal UI Structure

### Container

- Small centered modal (~400px wide, height auto-fits content)
- No sidebar, no tabs
- Clean white background with subtle shadow
- Standard close X button top-right

### Header

- App icon (existing `CredentialIcon` component)
- Title: "Connect [App Name]" (e.g., "Connect Gmail")
- Subtitle: "to continue with your workflow"

### Body

**For OAuth credentials:**
- Single prominent button: "Sign in with Google" / "Connect with Slack"
- No other fields visible initially

**For API Key credentials:**
- Essential field(s) only (e.g., just "API Key" input for OpenAI)
- "Get your API key" link → opens provider's API key page
- "?" icon → opens n8n docs for that credential

### Advanced Section

- Collapsed accordion: "Advanced settings"
- Contains all other credential properties
- Only shown if there ARE additional properties beyond essentials

### Footer

- "Cancel" link (text only)
- "Save" primary button (disabled until required fields filled / OAuth connected)

## States

### Success State

- Replaces form content in same modal
- Green checkmark icon
- "Connected!" heading
- Subtext: "[App Name] is ready to use"
- "Done" primary button → closes modal, auto-selects credential in node

### Error State

- Inline error banner: "Connection failed" + reason
- Form remains visible for retry
- Two actions:
  - "Try again" (primary)
  - "Open full settings" (secondary) → opens full credential modal

### Loading State

- Spinner on button
- Button text: "Connecting..."
- Form fields disabled

## Credential Picker Redesign

### Disconnected State

- "Connect [App Name]" button (primary style)
- Clicking opens QuickConnectModal

### Connected State

- Pill/chip: `[App Icon] [Credential Name] ✓ ▾`
- Example: `[G] Gmail account ✓ ▾`
- Click opens popover with:
  - List of other available credentials
  - Divider
  - "+ Connect another [App]" option

## Essential Fields Mapping

| Credential | Essential Fields | Advanced (Hidden) |
|------------|------------------|-------------------|
| OpenAI | API Key | Organization ID, Base URL |
| Anthropic | API Key | Base URL |
| Gemini | API Key | - |
| Telegram | Bot Token | - |
| Supabase | Host, Service Role Secret | - |
| Postgres | Host, Database, User, Password | Port, SSL, SSH Tunnel |

### "Get your API key" Links

- **OpenAI:** https://platform.openai.com/api-keys
- **Anthropic:** https://console.anthropic.com/settings/keys
- **Gemini:** https://aistudio.google.com/apikey
- **Telegram:** Link to BotFather instructions
- **Supabase:** https://supabase.com/dashboard/project/_/settings/api

### Logic for Other Credentials

1. Fields marked as required in credential type definition → essential
2. Credentials in curated list → use mapping above
3. Credentials NOT in list → show all fields, still use simplified modal chrome

## Implementation Architecture

### New Components

```
src/features/credentials/components/QuickConnect/
├── QuickConnectModal.vue      # Main modal wrapper
├── QuickConnectForm.vue       # Form content, handles states
├── CredentialConnectionStatus.vue  # Replaces dropdown in nodes
└── essentialFields.ts         # Field mapping & API key URLs
```

### Modified Components

- **`CredentialPicker.vue`** - Check experiment variant, branch to new flow
- **`ui.store.ts`** - Add `QUICK_CONNECT_MODAL_KEY`

### Unchanged

- `CredentialEdit.vue` (full modal stays intact)
- `CredentialsView.vue` (credentials page)
- Backend/API
- Credential type definitions

## Telemetry

### Events

1. **`credential_quick_connect_modal_opened`**
   - `credential_type`, `node_type`, `is_oauth`

2. **`credential_quick_connect_completed`**
   - `credential_type`, `node_type`, `time_to_complete_ms`, `used_advanced_settings`

3. **`credential_quick_connect_failed`**
   - `credential_type`, `node_type`, `error_type`, `opened_full_settings`

4. **`credential_quick_connect_abandoned`**
   - `credential_type`, `node_type`, `stage`

### Success Metrics

Compare control vs variant:
- Completion rate (started → connected)
- Time to complete
- Drop-off rate
- % who need "Open full settings"
- % who expand "Advanced settings"

## Target Credentials

Based on most popular nodes:

**OAuth (one-click connect):**
- Google Sheets, Gmail, Google Drive
- Slack
- Microsoft Excel 365
- Notion
- Discord
- Airtable

**API Key (essential fields curated):**
- OpenAI
- Anthropic
- Gemini
- Telegram
- Supabase
- Postgres

**No credentials needed:**
- AI Agent, Webhook, Code, Form (n8n native nodes)
