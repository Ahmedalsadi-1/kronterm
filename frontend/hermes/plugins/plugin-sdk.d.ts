// Stub type declarations for @hermes/plugin-sdk.
// This module is not used at runtime in the KronTerm shim — only the plugin
// source files reference it for type-checking.

export interface PluginContext {
    [key: string]: unknown
}

export interface PluginManifest {
    id: string
    name: string
    version: string
    [key: string]: unknown
}

export function registerPlugin(manifest: PluginManifest, context: PluginContext): void
export function usePluginContext(): PluginContext
