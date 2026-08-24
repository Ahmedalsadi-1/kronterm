import "./pet.scss";

type PetContext = "idle" | "terminal" | "browser" | "desktop" | "file" | "thinking";
type PetSurface = "browser" | "sandbox" | "desktop" | "terminal" | "file" | "panel";
type PetAction =
    | "open"
    | "focus"
    | "inspect"
    | "move"
    | "click"
    | "doubleClick"
    | "type"
    | "press"
    | "scroll"
    | "drag"
    | "screenshot"
    | "thinking"
    | "verify"
    | "wait";
type PetLifecycle =
    | "idle"
    | "queued"
    | "awaiting-approval"
    | "running"
    | "verifying"
    | "succeeded"
    | "degraded"
    | "failed"
    | "cancelled"
    | "paused";
type PetCursorAction = "idle" | "click" | "type" | "scroll" | "hover" | null;
type PetMode = "off" | "status-only" | "docked" | "expressive";
type PetState = {
    context: PetContext;
    lifecycle: PetLifecycle;
    detail: string;
    thought?: string;
    active: boolean;
    moving: boolean;
    cursorAction?: PetCursorAction;
    cursorPoint?: { x: number; y: number } | null;
    reasoningLog?: string[];
    previewImageUrl?: string;
    previewBlockId?: string;
    surface?: PetSurface;
    action?: PetAction;
    appName?: string;
};
type PetOptions = {
    mode: PetMode;
    glow: boolean;
    thoughts: boolean;
    actions: boolean;
    roam: boolean;
    followUserCursor: boolean;
};
type BooleanPetOption = Exclude<keyof PetOptions, "mode">;

declare global {
    interface Window {
        petApi?: {
            onState: (callback: (state: PetState) => void) => () => void;
            updateOptions: (options: Partial<PetOptions>) => void;
            sendChat: (text: string) => void;
            resumeContext: () => void;
            toggleClickThrough: () => void;
            isClickThrough: () => Promise<boolean>;
            onClickThroughChange: (callback: (enabled: boolean) => void) => () => void;
        };
    }
}

function sortedFrames(images: Record<string, string>): string[] {
    return Object.entries(images)
        .sort(([a], [b]) => {
            const first = Number(a.match(/-(\\d+)\\.png$/)?.[1] ?? 0);
            const second = Number(b.match(/-(\\d+)\\.png$/)?.[1] ?? 0);
            return first - second;
        })
        .map(([, src]) => src);
}

const idleFrames = sortedFrames(
    import.meta.glob("../../assets/pet/idle/*.png", {
        eager: true,
        import: "default",
        query: "?url",
    }) as unknown as Record<string, string>
);
const expressiveStatusFrames = sortedFrames(
    import.meta.glob("../../assets/pet/sprite-sheets/iterations/expressive-status/frames/*.png", {
        eager: true,
        import: "default",
        query: "?url",
    }) as unknown as Record<string, string>
);

function sequence(frames: string[], start: number, end: number): string[] {
    return frames.slice(start - 1, end);
}

const StatusSequences = {
    idle: sequence(expressiveStatusFrames, 1, 4),
};
const root = document.getElementById("pet-root");
const sprite = document.getElementById("pet-sprite") as HTMLImageElement;
const spriteShell = document.querySelector(".sprite-shell") as HTMLElement;
const thought = document.getElementById("thought");
const action = document.getElementById("action");
const context = document.getElementById("context");
const detail = document.getElementById("detail");
const menuToggle = document.getElementById("pet-menu-toggle");
const menu = document.getElementById("pet-menu");
const chatToggle = document.getElementById("chat-toggle") as HTMLButtonElement;
const chat = document.getElementById("pet-chat") as HTMLFormElement;
const chatInput = document.getElementById("pet-chat-input") as HTMLInputElement;

// Menu mode items (segmented control)
const modeItems = document.querySelectorAll<HTMLElement>(".pet-menu-segment");

// Menu toggle items (switch-style)
const optionMenuItems: Record<string, HTMLElement> = {
    glow: document.getElementById("menu-toggle-glow"),
    thoughts: document.getElementById("menu-toggle-thoughts"),
    actions: document.getElementById("menu-toggle-actions"),
    roam: document.getElementById("menu-toggle-roam"),
    followUserCursor: document.getElementById("menu-toggle-follow-cursor"),
};
const clickthroughMenuItem = document.getElementById("menu-toggle-clickthrough");

const reasoningToggle = document.getElementById("reasoning-toggle") as HTMLButtonElement;
const reasoningFeed = document.getElementById("reasoning-feed") as HTMLElement;
const reasoningFeedBody = document.getElementById("reasoning-feed-body") as HTMLElement;
const reasoningFeedClose = document.getElementById("reasoning-feed-close") as HTMLButtonElement;

const resizeHandle = document.getElementById("resize-handle") as HTMLElement;
const capturePreview = document.getElementById("capture-preview") as HTMLElement;
const capturePreviewImage = document.getElementById("capture-preview-image") as HTMLImageElement;
const capturePreviewCaption = document.getElementById("capture-preview-caption") as HTMLElement;

const petCursor = document.getElementById("pet-cursor") as HTMLElement;
const petCursorRing = document.getElementById("pet-cursor-ring") as HTMLElement;
const petCursorLabel = document.getElementById("pet-cursor-label") as HTMLElement;

let clickThroughEnabled = false;

function updateToggleSlider(item: HTMLElement | null, enabled: boolean) {
    if (!item) return;
    const input = item.querySelector("input") as HTMLInputElement;
    if (input) {
        input.checked = enabled;
    }
}

window.petApi?.isClickThrough().then((enabled) => {
    clickThroughEnabled = enabled;
    root.classList.toggle("click-through", clickThroughEnabled);
    updateToggleSlider(clickthroughMenuItem, clickThroughEnabled);
});
window.petApi?.onClickThroughChange((enabled) => {
    clickThroughEnabled = enabled;
    root.classList.toggle("click-through", enabled);
    updateToggleSlider(clickthroughMenuItem, enabled);
    if (enabled) {
        const toast = document.createElement("div");
        toast.className = "click-through-toast";
        toast.textContent = "Click-through on — pet ignores pointer events";
        root.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }
});

const cursorActionLabels: Record<string, string> = {
    click: "Click",
    type: "Type",
    scroll: "Scroll",
    hover: "Hover",
};

let frame = 0;
let options: PetOptions = {
    mode: "docked",
    glow: true,
    thoughts: true,
    actions: true,
    roam: false,
    followUserCursor: false,
};
let state: PetState = {
    context: "idle",
    lifecycle: "idle",
    detail: "KronosCode ready",
    active: false,
    moving: false,
    cursorAction: "idle",
    cursorPoint: null,
    reasoningLog: [],
    surface: "panel",
    action: "focus",
};
let resizeActive = false;
let resizeStartX = 0;
let resizeStartY = 0;
let resizeStartW = 0;
let resizeStartH = 0;
// Cursor follow state for sprite & physics-based carrying
let cursorFollowActive = false;
let cursorTargetX = 0;
let cursorTargetY = 0;
let currentSpriteX = 0;
let currentSpriteY = 0;
let currentSpriteTilt = 0;
let currentCursorX = 0;
let currentCursorY = 0;

function applyOptions() {
    root.classList.remove("mode-off", "mode-status-only", "mode-docked", "mode-expressive");
    root.classList.add(`mode-${options.mode}`);
    root.classList.toggle("glow-disabled", !options.glow);
    localStorage.setItem("kronos-pet-options", JSON.stringify(options));
    localStorage.setItem("kronos-pet-options:surface-docking-v1", "true");
    window.petApi?.updateOptions({
        mode: options.mode,
        roam: options.roam,
        followUserCursor: options.followUserCursor,
    });
    // Update mode items
    modeItems.forEach((item) => {
        item.classList.toggle("mode-selected", item.dataset.mode === options.mode);
    });
    // Update toggle checkmarks
    Object.entries(optionMenuItems).forEach(([key, el]) => {
        updateToggleSlider(el, options[key as BooleanPetOption]);
    });
    renderState(state);
}

/** Map a screen-space point to the pet window's local coordinate space */
function screenToPetWindow(point: { x: number; y: number }): { x: number; y: number } | null {
    if (!root) return null;
    const rect = root.getBoundingClientRect();
    // The root is positioned relative to the window; we want coordinates
    // relative to the root for the sprite-shell.
    return {
        x: point.x - rect.left,
        y: point.y - rect.top,
    };
}

function renderCursor(action: PetCursorAction, point: { x: number; y: number } | null | undefined) {
    if (options.mode !== "expressive" || action == null || action === "idle" || !petCursor || !petCursorRing) {
        petCursor?.setAttribute("hidden", "");
        clearCursorFollow();
        return;
    }

    // Show the ring cursor
    petCursor.className = `pet-cursor cursor-${action}`;
    if (petCursorLabel) {
        petCursorLabel.textContent = cursorActionLabels[action] ?? "Act";
    }
    petCursor.removeAttribute("hidden");

    // CARRY THE CURSOR: move the pet sprite to the cursor position
    if (point && spriteShell) {
        const local = screenToPetWindow(point);
        if (local) {
            // Clamp to window bounds with some padding
            const maxX = root.clientWidth - 60;
            const maxY = root.clientHeight - 60;
            cursorTargetX = Math.max(10, Math.min(maxX, local.x));
            cursorTargetY = Math.max(10, Math.min(maxY, local.y));

            // Initialize positions if it just started following to prevent huge jumps
            if (!cursorFollowActive) {
                currentCursorX = cursorTargetX;
                currentCursorY = cursorTargetY;

                const shellRect = spriteShell.getBoundingClientRect();
                const rootRect = root.getBoundingClientRect();
                const shellW = shellRect.width || 160;
                const shellH = shellRect.height || 148;
                const naturalCenterX = shellRect.left - rootRect.left + shellW / 2;
                const naturalCenterY = shellRect.top - rootRect.top + shellH / 2;

                currentSpriteX = cursorTargetX - naturalCenterX;
                currentSpriteY = cursorTargetY + 54 - naturalCenterY;
                currentSpriteTilt = 0;
            }

            startCursorFollow();
        }
    }
}

function startCursorFollow() {
    if (!spriteShell) return;
    cursorFollowActive = true;
    spriteShell.classList.add("cursor-following");
}

function clearCursorFollow() {
    if (!spriteShell) return;
    cursorFollowActive = false;
    spriteShell.classList.remove("cursor-following");
}

function updateAnimationLoop() {
    if (!spriteShell || !root) {
        requestAnimationFrame(updateAnimationLoop);
        return;
    }

    const shellRect = spriteShell.getBoundingClientRect();
    const rootRect = root.getBoundingClientRect();
    const shellW = shellRect.width || 160;
    const shellH = shellRect.height || 148;
    const naturalCenterX = shellRect.left - rootRect.left + shellW / 2;
    const naturalCenterY = shellRect.top - rootRect.top + shellH / 2;

    if (cursorFollowActive && petCursor) {
        // Fast-lerp the cursor overlay to follow the target coordinates smoothly
        currentCursorX += (cursorTargetX - currentCursorX) * 0.35;
        currentCursorY += (cursorTargetY - currentCursorY) * 0.35;

        petCursor.style.left = `${currentCursorX}px`;
        petCursor.style.top = `${currentCursorY}px`;
        petCursor.style.transform = "translate(-50%, -50%)";

        // Target offset for the sprite (below the cursor to appear carrying it)
        const targetDx = cursorTargetX - naturalCenterX;
        const targetDy = cursorTargetY + 54 - naturalCenterY;

        // Interpolate position with inertia
        currentSpriteX += (targetDx - currentSpriteX) * 0.12;
        currentSpriteY += (targetDy - currentSpriteY) * 0.12;

        // Dynamic tilt proportional to horizontal distance/velocity
        const diffX = targetDx - currentSpriteX;
        const targetTilt = Math.max(-16, Math.min(16, diffX * 0.18));
        currentSpriteTilt += (targetTilt - currentSpriteTilt) * 0.1;

        spriteShell.style.transform = `translate(${currentSpriteX}px, ${currentSpriteY}px) rotate(${currentSpriteTilt}deg)`;
    } else {
        // Return smoothly to natural resting position
        currentSpriteX += (0 - currentSpriteX) * 0.15;
        currentSpriteY += (0 - currentSpriteY) * 0.15;
        currentSpriteTilt += (0 - currentSpriteTilt) * 0.15;

        if (Math.abs(currentSpriteX) > 0.05 || Math.abs(currentSpriteY) > 0.05 || Math.abs(currentSpriteTilt) > 0.05) {
            spriteShell.style.transform = `translate(${currentSpriteX}px, ${currentSpriteY}px) rotate(${currentSpriteTilt}deg)`;
        } else {
            spriteShell.style.transform = "";
        }
    }

    requestAnimationFrame(updateAnimationLoop);
}

// Start the physics loop
requestAnimationFrame(updateAnimationLoop);

function renderReasoningLog(log: string[] | undefined) {
    if (!reasoningFeedBody) {
        return;
    }
    reasoningFeedBody.innerHTML = "";
    if (!log || log.length === 0) {
        const empty = document.createElement("div");
        empty.className = "reasoning-feed-empty";
        empty.textContent = "No reasoning yet";
        reasoningFeedBody.appendChild(empty);
        return;
    }
    for (const entry of log) {
        const item = document.createElement("div");
        item.className = "reasoning-feed-item";
        item.textContent = entry;
        reasoningFeedBody.appendChild(item);
    }
    reasoningFeedBody.scrollTop = reasoningFeedBody.scrollHeight;
}

let lastThoughtText = "";

function renderState(nextState: PetState) {
    state = nextState;
    root.classList.remove(
        "context-idle",
        "context-terminal",
        "context-browser",
        "context-desktop",
        "context-file",
        "context-thinking",
        "lifecycle-idle",
        "lifecycle-queued",
        "lifecycle-awaiting-approval",
        "lifecycle-running",
        "lifecycle-verifying",
        "lifecycle-succeeded",
        "lifecycle-degraded",
        "lifecycle-failed",
        "lifecycle-cancelled",
        "lifecycle-paused",
        "is-active"
    );
    root.classList.add(`context-${state.context}`);
    root.classList.add(`lifecycle-${state.lifecycle}`);
    root.classList.toggle("is-active", state.active);
    context.textContent = state.lifecycle.replace("-", " ").toUpperCase();
    detail.textContent = state.detail;

    if (!reasoningFeed?.hidden) {
        renderReasoningLog(state.reasoningLog);
    }

    const showThought = options.mode === "expressive" && options.thoughts && state.thought && !state.cursorAction;
    const isNewThought = state.thought && state.thought !== lastThoughtText;
    lastThoughtText = state.thought ?? "";
    if (isNewThought) {
        thought.classList.remove("thought-burst");
        void thought.offsetWidth;
        thought.classList.add("thought-burst");
    }
    thought.textContent = state.thought ?? "";
    thought.hidden = !showThought;

    const showAction =
        options.mode === "expressive" &&
        options.actions &&
        state.active &&
        state.context !== "thinking" &&
        !state.cursorAction;
    action.textContent = state.detail;
    action.hidden = !showAction;

    renderCursor(state.cursorAction, state.cursorPoint);
    if (capturePreview && capturePreviewImage) {
        const showPreview =
            options.mode !== "off" &&
            options.mode !== "status-only" &&
            (Boolean(state.previewImageUrl) || Boolean(state.previewBlockId));
        root.classList.toggle("has-preview", Boolean(showPreview));
        if (showPreview) {
            if (state.previewImageUrl) {
                capturePreviewImage.src = state.previewImageUrl;
            } else {
                capturePreviewImage.removeAttribute("src");
            }
            capturePreviewCaption.textContent =
                state.surface === "browser" ? "Preview browser" : `Preview ${state.appName ?? "widget"}`;
            capturePreview.setAttribute(
                "aria-label",
                state.previewImageUrl ? "Expand the latest agent preview" : "Open the active KronTerm widget"
            );
            capturePreview.removeAttribute("hidden");
        } else {
            root.classList.remove("preview-expanded");
            capturePreview.setAttribute("aria-expanded", "false");
            capturePreview.setAttribute("hidden", "");
            capturePreviewImage.removeAttribute("src");
        }
    }
}

function framesForState(): string[] {
    return StatusSequences.idle.length > 0 ? StatusSequences.idle : idleFrames;
}

function animate() {
    const frames = framesForState();
    if (frames.length > 0) {
        sprite.src = frames[frame % frames.length];
        frame++;
    }
    if (state.cursorAction && state.cursorAction !== "idle" && petCursor) {
        petCursor.classList.toggle("cursor-pulse", true);
    } else if (petCursor) {
        petCursor.classList.toggle("cursor-pulse", false);
    }
}

function initResize(e: MouseEvent) {
    e.preventDefault();
    resizeActive = true;
    resizeStartX = e.screenX;
    resizeStartY = e.screenY;
    resizeStartW = window.innerWidth;
    resizeStartH = window.innerHeight;
    document.addEventListener("mousemove", onResizeMove);
    document.addEventListener("mouseup", onResizeEnd);
}

function onResizeMove(e: MouseEvent) {
    if (!resizeActive) {
        return;
    }
    const dw = e.screenX - resizeStartX;
    const dh = e.screenY - resizeStartY;
    const newW = Math.max(250, resizeStartW + dw);
    const newH = Math.max(220, resizeStartH + dh);
    window.resizeTo(newW, newH);
}

function onResizeEnd() {
    resizeActive = false;
    document.removeEventListener("mousemove", onResizeMove);
    document.removeEventListener("mouseup", onResizeEnd);
}

try {
    const stored = localStorage.getItem("kronos-pet-options");
    if (stored) {
        options = { ...options, ...(JSON.parse(stored) as Partial<PetOptions>) };
    }
    if (!localStorage.getItem("kronos-pet-options:surface-docking-v1")) {
        options = { ...options, roam: false, followUserCursor: false };
    }
} catch {
    localStorage.removeItem("kronos-pet-options");
}

// ─── Menu event handlers ───────────────────────────────────────────

// Mode selection
modeItems.forEach((item) => {
    item.addEventListener("click", () => {
        const mode = item.dataset.mode as PetMode;
        if (mode && mode !== options.mode) {
            options = { ...options, mode };
            applyOptions();
            menu.hidden = true;
        }
    });
});

// Toggle options (menu items with checkmarks)
Object.entries(optionMenuItems).forEach(([key, el]) => {
    const option = key as BooleanPetOption;
    el.addEventListener("click", () => {
        options = { ...options, [option]: !options[option] };
        applyOptions();
    });
});

// Click-through toggle
clickthroughMenuItem?.addEventListener("click", () => {
    window.petApi?.toggleClickThrough();
});

menuToggle.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
    chat.hidden = true;
    reasoningFeed.hidden = true;
});

root.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    menu.hidden = false;
    chat.hidden = true;
    reasoningFeed.hidden = true;
});

root.addEventListener("dblclick", (event) => {
    if ((event.target as HTMLElement).closest("input, button, form")) {
        return;
    }
    window.petApi?.toggleClickThrough();
});

root.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest("input, button, select, form, .pet-menu")) {
        return;
    }
    window.petApi?.resumeContext();
});

chatToggle?.addEventListener("click", () => {
    chat.hidden = !chat.hidden;
    menu.hidden = true;
    if (!chat.hidden) {
        chatInput.focus();
    }
});

chat.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = chatInput.value.trim();
    if (!text) {
        return;
    }
    window.petApi?.sendChat(text);
    chatInput.value = "";
});

reasoningToggle?.addEventListener("click", () => {
    const wasHidden = reasoningFeed.hidden;
    reasoningFeed.hidden = !wasHidden;
    if (wasHidden) {
        renderReasoningLog(state.reasoningLog);
    }
    menu.hidden = true;
});

reasoningFeedClose?.addEventListener("click", () => {
    reasoningFeed.hidden = true;
});

resizeHandle?.addEventListener("mousedown", initResize);

capturePreview?.addEventListener("click", () => {
    if (!state.previewImageUrl) {
        window.petApi?.resumeContext();
        return;
    }
    const expanded = root.classList.toggle("preview-expanded");
    capturePreview.setAttribute("aria-expanded", String(expanded));
});

applyOptions();
renderState(state);
animate();
window.setInterval(animate, 90);
window.petApi?.onState(renderState);
