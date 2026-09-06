export type MobileLifecycleAction = "none" | "pause" | "resume";

export interface MobileLifecycleTransition {
    active: boolean;
    action: MobileLifecycleAction;
}

const GatewayReconnectDelaysMs = [1_000, 2_000, 5_000, 10_000, 20_000];

export const gatewayReconnectDelay = (attempt: number): number =>
    GatewayReconnectDelaysMs[Math.min(Math.max(0, attempt), GatewayReconnectDelaysMs.length - 1)];

export const transitionMobileLifecycle = (currentActive: boolean, nextActive: boolean): MobileLifecycleTransition => {
    if (currentActive === nextActive) {
        return { active: currentActive, action: "none" };
    }
    return {
        active: nextActive,
        action: nextActive ? "resume" : "pause",
    };
};
