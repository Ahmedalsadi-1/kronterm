# frontend/app/element — UI Components

**Parent:** `../AGENTS.md`

## OVERVIEW

Shared React UI components. Buttons, inputs, menus, overlays.

## STRUCTURE

```
element/
├── button.tsx           # Button variants
├── iconbutton.tsx       # Icon buttons
├── input.tsx            # Text inputs
├── flyoutmenu.tsx       # Dropdown menus
├── expandablemenu.tsx   # Expandable menus
├── markdown.tsx         # Markdown renderer
├── ansiline.tsx         # ANSI color parsing
└── *.scss               # Component styles
```

## PATTERNS

### Button

```tsx
<Button onClick={handler} variant="primary">
  Label
</Button>
```

### Menu

```tsx
const items = [
  { label: "Item", onClick: handler },
  { label: "Separator", type: "separator" },
];
<FlyoutMenu items={items} />;
```

## STYLING

- SCSS modules per component
- CSS variables from theme system
- Tailwind via @apply in SCSS
