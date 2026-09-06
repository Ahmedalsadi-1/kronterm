# 10x Analysis: KronTerm OS Mode (WarmwindOS direction)
Session 1 | Date: 2026-09-01

## Current Value

OS Mode (spatial presentation in `frontend/app/tab/os-workspace.tsx` + `os-workspace.scss`, model in
`os-workspace-model.ts`, spec in `docs/os-mode/`) already implements the structural skeleton of a Warmwind-like AI OS:

- Persistent spatial world of **live app sessions** (Browser, Terminal, Hermes, Files, Sheets-like) — session identity preserved across freeform → focused → docked → edge rail → overview (docs/os-mode/CORE_CONTEXT.md).
- Screen-space OS shell: top-left workspace indicator `1 2 3 4`, top-center floating app dock, top-right clock (UI_RULES.md).
- Focus via geometry/depth, not outlines; glass surfaces, blurred atmospheric wallpaper, large radii (UI_RULES.md).
- Spring-based motion spec: freeform↔focused 420–520 ms, camera-pullback overview entry, no fade-swap remounts (MOTION_SPEC.md).
- Edge carousels with perspective/rotateY/translateZ formulas; Cover Flow overview (Phases 08–09).
- Hermes as one session in five presentations (standalone, focused, docked-left/right, edge card, overview card).

~3.3k LOC implementation, no stubs or TODOs. **What's missing is not structure — it's the Warmwind magic layer: the visible agent operating *on* those windows.**

## The Question

What would make OS Mode 10x more valuable than a pretty spatial canvas?

Warmwind's demoed loop (launch video + hands-on reviews) is: you give a task → **you watch the agent's cursor
physically move through real app windows** → a work-list slides in from the edge with the plan → a progress bar fills
toward autonomy ("close your laptop") → you can interrupt/take over at any moment → teaching mode: you perform the task
once while talking, and it becomes a repeatable automation. The UI's job is to make the agent's work *legible and
trustworthy*, not to be a fancy window manager.

KronTerm's advantage over Warmwind: Warmwind streams a remote VM into a browser. **We have real live windows on the user's
machine, with the agent already operating them.** Nobody else has that. OS Mode should be the place that relationship
becomes visible.

---

## Massive Opportunities

### 1. The Agent Cursor on the Spatial Stage
**What**: Every KronosCode/Hermes tool action that targets a surface (terminal command, browser click, file edit) renders as
a distinct agent cursor/overlay moving through the corresponding live OS-mode window — exactly like Warmwind's second
cursor. The agent's work happens *in the world*, not in a chat panel.
**Why 10x**: This is the single element that makes people screenshot the product. It converts OS Mode from "spatial window
manager" into "you watch your AI work." We already stream tool activity (appstream, agent overlays); we just don't project
it spatially onto windows.
**Unlocks**: Trust-by-watching, takeover-at-the-right-moment, shareable demo moments.
**Effort**: High. **Risk**: Perf on many concurrent streams; noise when multiple agents run.
**Score**: 🔥

### 2. Teaching Mode — Show, Don't Prompt
**What**: In OS Mode, a "Teach" control lets the user perform a workflow in the real windows (open browser, click, type)
while narrating by voice; the recording + narration + captured evidence compiles into a repeatable KronosCode task/skill,
schedulable ("every day at 9am").
**Why 10x**: Warmwind's most-loved feature, per every review. Our voice engine (experimental, `audio-engine/`) + computer-use
bridges already exist as ingredients. KronosCode skills become the persistence format — better than Warmwind's opaque
recordings because ours is inspectable and editable.
**Unlocks**: Non-technical users; the "digital employee" story on a real machine.
**Effort**: Very High. **Risk**: Scope creep toward full RPA; flakiness erodes trust fast.
**Score**: 🔥 (strategic bet)

### 3. Work-List Slide-In + Progress-to-Autonomy
**What**: When a task starts, a compact plan ("work list") slides in from the edge as an OS-mode surface, ticking through
steps live; a subtle per-task progress ring shows autonomy maturity. Long tasks keep working in the spatial world even if
the user focuses elsewhere.
**Why 10x**: Warmwind demonstrates this exact pattern ("slides in from the side, gives a coarse overview"). It answers the
#1 agent anxiety — *what is it doing, how long, can I leave?* Our agent-activity overlays already carry most of the data;
this is a spatial presentation of it.
**Effort**: Medium-High. **Score**: 🔥

### 4. Human Takeover as a First-Class Gesture
**What**: One gesture (grab a window mid-agent-action, or a "take over" button on the focused app) pauses the agent, hands
the window to the user with a visible state change, and offers "resume" afterward. Agent waits visibly, not invisibly.
**Why 10x**: Warmwind's pitch is "you're not giving up power." Takeover is the trust moment. We have approval gates in
KronosChamber; OS Mode makes them spatial and instant.
**Effort**: Medium-High. **Risk**: Race conditions between user input and in-flight agent actions.
**Score**: 🔥

---

## Medium Opportunities

### 1. Warmwind-Calibrated Visual Pass
**What**: Audit current glass/material against the target imagery (`docs/os-mode/references/*.jpeg`): stronger depth cueing
on focus (real parallax + shadow spread, not just border), wallpaper responding to focused app (subtle tint/blur shift),
consistent radii scale, quieter chrome. Follow MOTION_SPEC tuning loop — the spec explicitly says tune by screenshot
comparison.
**Why 10x-ish**: Warmwind looks like a $50M product because every surface shares one material language. Ours is close;
the last 10% of depth/lighting is what reads as "premium."
**Effort**: Medium. **Score**: 🔥

### 2. Workspaces as Named Rooms
**What**: `1 2 3 4` indicators become named rooms with distinct wallpapers and a camera-pullback switcher (workspace
overview = another Cover Flow level). Each room can host a long-running agent task that visibly keeps working.
**Why**: Turns an indicator row into a mental model ("the research room", "the deploy room"). Compounds with opportunity
M3 above — rooms are where scheduled tasks live.
**Effort**: Medium. **Score**: 👍

### 3. Live Thumbnails on Edge Cards / Dock
**What**: Edge-carousel cards and dock running-states show tiny live thumbnails or activity pulses (blinking cursor for
terminal, favicon refresh for browser, agent activity for Hermes).
**Why**: Today cards are abstract; live previews make the world feel *alive* and give glanceable status without focus.
**Effort**: Medium (perf-sensitive). **Score**: 👍

### 4. Agent Personality in the Shell
**What**: Clock/system area gains a minimal agent status glyph: idle / working (with activity meter) / needs you
(approval pending — gently pulses; clicking jumps camera to the relevant window).
**Why**: "Needs you" is the single most valuable notification in an agent OS, and Warmwind shows it via interruption. One
glyph, huge anxiety reduction.
**Effort**: Low-Medium. **Score**: 🔥 (see Small Gems)

---

## Small Gems

### 1. "Needs You" Pulse
**What**: One glowing dot on the shell when an approval/input is pending. Click → camera flies to the window that needs it.
**Why powerful**: Kills the "is it stuck?" anxiety with one pixel. **Effort**: Low. **Score**: 🔥

### 2. Agent cursor trail / afterglow
**What**: The agent cursor (M1) leaves a 300 ms fading trail. **Why**: Reads as "alive" at zero functional cost; pure
Warmwind-feel. **Effort**: Low. **Score**: 👍

### 3. Sound design: one soft chime on task completion
**Why**: Warmwind relies on visual attention; a chime means "you can leave the room." Respects reduced-audio prefs.
**Effort**: Low. **Score**: 👍

### 4. `app:osmode` single-flag opt-in + persistence
**What**: Mirror the `app:minimalui` pattern — OS Mode reachable in one click from KronSettings, layout persisted
per-workspace. **Why**: Friction to first impression is the enemy of a demo-grade mode. **Effort**: Low. **Score**: 👍

### 5. Window "breathing" while agent works
**What**: A focused window under active agent operation gets a 1px animated edge shimmer (very subtle).
**Why**: Instantly answers "which window is the AI touching?" **Effort**: Low. **Score**: 🔥

---

## Recommended Priority

### Do Now (quick wins, demo-defining)
1. **"Needs You" pulse + click-to-jump** — one pixel of shell, kills the biggest anxiety, reuses approval state.
2. **Window edge shimmer while agent works** — makes the core promise ("watch it work") visible before any big build.
3. **Warmwind-calibrated visual pass** (M1) — depth/lighting/material audit against `docs/os-mode/references`, per MOTION_SPEC tuning loop.

### Do Next (high leverage)
1. **Agent cursor on the spatial stage (Massive 1)** — the flagship. Start with terminal commands + browser clicks only.
2. **Work-list slide-in (Massive 3)** — reuse agent-activity data; presentation work mostly.
3. **Live thumbnails on edge cards** — aliveness at a glance.

### Explore (strategic bets)
1. **Teaching Mode (Massive 2)** — biggest story, biggest scope. Prototype voice-narrated recording → KronosCode skill
   compile before committing to full scheduling.
2. **Human takeover gesture (Massive 4)** — after cursor ships; needs race-condition design.
3. **Named rooms / camera-pullback workspace switching** — after progress rings make tasks persistent-feeling.

### Backlog
1. Sound design pack — polish layer, after motion+cursor land.
2. Multi-agent spatial choreography (several cursors, one world) — Wait until single-agent legibility is proven.

## Questions

### Answered
- **Q**: Can we legally imitate Warmwind? **A**: Yes — `docs/os-mode/CORE_CONTEXT.md` explicitly permits studying
  public demos for interaction/motion language while banning asset/brand copying. Our implementation is structurally
  different (real local live windows vs. streamed cloud VM).
- **Q**: Is the structural base ready? **A**: Yes — spatial world, session identity preservation, spring motion spec,
  edge carousels, Cover Flow overview all implemented per doc pack; no stubs found in `os-workspace.*`.

### Blockers
- **Q**: Teaching Mode scope — voice-only narration first, or click-capture too? (needs your call before any build)

## Next Steps
- [ ] Screenshot audit: current OS Mode vs `docs/os-mode/references/*.jpeg` at 2 viewport sizes
- [ ] Validate agent-activity event stream can project onto window coordinates (spike for the agent cursor)
- [ ] Decide Teaching Mode v0 scope (voice narration only vs. click capture)
- [ ] Pick one "Do Now" item to implement first — recommendation: "Needs You" pulse
