# UI Restructure: Tabs, Settings, Branding & Widgets
Session 4 | Date: 2026-05-28

## Architecture Overview (Current State)

```
┌─────────────────────────────────────────────────────────┐
│  Tab Bar (horizontal, browser-style tabs)               │
├──────────────┬──────────────────────┬───────────────────┤
│  VTabBar     │   Tab Content         │  AI Panel         │
│  (vertical   │   (term/web/preview   │  (chat + model    │
│   sidebar)   │    blocks in split     │   selector)       │
│              │    layout)             │                   │
│  Widgets     │                       │                   │
│  (launcher   │                       │                   │
│   buttons)   │                       │                   │
├──────────────┴──────────────────────┴───────────────────┤
│  Settings: WaveConfig block (Monaco editor for YAML)     │
└─────────────────────────────────────────────────────────┘
```

**Key architectural facts:**
- The AI panel is a **side panel** (right side) using `react-resizable-panels`, toggled via the `WorkspaceLayoutModel`
- The **settings panel** is a **block type** (`waveconfig`) that opens like any other block in the layout — it's not a dialog or a native sidebar
- Tabs use `react-resizable-panels` for the layout, with a `TabBar` at top (horizontal) and optional `VTabBar` on the left (vertical sidebar)
- **Widgets** are launcher buttons in a sidebar (`widgets.tsx`), not collapsible blocks
- The **App Builder** is a separate window type (`isBuilderWindow()`) with its own workspace in `frontend/builder/`
- **WaveTerm branding** is embedded in `emain/`, `frontend/app/onboarding/`, `frontend/app/modals/about.tsx`, and many config paths

---

## 1. Side Panel Chat → Centralized Settings

### Current Problem
The AI panel is a detached side panel (`AIPanel` in `workspace.tsx` lines 141-148). Its configuration (model, provider, settings) lives as a floating overlay, not integrated into the main settings.

Simultaneously, the settings block (`waveconfig`) is separate — you open it as a block in the layout, and it shows raw YAML/JSON config files in a Monaco editor.

### Target Architecture

Replace the floating AI side panel with a **tabbed right sidebar** that combines settings + AI config into one unified interface:

```
Before:                              After:
┌──────────────┬──────────┐         ┌──────────────┬──────────────────┐
│ Tab Content  │ AI Chat  │         │ Tab Content  │ [Settings] [AI]  │
│ (blocks)     │ (floating│         │ (blocks)     │ ├─ General       │
│              │  panel)  │         │              │ ├─ AI Providers  │
│              │          │         │              │ ├─ MCP Servers   │
│              │          │         │              │ ├─ Agents        │
│              │          │         │              │ ├─ Permissions   │
│              │          │         │              │ ├─ Keybindings   │
│              │          │         │              │ ├─ Workspaces    │
│              │          │         │              │ └─ 💬 Chat       │
└──────────────┴──────────┘         └──────────────┴──────────────────┘
```

**How it works:**

The right-side panel currently holds `AIPanel`. Change it to hold a **tabbed panel container**:

```tsx
// workspace.tsx — replace:
<AIPanel roundTopLeft={showLeftTabBar} />

// with:
<SidePanel>
  <TabButtons>  {/* [Settings] [AI] [Extensions] */}
    <TabButton id="settings" icon="gear" />
    <TabButton id="ai" icon="circle-nodes" />
    <TabButton id="extensions" icon="puzzle-piece" />
  </TabButtons>
  <TabContent>
    {activeTab === "settings" && <ConsolidatedSettings />}
    {activeTab === "ai" && <AIPanel />}
    {activeTab === "extensions" && <ExtensionsPanel />}
  </TabContent>
</SidePanel>
```

The `ConsolidatedSettings` component brings all settings — AI providers, agents, MCP, permissions, keybindings, themes — into one **visual, form-based interface** instead of Monaco-edited YAML.

### Files to change
| File | Change |
|------|--------|
| `frontend/app/workspace/workspace.tsx` | Wrap AI panel in tabbed container |
| `frontend/app/aipanel/aipanel.tsx` | Shrink to just a tab content, not the whole panel |
| `frontend/app/settings/` (new dir) | `ConsolidatedSettings.tsx` — tabbed settings UI |
| `frontend/app/view/waveconfig/waveconfig.tsx` | Keep as fallback "edit raw config" tab |
| `WorkspaceLayoutModel` | Update panel toggle to handle tab state |

### Effort: Medium (3-4 weeks)

---

## 2. Firefox-Like Tab Layout with Filesystem Grouping

### Current Problem
Tabs currently look like simple horizontal bar tabs with names truncated to 14 characters:
```
┌──────┬────────┬──────────┬─────┐
│ bash │ dev    │ myserver │  +  │
└──────┴────────┴──────────┴─────┘
```

There's no grouping, no hierarchy, no filesystem-style organization. The `VTab` component (vertical sidebar) supports more metadata (badges, flag colors) but is currently just a sidebar for tab switching, not a filesystem browser.

### Target Design — Filesystem-Style Tab Hierarchy

```
┌──────────────────────────────────────────────────────────────┐
│ 📁 Project X                                  🔍 Search Tab │
│ ├── 📂 Backend                                              │
│ │   ├── 💻 dev-server (npm run dev)            ● active     │
│ │   ├── 🐳 docker-compose up                                │
│ │   └── 🗄️ psql console                                    │
│ ├── 📂 Frontend                                             │
│ │   ├── 🖥️ vite dev                                         │
│ │   └── 🧪 npm test                                         │
│ └── 📂 Infrastructure                                       │
│     └── 🔒 ssh prod-server                                  │
│                                                             │
│ ┌── Other Tabs ────────────────────────────────────────┐   │
│ │ 📁 Scratchpad                                          │   │
│ │ 💬 AI Chat                                             │   │
│ └────────────────────────────────────────────────────────┘   │
│                                                [+ New Group] │
└──────────────────────────────────────────────────────────────┘
```

**Each tab is a folder/block.** You can:
- **Name tabs** (already supported via `onRename` callback in `TabV` and `VTab`)
- **Group tabs** into collapsible folder groups (like Firefox tab groups or VS Code editor groups)
- **Color-code groups** (flag colors already exist in the model)
- **Nest groups** (filesystem hierarchy — Project > Backend > dev-server)
- **Drag tabs between groups** (drag-and-drop already exists in `TabBar`)

### Implementation Plan

#### 2a. Tab Grouping Model

Extend the tab model to support a tree structure:

```typescript
// Current: flat tab list
tabIds: string[]  // ["tab1", "tab2", "tab3"]

// Target: tree structure with groups
tabGroups: TabGroup[]
// TabGroup = { id, name, color, children: (TabGroup | TabRef)[] }
```

This maps naturally to the filesystem metaphor:
```
Project X (root group)
├── Backend (subgroup)
│   ├── dev-server (tab)
│   └── docker (tab)
└── Frontend (subgroup)
    └── vite (tab)
```

#### 2b. Tab Tree Rendering

Rename the vertical sidebar (`VTabBar`) from a simple tab list to a **tree view**:

```tsx
// VTabBar currently renders flat tabs:
tabs.map(tab => <VTab key={tab.id} ... />)

// Target: tree of groups + tabs:
tabGroups.map(group => (
  <TabGroup name={group.name} color={group.color} collapsed={group.collapsed}>
    {group.children.map(child => {
      if (isGroup(child)) return <SubGroup ... />
      return <VTab key={child.id} ... />
    })}
  </TabGroup>
))
```

#### 2c. Filesystem Visual Style

```scss
// Visual styling for tree tabs
.tab-group {
  .group-header {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 8px 12px 4px;
    color: var(--text-secondary);
    cursor: pointer;
    
    &:hover { color: var(--text-primary); }
    
    .collapse-icon { margin-right: 4px; transition: transform 0.2s; }
    &.collapsed .collapse-icon { transform: rotate(-90deg); }
  }
  
  .group-children {
    // indented child tabs
    padding-left: 12px;
  }
}
```

#### 2d. Integration with Horizontal Tab Bar

Keep the horizontal tab bar as a **flat, compact view** showing active tabs across all groups. Clicking a tab in the horizontal bar switches context. The vertical sidebar shows the full tree.

```
Horizontal bar (compact):
┌──────┬──────────┬─────────┬──────────┬──────┐
│ 🖥️   │ 🐳      │ 🗄️     │ 🔒      │  +   │
│ vite │ docker   │ psql    │ prod     │      │
└──────┴──────────┴─────────┴──────────┴──────┘

Vertical sidebar (full tree):
📁 Project X
├── 📂 Backend
│   ├── 🐳 docker          ← highlighted (active)
│   └── 🗄️ psql
├── 📂 Frontend
│   └── 🖥️ vite
└── 📂 Infrastructure
    └── 🔒 prod
```

### Files to create/change
| File | Change |
|------|--------|
| `frontend/app/tab/tab-model.ts` | Add tree structure (groups, subgroups) |
| `frontend/app/tab/tabbar.tsx` | Update horizontal bar to show group colors |
| `frontend/app/tab/vtab.tsx` | Rewrite to tree view with groups |
| `frontend/app/tab/vtabbar.tsx` | Update to render tree hierarchy |
| `frontend/app/tab/tab.scss` | New styles for tree/group look |
| `frontend/app/tab/tabcontextmenu.ts` | Add "New Group", "Move to Group", "Rename Group" |
| `frontend/app/workspace/widgetfilter.ts` | (maybe) group-filtered widgets |

### Effort: Medium-High (4-6 weeks)

---

## 3. Foldable Widgets

### Current Problem
Widgets are launcher buttons on the left sidebar. They're always visible. Blocks inside the layout are always expanded — you can't collapse them to just a header.

### Target Design

Two types of foldability:

#### 3a. Foldable Launcher Widget Sections

The widget sidebar currently renders all widgets flat. Add **collapsible sections**:

```tsx
// Before: flat widget list
<div className="widget-list">
  {widgets.map(w => <Widget key={w.key} widget={w} />)}
</div>

// After: grouped with collapse
<WidgetSection title="Terminals" icon="terminal" defaultCollapsed={false}>
  <Widget key="term" />
  <Widget key="ssh" />
</WidgetSection>
<WidgetSection title="AI Tools" icon="circle-nodes" defaultCollapsed={true}>
  <Widget key="chat" />
  <Widget key="agent" />
</WidgetSection>
<WidgetSection title="Files" icon="folder" defaultCollapsed={false}>
  <Widget key="file-manager" />
  <Widget key="preview" />
</WidgetSection>
```

#### 3b. Foldable Blocks (Inline Collapse)

Add a **collapse/expand toggle** to each block's frame header. When collapsed, the block shows only its header bar (like VS Code's panel collapse).

```tsx
// blockframe-header.tsx — add collapse button
const [collapsed, setCollapsed] = useState(false);

<>
  <div className="block-header">
    <button onClick={() => setCollapsed(!collapsed)}>
      <i className={`fa fa-chevron-${collapsed ? 'right' : 'down'}`} />
    </button>
    <span>{headerText}</span>
    <OptMagnifyButton />
    <CloseButton />
  </div>
  {!collapsed && <div className="block-content">{children}</div>}
</>
```

This is particularly useful for:
- **Monitoring blocks** — collapse when not needed, expand on alert
- **AI chat blocks** — collapse when not actively chatting
- **Reference blocks** — keep file/web references collapsed until needed

The collapsed state should be persisted in block metadata:

```typescript
const collapseAtom = waveEnv.getBlockMetaKeyAtom(blockId, "layout:collapsed");
// Persisted automatically via SetMetaCommand
```

### Visual:
```
Before collapse:
┌─────────────────────────────────┐
│ 🖥️ dev-server            [□][X] │
│                                 │
│  $ npm run dev                  │
│  > app@1.0.0 dev               │
│  > vite                         │
│                                 │
│  VITE v5.0.0 ready in 200ms    │
└─────────────────────────────────┘

After collapse:
┌─────────────────────────────────┐
│ ▶ 🖥️ dev-server          [□][X] │
└─────────────────────────────────┘
```

### Files to change
| File | Change |
|------|--------|
| `frontend/app/block/blockframe.tsx` | Add collapse state + toggle button |
| `frontend/app/block/blockframe-header.tsx` | Add collapse icon in header |
| `frontend/app/block/block.scss` | Styles for collapsed state |
| `frontend/app/workspace/widgets.tsx` | Add WidgetSection with collapse |
| `frontend/app/workspace/widgetfilter.ts` | Support section grouping |

### Effort: Low-Medium (2-3 weeks)

---

## 4. Remove App Builder & WaveTerm Branding

### App Builder Removal Scope

The builder is a **separate window type** referenced across the codebase:

**Files to remove:**
```
frontend/builder/                          ← ENTIRE DIRECTORY (9 files)
├── AGENTS.md
├── app-selection-modal.tsx
├── builder-app.tsx
├── builder-apppanel.tsx
├── builder-buildpanel.tsx
├── builder-workspace.tsx
├── store/
├── tabs/
└── utils/
```

**Files to modify:**

| File | Change |
|------|--------|
| `frontend/app/modals/modalregistry.tsx` | Remove builder imports (`DeleteFileModal`, `PublishAppModal`, `RenameFileModal`, `SetSecretDialog`) |
| `frontend/app/store/wshclientapi.ts` | Remove builder RPC calls (deletebuilder, getbuilderoutput, getbuilderstatus, restartbuilderandwait, startbuilder, stopbuilder) |
| `frontend/app/store/global-atoms.ts` | Remove `builderIdAtom`, `builderAppIdAtom`, update `setWaveWindowType` |
| `frontend/app/store/global-model.ts` | Remove `builderId` field |
| `frontend/app/store/windowtype.ts` | Remove `"builder"` from window type union |
| `frontend/app/store/wshrouter.ts` | Remove `makeBuilderRouteId` |
| `frontend/app/store/keymodel.ts` | Remove `registerBuilderGlobalKeys`, `isBuilderWindow` branches |
| `frontend/app/aipanel/waveai-model.tsx` | Remove `inBuilder` field, `BuilderFocusManager` import |
| `frontend/app/aipanel/aipanel-contextmenu.ts` | Remove `model.inBuilder` check |
| `frontend/app/aipanel/aipanelinput.tsx` | Remove `model.inBuilder` check |
| `frontend/app/workspace/widgets.tsx` | Remove `openBuilder` reference |
| `frontend/app/aipanel/aipanel.tsx` | Remove `AIBuilderWelcomeMessage` component |

**Backend (Go) to check:**
- `pkg/wshrpc/wshrpctypes.go` — builder RPC types
- `cmd/` — builder-related commands
- `pkg/` — any builder service files

### WaveTerm Branding → KronTerm Rename Scope

**File paths & app identity (Go backend):**
| File | Change |
|------|--------|
| `emain/emain-platform.ts` | `app.setName("kronterm/electron")`, `waveDirNamePrefix = "kronterm"`, update config paths |
| `emain/emain.ts` | Update log messages: `"kronterm-app starting..."` |
| `emain/emain-wavesrv.ts` | (Keep API endpoints as-is) |
| `emain/sandbox/sandbox-manager.ts` | `path.join(home, ".kronterm", "sandbox")` |

**UI references:**
| File | Change |
|------|--------|
| `frontend/app/onboarding/onboarding.tsx` | Update all GitHub URLs (`wavetermdev/waveterm` → `krontermdev/kronterm`), privacy URL, text |
| `frontend/app/onboarding/onboarding-starask.tsx` | Update GitHub URLs |
| `frontend/app/onboarding/onboarding-upgrade-v0140.tsx` | Update docs URL (`docs.waveterm.dev` → `docs.kronterm.dev`) |
| `frontend/app/onboarding/onboarding-upgrade-v0142.tsx` | Update docs URL |
| `frontend/app/modals/about.tsx` | Update GitHub URL, website URL, acknowledgements |
| `frontend/app/block/durable-session-flyover.tsx` | `docs.waveterm.dev` → `docs.kronterm.dev` |

**Config paths:**
- `~/.waveterm` → `~/.kronterm` (data directory)
- `~/Library/Application Support/waveterm` → `~/Library/Application Support/kronterm`

### Effort: Low-Medium (1-2 weeks for branding, 1 week for builder removal)

---

## Summary: Implementation Order

| Priority | Change | Effort | Dependencies |
|----------|--------|--------|--------------|
| 🔥 **Fix branding first** | Remove WaveTerm references, rename to KronTerm | 1 week | None |
| 🔥 **Remove builder** | Delete builder directory + references | 1 week | Branding rename |
| 🔥 **Foldable blocks** | Collapse toggle in block frame | 1-2 weeks | None |
| 👍 **Foldable widget sections** | Group widgets into collapsible sections | 1 week | None |
| 👍 **Tab groups / filesystem tree** | Tree-structured tabs in VTabBar | 3-4 weeks | Tab model changes |
| 🔥 **Consolidated side panel** | Tabbed settings + AI in right panel | 3-4 weeks | Previous work |
| 👍 **Visual tab styling** | Firefox-like tab appearance + colors | 1-2 weeks | Tab groups |

### Quick Win (Start Today)
**Foldable blocks** — requires only changes to `blockframe.tsx` and `blockframe-header.tsx`. No backend changes needed. The collapse state persists via existing `SetMetaCommand`.

### Recommended Sprint Plan
```
Sprint 1: Branding + Builder removal
Sprint 2: Foldable blocks + foldable widget sections
Sprint 3-4: Tab groups model + tree sidebar
Sprint 5: Consolidated side panel (settings + AI)
Sprint 6: Visual polish (Firefox-like tabs, animations)
```
