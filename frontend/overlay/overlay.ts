import "./overlay.scss";

type Point = { x: number; y: number };

type Animation = {
    active: boolean;
    age: number; // ms since start
    update: (dt: number) => void;
    draw: (ctx: CanvasRenderingContext2D) => void;
    done: () => boolean;
};

type OverlayAnimationCommand =
    | { type: "click"; x: number; y: number }
    | { type: "type"; x: number; y: number }
    | { type: "scroll"; x: number; y: number; direction?: "up" | "down" | "left" | "right" }
    | { type: "drag"; path: Array<Point> }
    | { type: "hover"; x: number; y: number }
    | { type: "trace"; path: Array<Point> }
    | { type: "wait"; x?: number; y?: number }
    | { type: "cursor_position"; x: number; y: number }
    | { type: "screenshot"; x?: number; y?: number; width?: number; height?: number }
    | { type: "hide" };

declare global {
    interface Window {
        overlayApi?: {
            onAnimation: (callback: (cmd: OverlayAnimationCommand) => void) => () => void;
        };
    }
}

const canvas = document.getElementById("overlay-canvas") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;

let displayWidth: number;
let displayHeight: number;
let dpr: number;

function resizeCanvas() {
    dpr = window.devicePixelRatio || 1;
    displayWidth = window.innerWidth;
    displayHeight = window.innerHeight;
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
    ctx.scale(dpr, dpr);
}

resizeCanvas();
window.addEventListener("resize", resizeCanvas);

const animations: Animation[] = [];
let lastTime = performance.now();
let rafId: number | null = null;

// ─── Animation Primitives ────────────────────────────────────────

function flashReticle(x: number, y: number): Animation {
    const duration = 600;
    let age = 0;
    return {
        active: true,
        age: 0,
        update(dt: number) {
            age += dt;
        },
        draw(c: CanvasRenderingContext2D) {
            const progress = Math.min(age / duration, 1);
            // Ring shrinks inward
            const outerR = 40 * (1 - progress * 0.7);
            const innerR = outerR * 0.3;
            const alpha = 1 - progress;

            c.save();
            c.translate(x, y);

            // Outer ring
            c.beginPath();
            c.arc(0, 0, outerR, 0, Math.PI * 2);
            c.strokeStyle = `rgba(52, 132, 255, ${alpha * 0.8})`;
            c.lineWidth = 2;
            c.stroke();

            // Inner dot
            c.beginPath();
            c.arc(0, 0, innerR, 0, Math.PI * 2);
            c.fillStyle = `rgba(52, 132, 255, ${alpha * 0.6})`;
            c.fill();

            // Crosshair lines
            const l = 8 * (1 - progress * 0.3);
            c.strokeStyle = `rgba(52, 132, 255, ${alpha * 0.5})`;
            c.lineWidth = 1;
            c.beginPath();
            c.moveTo(-l, 0);
            c.lineTo(l, 0);
            c.moveTo(0, -l);
            c.lineTo(0, l);
            c.stroke();

            c.restore();
        },
        done() {
            return age >= duration;
        },
    };
}

function typeGlow(x: number, y: number): Animation {
    const duration = 400;
    let age = 0;
    let pulseCount = 0;
    return {
        active: true,
        age: 0,
        update(dt: number) {
            age += dt;
            pulseCount = Math.floor(age / 120);
        },
        draw(c: CanvasRenderingContext2D) {
            const progress = Math.min(age / duration, 1);
            const alpha = 1 - progress;

            // Expanding ring pulse
            const pulsePhase = (age % 300) / 300;
            const r = 10 + pulsePhase * 20;
            const pulseAlpha = (1 - pulsePhase) * 0.5 * alpha;

            c.save();

            // Glow dot at insertion
            c.beginPath();
            c.arc(x, y, 3, 0, Math.PI * 2);
            c.fillStyle = `rgba(52, 132, 255, ${alpha * 0.7})`;
            c.fill();

            // Expanding ring
            c.beginPath();
            c.arc(x, y, r, 0, Math.PI * 2);
            c.strokeStyle = `rgba(52, 132, 255, ${pulseAlpha})`;
            c.lineWidth = 1.5;
            c.stroke();

            // Cursor line blink
            if (Math.floor(age / 200) % 2 === 0) {
                c.beginPath();
                c.moveTo(x, y - 8);
                c.lineTo(x, y + 8);
                c.strokeStyle = `rgba(52, 132, 255, ${alpha * 0.6})`;
                c.lineWidth = 1.5;
                c.stroke();
            }

            c.restore();
        },
        done() {
            return age >= duration;
        },
    };
}

function scrollSweep(x: number, y: number, direction: string): Animation {
    const duration = 700;
    let age = 0;
    const sweepLength = 120;
    return {
        active: true,
        age: 0,
        update(dt: number) {
            age += dt;
        },
        draw(c: CanvasRenderingContext2D) {
            const progress = Math.min(age / duration, 1);
            const alpha = 1 - progress;

            const dx = direction === "left" ? -1 : direction === "right" ? 1 : 0;
            const dy = direction === "up" ? -1 : direction === "down" ? 1 : 0;
            const sweepProgress = Math.min((age % 400) / 400, 1);

            c.save();
            c.globalAlpha = alpha * 0.3;

            // Sweep bands
            const numBands = 3;
            for (let i = 0; i < numBands; i++) {
                const bandProgress = ((sweepProgress + i / numBands) % 1);
                const bandAlpha = Math.sin(bandProgress * Math.PI) * 0.5;
                const offset = bandProgress * sweepLength;

                c.fillStyle = `rgba(52, 132, 255, ${bandAlpha})`;
                if (dy !== 0) {
                    c.fillRect(x - 20, y + offset * dy - 3, 40, 6);
                } else {
                    c.fillRect(x + offset * dx - 3, y - 20, 6, 40);
                }
            }

            // Direction arrow
            const arrowProgress = Math.min(age / duration, 1);
            if (arrowProgress < 0.8) {
                c.strokeStyle = `rgba(52, 132, 255, ${alpha * 0.6})`;
                c.lineWidth = 2;
                const arrowLen = 16 + Math.sin(age / 100) * 4;
                c.beginPath();
                c.moveTo(x, y);
                c.lineTo(x + dx * arrowLen, y + dy * arrowLen);
                c.stroke();
                // Arrowhead
                const aSize = 5;
                c.beginPath();
                c.moveTo(x + dx * arrowLen, y + dy * arrowLen);
                c.lineTo(x + dx * (arrowLen - aSize) + dy * aSize * 0.5, y + dy * (arrowLen - aSize) - dx * aSize * 0.5);
                c.moveTo(x + dx * arrowLen, y + dy * arrowLen);
                c.lineTo(x + dx * (arrowLen - aSize) - dy * aSize * 0.5, y + dy * (arrowLen - aSize) + dx * aSize * 0.5);
                c.stroke();
            }

            c.restore();
        },
        done() {
            return age >= duration;
        },
    };
}

function dragTrail(path: Point[]): Animation {
    const duration = 800;
    let age = 0;
    return {
        active: true,
        age: 0,
        update(dt: number) {
            age += dt;
        },
        draw(c: CanvasRenderingContext2D) {
            if (path.length < 2) return;
            const progress = Math.min(age / duration, 1);
            const alpha = 1 - progress;

            c.save();
            c.globalAlpha = alpha * 0.5;

            // Trail along path with gradient
            for (let i = 1; i < path.length; i++) {
                const t = i / path.length;
                c.beginPath();
                c.moveTo(path[i - 1].x, path[i - 1].y);
                c.lineTo(path[i].x, path[i].y);
                c.strokeStyle = `rgba(52, 132, 255, ${(1 - t) * alpha})`;
                c.lineWidth = 3 * (1 - t) + 1;
                c.stroke();
            }

            // Glow dot at end
            const end = path[path.length - 1];
            const grad = c.createRadialGradient(end.x, end.y, 0, end.x, end.y, 15);
            grad.addColorStop(0, `rgba(52, 132, 255, ${alpha * 0.8})`);
            grad.addColorStop(1, `rgba(52, 132, 255, 0)`);
            c.fillStyle = grad;
            c.beginPath();
            c.arc(end.x, end.y, 15, 0, Math.PI * 2);
            c.fill();

            c.restore();
        },
        done() {
            return age >= duration;
        },
    };
}

function hoverDot(x: number, y: number): Animation {
    const duration = 500;
    let age = 0;
    return {
        active: true,
        age: 0,
        update(dt: number) {
            age += dt;
        },
        draw(c: CanvasRenderingContext2D) {
            const progress = Math.min(age / duration, 1);
            const alpha = 1 - progress;
            const expandR = 4 + progress * 20;

            c.save();

            // Expanding dot
            const grad = c.createRadialGradient(x, y, 0, x, y, expandR);
            grad.addColorStop(0, `rgba(52, 132, 255, ${alpha * 0.6})`);
            grad.addColorStop(1, `rgba(52, 132, 255, 0)`);
            c.fillStyle = grad;
            c.beginPath();
            c.arc(x, y, expandR, 0, Math.PI * 2);
            c.fill();

            // Center point
            c.beginPath();
            c.arc(x, y, 3, 0, Math.PI * 2);
            c.fillStyle = `rgba(52, 132, 255, ${alpha * 0.8})`;
            c.fill();

            c.restore();
        },
        done() {
            return age >= duration;
        },
    };
}

function tracePath(path: Point[]): Animation {
    const duration = 600;
    let age = 0;
    return {
        active: true,
        age: 0,
        update(dt: number) {
            age += dt;
        },
        draw(c: CanvasRenderingContext2D) {
            if (path.length < 1) return;
            const progress = Math.min(age / duration, 1);
            const alpha = 1 - progress;
            const trailLen = Math.max(1, Math.floor(path.length * progress));
            const trail = path.slice(0, trailLen);

            c.save();

            // Draw path trail
            if (trail.length > 1) {
                for (let i = 1; i < trail.length; i++) {
                    c.beginPath();
                    c.moveTo(trail[i - 1].x, trail[i - 1].y);
                    c.lineTo(trail[i].x, trail[i].y);
                    c.strokeStyle = `rgba(52, 132, 255, ${alpha * 0.3})`;
                    c.lineWidth = 2;
                    c.stroke();
                }
            }

            // Moving dot at current position
            const current = trail[trail.length - 1] || path[0];
            const pulseR = 5 + Math.sin(age / 50) * 2;
            const grad = c.createRadialGradient(current.x, current.y, 0, current.x, current.y, pulseR + 10);
            grad.addColorStop(0, `rgba(52, 132, 255, ${alpha * 0.8})`);
            grad.addColorStop(1, `rgba(52, 132, 255, 0)`);
            c.fillStyle = grad;
            c.beginPath();
            c.arc(current.x, current.y, pulseR + 10, 0, Math.PI * 2);
            c.fill();

            c.beginPath();
            c.arc(current.x, current.y, 4, 0, Math.PI * 2);
            c.fillStyle = `rgba(255, 255, 255, ${alpha * 0.9})`;
            c.fill();

            c.restore();
        },
        done() {
            return age >= duration;
        },
    };
}

function waitIndicator(x: number, y: number): Animation {
    const duration = 1500;
    let age = 0;
    return {
        active: true,
        age: 0,
        update(dt: number) {
            age += dt;
        },
        draw(c: CanvasRenderingContext2D) {
            const progress = Math.min(age / duration, 1);
            const alpha = 1 - progress;

            c.save();

            // Pulsing ring
            const pulseR = 6 + Math.sin(age / 200) * 3;
            c.beginPath();
            c.arc(x, y, pulseR, 0, Math.PI * 2);
            c.strokeStyle = `rgba(52, 132, 255, ${alpha * 0.5})`;
            c.lineWidth = 2;
            c.setLineDash([3, 3]);
            c.stroke();
            c.setLineDash([]);

            // Dot
            c.beginPath();
            c.arc(x, y, 3, 0, Math.PI * 2);
            c.fillStyle = `rgba(52, 132, 255, ${alpha * 0.6})`;
            c.fill();

            c.restore();
        },
        done() {
            return age >= duration;
        },
    };
}

function cursorFlash(x: number, y: number): Animation {
    const duration = 300;
    let age = 0;
    return {
        active: true,
        age: 0,
        update(dt: number) {
            age += dt;
        },
        draw(c: CanvasRenderingContext2D) {
            const progress = Math.min(age / duration, 1);
            const alpha = 1 - progress;

            c.save();

            // Quick flash circle
            c.beginPath();
            c.arc(x, y, 6 + progress * 10, 0, Math.PI * 2);
            c.fillStyle = `rgba(52, 132, 255, ${alpha * 0.4})`;
            c.fill();

            // Sharp center dot
            c.beginPath();
            c.arc(x, y, 2, 0, Math.PI * 2);
            c.fillStyle = `rgba(52, 132, 255, ${alpha * 0.9})`;
            c.fill();

            c.restore();
        },
        done() {
            return age >= duration;
        },
    };
}

// ─── Animation Engine ────────────────────────────────────────────

function clearCanvas() {
    ctx.clearRect(0, 0, displayWidth, displayHeight);
}

function renderLoop(time: number) {
    const dt = Math.min(time - lastTime, 100); // cap dt at 100ms
    lastTime = time;

    clearCanvas();

    // Update + draw all active animations
    for (let i = animations.length - 1; i >= 0; i--) {
        const anim = animations[i];
        anim.update(dt);
        anim.draw(ctx);
        if (anim.done()) {
            animations.splice(i, 1);
        }
    }

    if (animations.length > 0) {
        rafId = requestAnimationFrame(renderLoop);
    } else {
        rafId = null;
    }
}

function startRenderLoop() {
    if (rafId != null) return;
    lastTime = performance.now();
    rafId = requestAnimationFrame(renderLoop);
}

function hideAllAnimations() {
    animations.length = 0;
    clearCanvas();
}

// ─── Command Handler ─────────────────────────────────────────────

function handleAnimationCommand(cmd: OverlayAnimationCommand) {
    switch (cmd.type) {
        case "hide":
            hideAllAnimations();
            break;
        case "click":
            animations.push(flashReticle(cmd.x, cmd.y));
            break;
        case "type":
            animations.push(typeGlow(cmd.x, cmd.y));
            break;
        case "scroll":
            animations.push(scrollSweep(cmd.x, cmd.y, cmd.direction ?? "down"));
            break;
        case "drag":
            if (cmd.path.length > 0) {
                animations.push(dragTrail(cmd.path));
            }
            break;
        case "hover":
            animations.push(hoverDot(cmd.x, cmd.y));
            break;
        case "trace":
            if (cmd.path.length > 0) {
                animations.push(tracePath(cmd.path));
            }
            break;
        case "wait":
            animations.push(waitIndicator(cmd.x ?? displayWidth / 2, cmd.y ?? displayHeight / 2));
            break;
        case "cursor_position":
            animations.push(cursorFlash(cmd.x, cmd.y));
            break;
        case "screenshot": {
            break;
        }
    }
    startRenderLoop();
}

// ─── IPC Binding ─────────────────────────────────────────────────

window.overlayApi?.onAnimation((cmd) => {
    handleAnimationCommand(cmd);
});
