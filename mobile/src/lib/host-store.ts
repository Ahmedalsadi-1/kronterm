import { KeychainAccess, SecureStorage } from "@aparajita/capacitor-secure-storage";
import { Capacitor } from "@capacitor/core";
import type { HostProfile } from "../types";
import { hostCapabilitiesForKind } from "./surface-model";

const HostStorageKey = "kronterm.hosts.v2";
const ManagedHostId = "kron-managed";
const DevelopmentHostId = "kron-local-development";
const HostColors = ["#2567f2", "#d34f2f", "#12866f", "#a66523", "#6c5bc6", "#297894"];

const isHostProfile = (value: unknown): value is HostProfile => {
    if (!value || typeof value !== "object") {
        return false;
    }
    const host = value as Partial<HostProfile>;
    return (
        typeof host.id === "string" &&
        typeof host.label === "string" &&
        typeof host.baseUrl === "string" &&
        (host.kind === "managed" || host.kind === "sandbox" || host.kind === "computer") &&
        typeof host.color === "string" &&
        Array.isArray(host.capabilities)
    );
};

const readStoredHosts = async (): Promise<HostProfile[]> => {
    let value: unknown = null;
    if (Capacitor.isNativePlatform()) {
        await SecureStorage.setKeyPrefix("kronterm_");
        value = await SecureStorage.get(HostStorageKey, false, false);
    } else {
        const serialized = window.sessionStorage.getItem(HostStorageKey);
        value = serialized ? JSON.parse(serialized) : null;
    }
    return Array.isArray(value) ? value.filter(isHostProfile) : [];
};

const writeStoredHosts = async (hosts: HostProfile[]): Promise<void> => {
    if (Capacitor.isNativePlatform()) {
        await SecureStorage.setKeyPrefix("kronterm_");
        await SecureStorage.set(HostStorageKey, hosts, false, false, KeychainAccess.whenUnlockedThisDeviceOnly);
        return;
    }
    window.sessionStorage.setItem(HostStorageKey, JSON.stringify(hosts));
};

const environmentManagedHost = (): HostProfile | null => {
    const baseUrl = import.meta.env.VITE_KRONTERM_CLOUD_URL?.trim();
    if (!baseUrl) {
        return null;
    }
    return {
        id: ManagedHostId,
        label: import.meta.env.VITE_KRONTERM_CLOUD_NAME?.trim() || "Kron Cloud",
        baseUrl,
        kind: "managed",
        color: HostColors[0],
        capabilities: hostCapabilitiesForKind("managed"),
        token: import.meta.env.DEV ? import.meta.env.VITE_KRONTERM_CLOUD_TOKEN?.trim() || undefined : undefined,
        createdAt: 0,
    };
};

const developmentHost = (): HostProfile | null => {
    if (!import.meta.env.DEV || Capacitor.isNativePlatform()) {
        return null;
    }
    if (window.location.hostname !== "127.0.0.1" && window.location.hostname !== "localhost") {
        return null;
    }
    return {
        id: DevelopmentHostId,
        label: "This KronTerm",
        baseUrl: `${window.location.origin}/_kronhost`,
        uiBaseUrl: import.meta.env.VITE_KRONTERM_LOCAL_URL?.trim() || "http://127.0.0.1:3107",
        kind: "computer",
        color: HostColors[1],
        capabilities: hostCapabilitiesForKind("computer"),
        createdAt: 0,
    };
};

export const loadHosts = async (): Promise<HostProfile[]> => {
    const stored = await readStoredHosts().catch(() => []);
    const managed = environmentManagedHost();
    const local = developmentHost();
    return [managed, local, ...stored]
        .filter((host): host is HostProfile => host != null)
        .filter((host, index, hosts) => hosts.findIndex((candidate) => candidate.id === host.id) === index);
};

export const saveHosts = async (hosts: HostProfile[]): Promise<void> => {
    await writeStoredHosts(hosts.filter((host) => host.id !== ManagedHostId && host.id !== DevelopmentHostId));
};

export const makeHostProfile = (
    input: Pick<HostProfile, "label" | "baseUrl" | "kind"> & Partial<Pick<HostProfile, "token" | "capabilities">>,
    existingCount: number
): HostProfile => ({
    id: crypto.randomUUID(),
    label: input.label.trim() || (input.kind === "computer" ? "My computer" : "Kron Sandbox"),
    baseUrl: input.baseUrl,
    kind: input.kind,
    color: HostColors[existingCount % HostColors.length],
    capabilities: input.capabilities?.length ? input.capabilities : hostCapabilitiesForKind(input.kind),
    token: input.token?.trim() || undefined,
    createdAt: Date.now(),
});
