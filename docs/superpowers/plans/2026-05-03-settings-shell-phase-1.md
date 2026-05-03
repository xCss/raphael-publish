# Settings Shell Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Phase 1 settings entry and responsive settings panel shell without changing the current editor/preview layout.

**Architecture:** `App.tsx` owns the panel open state. `Header.tsx` exposes a settings button callback. A new `SettingsPanel` component renders the desktop right drawer and mobile sheet/dialog using the existing visual language and four placeholder sections.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Framer Motion, Lucide icons, Playwright E2E.

---

## Files

- Modify: `src/App.tsx` — add settings open state and mount panel.
- Modify: `src/components/Header.tsx` — add settings button near GitHub/theme actions.
- Create: `src/components/SettingsPanel.tsx` — responsive overlay shell with four sections.
- Modify: `e2e/app.spec.ts` — add settings open/close and mobile sheet checks.
- Modify: `docs/superpowers/specs/2026-05-03-raphael-publish-full-feature-expansion-design.md` — already updated with mobile sheet details.

---

### Task 1: E2E coverage for settings panel

- [ ] Add a test that opens the settings button and expects `data-testid="settings-panel"`.
- [ ] Assert section labels: Appearance, Drafts & Images, AI Writing, Quality Checks.
- [ ] Assert the editor and preview roots remain present while the panel is open.
- [ ] Add a mobile viewport variant that verifies the panel opens as a modal/sheet and closes.
- [ ] Run: `pnpm test:e2e -- e2e/app.spec.ts` and confirm the new test fails before implementation.

### Task 2: Settings button in Header

- [ ] Add `onOpenSettings` to `HeaderProps`.
- [ ] Add a Lucide `Settings` icon button near GitHub and theme toggle.
- [ ] Add `aria-label="打开设置"` and `data-testid="settings-button"`.
- [ ] Preserve existing GitHub and theme buttons.

### Task 3: SettingsPanel component

- [ ] Create `src/components/SettingsPanel.tsx`.
- [ ] Props: `open: boolean`, `onClose: () => void`.
- [ ] Render nothing when closed.
- [ ] Render fixed scrim with `data-testid="settings-backdrop"`.
- [ ] Render `data-testid="settings-panel"` with desktop right drawer and mobile bottom/full-height sheet behavior.
- [ ] Include four placeholder cards: Appearance, Drafts & Images, AI Writing, Quality Checks.
- [ ] Add close button with `aria-label="关闭设置"` and `data-testid="settings-close"`.
- [ ] Lock background scroll while open.
- [ ] Support ESC close.

### Task 4: App integration

- [ ] Add `isSettingsOpen` state in `App.tsx`.
- [ ] Pass `onOpenSettings={() => setIsSettingsOpen(true)}` to `Header`.
- [ ] Mount `SettingsPanel open={isSettingsOpen} onClose={() => setIsSettingsOpen(false)}` below `PwaStatus`.
- [ ] Do not modify editor/preview grid layout.

### Task 5: Verification

- [ ] Run `pnpm test:e2e -- e2e/app.spec.ts`.
- [ ] Run `pnpm lint`.
- [ ] Run `pnpm build`.
- [ ] If successful, commit Phase 1 as `feat: add settings panel shell`.
