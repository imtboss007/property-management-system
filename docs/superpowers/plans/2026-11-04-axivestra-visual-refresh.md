# AXIVESTRA 17-Source Visual Refresh Implementation Plan

> **For agentic workers:** Apply this plan on the isolated feature branch and verify each task before merging to production.

**Goal:** Upgrade AXIVESTRA's visual presentation and interaction feedback on desktop and mobile without changing its existing business behavior.

**Architecture:** Build from the current production `main` branch. Add one presentation-only class to the existing root element and a scoped CSS layer for the command workspace, navigation, panels, forms, focus states and responsive behavior. Keep the current React, TypeScript, CSS, Lucide, Vite, Electron and Capacitor stack; do not install or copy third-party components.

**Tech Stack:** React 18, TypeScript, Vite, CSS, Node built-in assertions, GitHub Actions.

**Spec:** User-approved 17-source visual direction; existing AXIVESTRA design boundary that keeps its identity distinct from AXIMACH.

## Global Constraints

- Modify AXIVESTRA only.
- Preserve every current module, field, form, calculation, workflow, record, storage key, sync collection, integration, export and permission.
- Do not change business logic, data models, navigation destinations or module content.
- Do not add controls or options inside existing modules.
- Do not add a rotating sphere or orbital navigation.
- No new runtime dependencies.
- Keep the desktop and Android layouts responsive.
- Respect keyboard focus, reduced-motion preferences and mobile safe areas.

## Review Focus

- Existing root and read-only classes remain intact apart from the new visual scope class.
- Existing buttons, links, inputs and navigation preserve their current event handlers and destinations.
- Mobile layout at 320px and 720px does not introduce horizontal page overflow.
- Reduced-motion users do not receive non-essential movement.
- Form, modal, search and status text retain readable contrast.

## Approaches

- **Full feature-branch merge:** rejected because that branch has diverged and contains unrelated functional additions.
- **New component system/dependency:** rejected because it adds runtime and integration risk for a visual-only task.
- **Scoped CSS refresh on current main:** selected because it isolates presentation changes from existing application behavior.

## Tasks

### Task 1: Add a visual-system regression contract
- Add a Node test for the scoped root class, critical component scopes, mobile rules, reduced-motion rules and safe-area spacing.
- Include the check in the existing `npm test` command.
- Run it through the repository's Windows build workflow.

### Task 2: Apply the presentation-only refresh
- Add `ax-modern-shell` to the existing root element without changing its read-only condition.
- Append a scoped design layer to `src/styles.css`.
- Keep the AXIVESTRA identity separate from AXIMACH: no central sphere or orbital navigation.

### Task 3: Verify and deploy
- Run the full existing test suite and TypeScript/Vite production build in GitHub Actions.
- Review the PR diff for presentation-only scope.
- Merge to `main` only after checks pass, then verify the Cloudflare Pages production URL.
