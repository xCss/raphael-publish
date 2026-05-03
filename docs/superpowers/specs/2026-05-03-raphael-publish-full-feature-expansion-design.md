# Raphael Publish Full Feature Expansion Design

## Overview

Add a single settings surface for the current local-first markdown editor. The settings surface will live behind a new gear button in the header, open as a right-side drawer on desktop and a sheet/dialog on mobile, and preserve the current split editor/preview workspace in the background.

This design covers four areas:
1. Settings entry and panel shell.
2. Opt-in persistent pasted-image storage.
3. Local AI provider configuration and writing helpers.
4. Local quality checks and optional AI-powered review.

The guiding principle is conservative defaults: nothing new should change the current editing flow unless the user explicitly enables it.

## Goals

- Add a discoverable settings entry near the existing GitHub action.
- Preserve the current split editor/preview layout and header as the background context.
- Keep pasted-image persistence opt-in and device-local.
- Allow users to configure AI endpoints without requiring a backend.
- Add quality checks that still work when AI is unavailable.
- Keep the editor fast and local-first by default.

## Non-Goals

- No account system.
- No cloud sync.
- No backend proxy or secret vault.
- No rewrite of the editor/preview architecture.
- No mandatory AI usage.

## Current Baseline

Relevant current patterns:
- `src/App.tsx` owns top-level UI state, layout switching, and persistence wiring.
- `src/components/Header.tsx` contains the GitHub link and theme toggle.
- `src/components/ThemeSelector.tsx` already uses an overlay/backdrop pattern.
- `src/lib/localDraft.ts` persists markdown drafts and preferences in `localStorage`.
- `src/lib/htmlToMarkdown.ts` handles paste conversion and currently treats `blob:` images as session-only.
- `src/components/PwaStatus.tsx` shows transient status in a floating toast.

The design should reuse these patterns rather than introduce a second app shell.

## Proposed UX

### Entry Point

Add a gear/settings button in the header, placed next to the GitHub icon and theme toggle cluster. This button opens the settings surface.

### Panel Behavior

- **Desktop**: right-side drawer overlay that sits above the current editor/preview split.
- **Mobile**: sheet/dialog with the same sections and ordering.
- The underlying split editor/preview stays visible behind the overlay so the user never feels like they left the editor.
- Closing the settings panel should never discard unsaved settings changes unless the design explicitly requires a save button.

### Mobile Panel Details

- On narrow screens, the settings surface should become a bottom sheet or full-height dialog rather than a narrow right drawer.
- The sheet should preserve the existing mobile editor/preview tab flow in the background and use a modal scrim to separate foreground settings from the editor.
- The sheet should include a visible drag handle or clear header affordance, a close button, and a sticky footer for primary actions when save/reset actions are present.
- Touch targets must be at least 44px tall, with visible labels for toggles and inputs.
- The content area should scroll independently inside the sheet, while the page behind it should not scroll.
- Dismissing with ESC, close button, or backdrop should be supported; if there are unsaved changes, dismissal should ask for confirmation or preserve changes automatically.
- Mobile should not introduce a second navigation model. It reuses the same four sections: Appearance, Drafts & Images, AI Writing, and Quality Checks.

### Panel Sections

1. Appearance
2. Drafts & Images
3. AI Writing
4. Quality Checks

This order matches dependency: visual preference first, storage second, AI third, checks last.

## Feature 1: Settings Shell

### Purpose
Provide one central place for all opt-in capabilities without cluttering the header.

### UI Contents
- Title and close button.
- Section navigation or stacked cards.
- Save / Reset actions.
- Optional status text for unsaved changes.

### Interaction Rules
- Settings can be opened and closed without navigating away.
- The panel should be keyboard accessible.
- ESC closes the panel.
- Clicking outside closes the panel only if there are no destructive changes pending, or after a confirmation step.

### Data Model
The settings UI is not a separate store; it edits existing app preferences plus new settings namespaces.

Suggested logical settings groups:
- appearance
- draftsImages
- ai
- qualityChecks

## Feature 2: Persistent Pasted Images

### Purpose
Move from session-only `blob:` previews to optional device-local persistence for users who want durable pasted screenshots.

### Default Behavior
- Off by default.
- Current lightweight `blob:` preview flow remains the default.
- If disabled, pasted images behave exactly like today.

### When Enabled
- Pasted images are stored in IndexedDB.
- Draft markdown stores references to those images rather than raw blob URLs.
- References are tied to the draft identity so cleanup can be deterministic.

### Data Model
Use a small metadata layer plus blob storage.

Draft image record:
- `id`
- `draftId`
- `createdAt`
- `lastUsedAt`
- `mimeType`
- `size`
- `storageKey`
- optional `altText`

Draft record enhancement:
- draft content can contain image reference tokens or a stable local URI format that maps to IndexedDB records.

### Cleanup Rules
- Deleting a draft deletes linked images.
- Replacing/removing an image unlinks the old blob and schedules it for cleanup.
- A periodic garbage-collection pass removes orphan images.
- Storage quota limits must be enforced.

### UI Requirements
- Toggle: “Persist pasted images on this device”
- Storage usage display
- Clear cached images action
- Optional warning when storage is near limit

### Risk Controls
- Large images should be compressed or normalized before storage when practical.
- The design must define a maximum allowed image size.
- Any write failure should degrade gracefully to session-only blob preview.

## Feature 3: AI Writing Configuration

### Purpose
Allow users to connect the editor to a user-provided AI endpoint for rewrite and assistive writing features.

### Inputs
- `BASE_URL`
- `API_KEY`
- `MODEL`

### Storage
- Local-only persistence.
- The design may support either `localStorage` or IndexedDB for the config payload, but the API key must be clearly labeled as browser-local and not truly secret.
- Provide an explicit “remember API key” choice if persistence is optional.

### Mandatory Guardrails
- Connection test before first use.
- Clear warning that this is browser-local storage.
- Clear warning that the endpoint must support browser CORS.
- No hidden background calls without user action.

### UX
- A compact provider configuration card.
- Save, test, and clear actions.
- Status text for connection success/failure.
- Model selection field.

### Security Position
This is a convenience feature, not a secret-management system. The UI must not imply stronger secrecy than the browser can provide.

## Feature 4: Quality Checks

### Purpose
Help users catch issues before copying/publishing.

### Two Layers

#### Local checks
Always available, no AI required.
Examples:
- heading level jumps
- missing image alt text
- overly long paragraphs
- obvious empty links
- repeated blank lines

#### AI checks
Available only if AI is configured and enabled.
Examples:
- title clarity
- structure feedback
- readability suggestions
-公众号适配建议

### UX
- Quality checks section lives in settings.
- Local checks can run even when AI is off.
- AI checks should clearly indicate when they depend on connectivity.
- Results should be advisory, not blocking.

## Architecture

### Shell Layer
- `App.tsx` holds the top-level panel open/close state.
- `Header.tsx` receives a new settings action prop.
- The overlay component should be a reusable shell, not hardcoded into the header.

### Persistence Layer
- Keep existing `localDraft.ts` for draft text and preferences.
- Add a new image storage module for IndexedDB.
- Add a new AI settings storage module.
- Keep responsibilities separated so draft text, images, and AI config can evolve independently.

### AI Layer
- Add a minimal request wrapper that can call a configured provider.
- Keep request construction and validation separate from UI.
- The UI should not know provider-specific payload details beyond the configured base URL, key, and model.

### Quality Check Layer
- Split local checks from AI checks.
- Local checks should operate directly on the markdown AST / rendered structure.
- AI checks should consume a compact summary, not the full app state.

## Recommended Phasing

### Phase 1
- Settings entry and drawer/sheet shell
- Appearance section
- Drafts & Images section scaffold

### Phase 2
- Opt-in IndexedDB image persistence
- Draft-image binding and cleanup
- Storage usage display

### Phase 3
- AI config form
- Provider connection test
- Local persistence of AI settings

### Phase 4
- Local quality checks
- AI-assisted quality checks
- Result presentation and failure handling

## Error Handling

- If the settings panel fails to open, the editor must still work normally.
- If IndexedDB is unavailable or quota is exceeded, fall back to session-only blob previews.
- If AI config fails validation, keep the editor functional and show a non-blocking error.
- If the AI provider returns a CORS or network error, show a clear message and preserve the draft.
- If quality checks fail, display results but do not block copy/export.

## Testing Strategy

### Unit Tests
- settings state save/load
- image reference cleanup rules
- draft unlinking behavior
- AI settings validation
- local quality-check rules

### Integration Tests
- settings button opens/closes overlay
- persisted images survive reload when enabled
- AI config persists locally
- local quality checks render results without AI

### E2E Tests
- open settings from header
- toggle persistent images and paste a screenshot
- configure AI endpoint
- run a quality check on a sample draft

## Acceptance Criteria

- The current split editor/preview layout remains intact behind settings.
- Settings open from the header and close cleanly.
- Persistent image storage is opt-in and fully cleaned up when drafts/images are removed.
- AI configuration is local-only and testable.
- Quality checks are available without forcing AI.
- The editor remains usable even if image persistence or AI features fail.

## Open Questions

- Should AI settings live in `localStorage` or IndexedDB?
- Should persistent image cleanup be immediate on delete or deferred via GC?
- Should quality checks appear only in Settings or also as a toolbar action?

