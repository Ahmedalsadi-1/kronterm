// Stub type declarations for `bippy` — a dev-only React renderer inspector.
// Only imported by debug/render-counter.ts which is inert at runtime.

export type Fiber = Record<string, unknown>

export function didFiberRender(fiber: Fiber): boolean
export function getDisplayName(type: unknown): string
export function instrument(callback: (fiber: Fiber) => void): () => void
export function isCompositeFiber(fiber: Fiber): boolean
export function traverseRenderedFibers(fiber: Fiber, callback: (child: Fiber) => void): void
