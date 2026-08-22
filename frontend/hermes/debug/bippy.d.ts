// Stub type declarations for `bippy` — a dev-only React renderer inspector.
// Only imported by debug/render-counter.ts which is inert at runtime.

interface FiberHook {
    memoizedState: unknown;
    next?: FiberHook | null;
}

interface FiberContextDependency {
    context?: unknown;
    memoizedValue?: unknown;
    next?: FiberContextDependency | null;
}

export interface Fiber extends Record<string, unknown> {
    actualDuration?: number;
    alternate?: Fiber | null;
    dependencies?: { firstContext?: FiberContextDependency | null } | null;
    memoizedProps?: Record<string, unknown> | null;
    memoizedState?: FiberHook | null;
    return?: Fiber | null;
}

export function didFiberRender(fiber: Fiber): boolean;
export function getDisplayName(fiber: Fiber): string;
export function instrument(callbacks: { onCommitFiberRoot(id: unknown, root: Fiber): void }): () => void;
export function isCompositeFiber(fiber: Fiber): boolean;
export function traverseRenderedFibers(fiber: Fiber, callback: (child: Fiber) => void): void;
