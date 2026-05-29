import "./pet.scss";

type PetContext = "idle" | "terminal" | "browser" | "desktop" | "file" | "thinking";
type PetCursorAction = "idle" | "click" | "type" | "scroll" | "hover" | null;
type PetState = {
    context: PetContext;
    detail: string;
    thought?: string;
    active: boolean;
    moving: boolean;
    cursorAction?: PetCursorAction;
    cursorPoint?: { x: number; y: number } | null;
    reasoningLog?: string[];
    previewImageUrl?: string;
};
type PetOptions = {
    glow: boolean;
    thoughts: boolean;
    actions: boolean;
    roam: boolean;
    followUserCursor: boolean;
};

declare global {
    interface Window {
        petApi?: {
            onState: (callback: (state: PetState) => void) => () => void;
            updateOptions: (options: Partial<PetOptions>) => void;
            sendChat: (text: string) => void;
        };
    }
}

function sortedFrames(images: Record<string, string>): string[] {
    return Object.entries(images)
        .sort(([a], [b]) => {
            const first = Number(a.match(/-(\d+)\.png$/)?.[1] ?? 0);
            const second = Number(b.match(/-(\d+)\.png$/)?.[1] ?? 0);
            return first - second;
        })
        .map(([, src]) => src);
}

const idleFrames = sortedFrames(
    import.meta.glob("../../assets/idle/*.png", { eager: true, import: "default", query: "?url" }) as unknown as Record<
        string,
        string
    >
);
const walkFrames = sortedFrames(
    import.meta.glob("../../assets/walk/*.png", { eager: true, import: "default", query: "?url" }) as unknown as Record<
        string,
        string
    >
);
const root = document.getElementById("pet-root");
const sprite = document.getElementById("pet-sprite") as HTMLImageElement;
const thought = document.getElementById("thought");
const action = document.getElementById("action");
const context = document.getElementById("context");
const detail = document.getElementById("detail");
const menuToggle = document.getElementById("pet-menu-toggle");
const menu = document.getElementById("pet-menu");
const chatToggle = document.getElementById("chat-toggle");
const chat = document.getElementById("pet-chat") as HTMLFormElement;
const chatInput = document.getElementById("pet-chat-input") as HTMLInputElement;
const optionControls = {
    glow: document.getElementById("toggle-glow") as HTMLInputElement,
    thoughts: document.getElementById("toggle-thoughts") as HTMLInputElement,
    actions: document.getElementById("toggle-actions") as HTMLInputElement,
    roam: document.getElementById("toggle-roam") as HTMLInputElement,
    followUserCursor: document.getElementById("toggle-follow-cursor") as HTMLInputElement,
};

const petCursor = document.getElementById("pet-cursor");
const petCursorIcon = document.getElementById("pet-cursor-icon");

const reasoningToggle = document.getElementById("reasoning-toggle");
const reasoningFeed = document.getElementById("reasoning-feed");
const reasoningFeedBody = document.getElementById("reasoning-feed-body");
const reasoningFeedClose = document.getElementById("reasoning-feed-close");

const resizeHandle = document.getElementById("resize-handle");
const capturePreview = document.getElementById("capture-preview");
const capturePreviewImage = document.getElementById("capture-preview-image") as HTMLImageElement;

const cursorIcons: Record<string, string> = {
    click: "👆",
    type: "⌨️",
    scroll: "📜",
    hover: "🖐️",
};

let frame = 0;
let options: PetOptions = {
    glow: true,
    thoughts: true,
    actions: true,
    roam: true,
    followUserCursor: true,
};
let state: PetState = {
    context: "idle",
    detail: "KronosCode ready",
    active: false,
    moving: false,
    cursorAction: "idle",
    cursorPoint: null,
    reasoningLog: [],
};
let resizeActive = false;
let resizeStartX = 0;
let resizeStartY = 0;
let resizeStartW = 0;
let resizeStartH = 0;

function applyOptions() {
    root.classList.toggle("glow-disabled", !options.glow);
    localStorage.setItem("kronos-pet-options", JSON.stringify(options));
    window.petApi?.updateOptions({ roam: options.roam, followUserCursor: options.followUserCursor });
    renderState(state);
}

function renderCursor(action: PetCursorAction, point: { x: number; y: number } | null | undefined) {
    if (action == null || action === "idle" || !petCursor || !petCursorIcon) {
        petCursor?.setAttribute("hidden", "");
        return;
    }
    const icon = cursorIcons[action] ?? "👆";
    petCursorIcon.textContent = icon;
    petCursor.className = `pet-cursor cursor-${action}`;

    if (point && typeof point.x === "number" && typeof point.y === "number") {
        const maxX = window.innerWidth - 40;
        const maxY = window.innerHeight - 40;
        const px = Math.min(point.x, maxX);
        const py = Math.min(point.y, maxY);
        petCursor.style.left = `${px}px`;
        petCursor.style.top = `${py}px`;
    } else {
        petCursor.style.left = "";
        petCursor.style.top = "";
    }
    petCursor.removeAttribute("hidden");
}

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

function renderState(nextState: PetState) {
    const prevAction = state.cursorAction;
    state = nextState;
    root.classList.remove(
        "context-idle",
        "context-terminal",
        "context-browser",
        "context-desktop",
        "context-file",
        "context-thinking",
        "is-active"
    );
    root.classList.add(`context-${state.context}`);
    root.classList.toggle("is-active", state.active);
    context.textContent = state.context.toUpperCase();
    detail.textContent = state.detail;

    if (!reasoningFeed?.hidden) {
        renderReasoningLog(state.reasoningLog);
    }

    const showThought = options.thoughts && state.thought && !state.cursorAction;
    thought.textContent = state.thought ?? "";
    thought.hidden = !showThought;

    const showAction = options.actions && state.active && state.context !== "thinking" && !state.cursorAction;
    action.textContent = state.detail;
    action.hidden = !showAction;

    renderCursor(state.cursorAction, state.cursorPoint);
    if (capturePreview && capturePreviewImage) {
        if (state.previewImageUrl) {
            capturePreviewImage.src = state.previewImageUrl;
            capturePreview.removeAttribute("hidden");
        } else {
            capturePreview.setAttribute("hidden", "");
            capturePreviewImage.removeAttribute("src");
        }
    }
}

function animate() {
    const frames = state.moving ? walkFrames : idleFrames;
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
} catch {
    localStorage.removeItem("kronos-pet-options");
}

Object.entries(optionControls).forEach(([key, control]) => {
    control.checked = options[key as keyof PetOptions];
    control.addEventListener("change", () => {
        options = { ...options, [key]: control.checked };
        applyOptions();
    });
});
menuToggle.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
});
root.addEventListener("dblclick", (event) => {
    if ((event.target as HTMLElement).closest("input, button, form")) {
        return;
    }
    menu.hidden = !menu.hidden;
});
chatToggle.addEventListener("click", () => {
    chat.hidden = !chat.hidden;
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

applyOptions();
renderState(state);
animate();
window.setInterval(animate, 90);
window.petApi?.onState(renderState);
