import { createContext, type ReactNode, useContext } from "react";

export interface KronTermSettingsSectionDescriptor {
    id: string;
    label: string;
}

export interface KronTermSettingsHost {
    renderSection: (sectionId: string) => ReactNode;
    sections: readonly KronTermSettingsSectionDescriptor[];
}

const KronTermSettingsPrefix = "kronterm:";

export function makeKronTermSettingsViewId(sectionId: string): `kronterm:${string}` {
    return `${KronTermSettingsPrefix}${sectionId}`;
}

export function getKronTermSettingsSectionId(viewId: string): string | null {
    return viewId.startsWith(KronTermSettingsPrefix) ? viewId.slice(KronTermSettingsPrefix.length) : null;
}

const KronTermSettingsHostContext = createContext<KronTermSettingsHost | null>(null);

export function KronTermSettingsHostProvider({
    children,
    value,
}: {
    children: ReactNode;
    value: KronTermSettingsHost | null;
}) {
    return <KronTermSettingsHostContext.Provider value={value}>{children}</KronTermSettingsHostContext.Provider>;
}

export function useKronTermSettingsHost(): KronTermSettingsHost | null {
    return useContext(KronTermSettingsHostContext);
}
