# AXIVESTRA Interactive Orbital Command Interface Implementation Plan

> **For agentic workers:** Apply this plan on the isolated feature branch and verify each task before merging to production.

**Goal:** Deliver the approved AXIVESTRA interactive 3D command experience on desktop and mobile: a central intelligence sphere, orbital tracks, clickable navigation to all 16 existing workspaces, holographic panels and live metrics, without changing business behavior.

**Architecture:** Build from the current production `main` branch. Add a typed React orbital command component connected to existing `go()` workspace navigation and live in-memory record totals, plus scoped CSS for the 3D sphere, orbit geometry, glass panels and responsive layouts. Keep the current React, TypeScript, CSS, Lucide, Vite, Electron and Capacitor stack; do not install third-party components.

**Tech Stack:** React 18, TypeScript, Vite, CSS, Node built-in assertions, GitHub Actions.

**Spec:** User-approved AXIVESTRA visual direction, retaining AXIVESTRA identity and applying the interactive orbital design only to AXIVESTRA.

## Global Constraints

- Modify AXIVESTRA only.
- Preserve every current module, field, form, calculation, workflow, record, storage key, sync collection, integration, export and permission.
- Do not change business logic, data models, navigation destinations or module content.
- Keep existing module forms and controls intact; add the orbital navigation as a command-centre layer.
- Include the central rotating 3D intelligence sphere, layered orbital tracks and clickable nodes for all 16 existing workspaces.
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
- **Typed React command component with scoped CSS:** selected because it adds real navigation and live workspace metrics without replacing existing business screens.

## Tasks

### Task 1: Add a visual-system regression contract
- Add a Node test for the scoped root class, critical component scopes, mobile rules, reduced-motion rules and safe-area spacing.
- Include the check in the existing `npm test` command.
- Run it through the repository's Windows build workflow.

### Task 2: Implement the orbital command centre
- Add `AxivestraOrbitalHub.tsx` and connect it to the existing Overview and `go()` navigation.
- Render all 16 current workspaces with live record counts and workspace metrics.
- Add the 3D sphere, orbital tracks, holographic nodes and mobile grid fallback in scoped CSS.
- Preserve the existing app shell, read-only behavior, keyboard focus and reduced-motion support.

### Task 3: Verify and deploy
- Run the full existing test suite, TypeScript/Vite production build and Windows/Android package builds in GitHub Actions.
- Review the PR diff for presentation-only scope.
- Merge to `main` only after checks pass, then verify the Cloudflare Pages production URL.
