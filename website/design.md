# Kronterm Website Design System

## Intent

Build a premium commercial website for Kronterm, a closed-source AI-native developer workspace powered by KronosCode. The site adapts the strongest patterns observed on Warp's website: product-first heroes, sticky navigation, grouped mega menus, dense technical product sections, tabbed demos, pricing cards, use-case pages, download CTAs, and a structured resource/company surface.

This is not positioned as a clone. The product story is Kronterm-native:

- Kronterm is the AI-native workspace for builders.
- KronosCode is the AI engine inside Kronterm.
- Kronterm is a commercial closed-source product in private beta.
- Kronterm is not just an AI terminal. It is a full desktop command center for terminal, browser, editor, sandboxes, files, AI chat, and agent control.

## Core Message

Hero headline:

> The AI-native workspace for builders.

Hero subheadline:

> Kronterm combines your terminal, browser, editor, sandboxes, files, and AI agents into one programmable workspace — powered by KronosCode, the AI engine that understands and operates across your development environment.

Public comparison line:

> Most AI terminals stop at the command line. Kronterm gives AI the entire workspace.

## Guardrails

Do not say:

- open-source
- free forever
- community-built
- GitHub-first
- clone of Warp
- clone of Terax

Do say:

- commercial product
- private beta
- AI-native workspace
- powered by KronosCode
- desktop command center
- agent-ready workspace
- local and cloud model support
- human-approved execution
- product for serious builders

## Visual Direction

The website should feel premium, dark, cinematic, technical, product-heavy, AI-native, and commercially credible.

Design attributes:

- Dark background with restrained neon green and cool blue accents.
- Large lightweight hero typography.
- Compact but polished buttons and nav controls.
- Product UI visible in the first viewport.
- Dense technical sections after the hero.
- Real Kronterm screenshots and videos instead of abstract illustrations.
- 8px or smaller card radii.
- High contrast text and clear focus states.
- Responsive desktop, laptop, tablet, and mobile layouts.

## Global Components

### Sticky Navbar

Pattern:

- Announcement bar above nav.
- Sticky dark translucent nav.
- Brand mark and Kronterm label.
- Desktop mega-menu groups:
  - Product
  - Solutions
  - Company
  - Resources
- Persistent actions:
  - Contact sales
  - Download
- Mobile collapsible menu.

### Hero

Pattern:

- Eyebrow label.
- Large H1.
- Descriptive subheadline.
- Primary CTA and secondary CTA.
- Real product screenshot/video in a framed desktop-style media shell.

### Media Frame

Pattern:

- Browser/app chrome with three status dots.
- Uses optimized WebP screenshots and compressed MP4 video loops.
- Video behaves like GIF: autoplay, muted, loop, plays inline.
- Alt text or aria-label required for every media asset.

### Feature Grid

Pattern:

- 2-column desktop grid.
- 1-column mobile grid.
- Lucide icons.
- Compact cards with direct, technical copy.

### Tabbed Product Demo

Pattern:

- Tabs for Terminal, KronosCode, Browser, Sandbox.
- Each tab pairs a short product explanation with an actual media asset.
- Shows that Kronterm is more than a terminal.

### Pricing Cards

Pattern:

- Builder, Pro, Team, Enterprise.
- Commercial/private-beta framing.
- No free/open-source language.
- Enterprise routes to sales.

### Footer

Pattern:

- CTA band.
- Dense footer navigation.
- Commercial product/legal/private beta status.

## Asset Usage

Primary assets copied from `/Users/albsheralsadi/kronterm/assets` into `website/public/assets`.

Optimized screenshots:

- `/assets/product/kronterm-homepage.webp`
- `/assets/product/kronterm-sidepanel.webp`
- `/assets/product/kronterm-sandbox.webp`
- `/assets/kronoscode/kronoscode-agent.webp`
- `/assets/kronoscode/file-diff.webp`
- `/assets/kronoscode/streamable-apps.webp`
- `/assets/kronoscode/file-explorer.webp`
- `/assets/kronoscode/tui-settings.webp`

Compressed video loops:

- `/assets/video/canvas-display.mp4`
- `/assets/video/sandbox-demo.mp4`
- `/assets/video/browser-widget.mp4`
- `/assets/video/dev-server.mp4`

Logo/mark:

- `/assets/product/kronterm-icon.svg`
- `/assets/product/kronterm-logo.svg`
- `/assets/product/kronterm-pet-logo.webp`

## Page Map

### Home `/`

Purpose:

Introduce Kronterm as the AI-native workspace for builders.

Sections:

- Hero with main positioning.
- Product screenshot.
- "Not just an AI terminal — an AI workspace."
- KronosCode explanation.
- Commercial/private-beta builder positioning.
- Tabbed Terminal/KronosCode/Browser/Sandbox demo.
- Final CTA via footer.

### Product `/product`

Purpose:

Explain the full workspace surface.

Sections:

- Workspace overview.
- Terminal, browser, editor, files, sandboxes.
- Command center for agent-assisted execution.
- Diff/product preview media.

### KronosCode `/kronoscode`

Purpose:

Give the AI engine its own premium page.

Sections:

- KronosCode hero.
- Workspace evidence vs isolated prompts.
- Codebase reasoning.
- Terminal awareness.
- Browser context.
- Agent coordination.
- Transparent execution.

### Terminal `/terminal`

Purpose:

Explain the terminal as the command layer for the workspace.

Sections:

- Terminal hero.
- Command output as AI context.
- Dev server video.
- Session context, process awareness, approval gates.

### AI Workflows `/workflows`

Purpose:

Show valuable work loops for builders.

Sections:

- Ask, inspect, approve, test, ship.
- Debug, refactor, review, agent-build workflows.

### Teams `/teams`

Purpose:

Position Kronterm for teams and commercial evaluation.

Sections:

- Desktop command center for teams.
- Developer, founder, agent-builder, technical-lead use patterns.

### Security `/security`

Purpose:

Answer AI safety, action approval, and data boundary questions.

Sections:

- AI execution needs visible boundaries.
- Human-approved commands.
- Diff visibility.
- Local and cloud model support.
- Private beta posture.

### Pricing `/pricing`

Purpose:

Route visitors to commercial access paths.

Sections:

- Pricing hero.
- Builder, Pro, Team, Enterprise cards.
- Commercial support framing.

### Customers `/customers`

Purpose:

Create commercial credibility even before public case studies.

Sections:

- Built for developers who need the full workspace.
- Founders, developers, agent teams, platform teams.

### Download `/download`

Purpose:

Route installation intent into private beta access.

Sections:

- Private beta access.
- macOS, Windows, Linux, setup notes.

### Use Cases

Pages:

- `/use-cases/code-review`
- `/use-cases/bug-investigation`
- `/use-cases/refactors`
- `/use-cases/agent-builders`

Purpose:

Translate the product into high-value workflows.

Shared pattern:

- Use-case hero.
- Product media.
- Workflow-specific feature grid.
- CTA to request workflow access.

### Resources and Company

Pages:

- `/docs`
- `/blog`
- `/research`
- `/about`
- `/careers`
- `/press`
- `/newsroom`
- `/faq`
- `/contact-sales`
- `/legal/privacy`
- `/legal/terms`

Purpose:

Create the same breadth as a mature commercial site: docs, resources, company credibility, private beta routing, and legal/security framing.

## Responsiveness

Desktop:

- Two-column hero and split sections.
- Full mega menu.
- Four-column pricing.

Laptop:

- Same composition with tighter gaps.
- Hero can stack if width is constrained.

Tablet:

- Hero stacks.
- Split sections stack.
- Tabs become horizontal scroll controls.
- Pricing becomes two columns.

Mobile:

- Collapsed menu.
- One-column content.
- One-column cards.
- Large type remains readable without viewport-scaled text.
- CTA rows wrap.

## Accessibility

Implemented requirements:

- Semantic `header`, `nav`, `main`, `section`, `footer`.
- Single page H1 per route.
- Accessible media alt text or aria labels.
- Keyboard-visible focus outlines.
- High-contrast foreground/background colors.
- Buttons use real `<button>` elements where interactive.
- Links are real route links.

## SEO

Implemented requirements:

- Document title and description.
- Per-route title and description updates.
- Open Graph title, description, and image.
- Descriptive H1/H2 structure.
- Human-readable route paths.

## Technical Structure

Stack:

- Vite
- React 19
- TypeScript
- React Router
- CSS modules via global `src/styles.css`
- Lucide icons

Key files:

- `src/data/site.ts`: page content, route map, asset map, nav groups.
- `src/App.tsx`: route setup and per-page metadata.
- `src/components/Nav.tsx`: sticky nav and mega menu.
- `src/components/PageTemplate.tsx`: generic routed page layout.
- `src/components/MediaFrame.tsx`: image/video product frame.
- `src/components/WorkflowTabs.tsx`: home product tabs.
- `src/styles.css`: responsive visual system.

Build commands:

```bash
npm run dev
npm run build
npm run preview
```
