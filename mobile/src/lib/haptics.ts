import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

export const tapHaptic = async (): Promise<void> => {
    await Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
};

export const selectionHaptic = async (): Promise<void> => {
    await Haptics.selectionChanged().catch(() => undefined);
};

export const resultHaptic = async (success: boolean): Promise<void> => {
    await Haptics.notification({ type: success ? NotificationType.Success : NotificationType.Error }).catch(
        () => undefined
    );
};
