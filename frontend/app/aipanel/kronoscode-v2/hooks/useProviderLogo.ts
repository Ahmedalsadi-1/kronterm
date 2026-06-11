import { useState, useCallback } from 'react';

import codebuddyLogo from "../../agent-logos/codebuddy.svg?url";
import codexLogo from "../../agent-logos/codex.svg?url";
import droidLogo from "../../agent-logos/droid.svg?url";
import geminiLogo from "../../agent-logos/gemini.png";
import hermesLogo from "../../agent-logos/hermes.svg?url";
import kiroLogo from "../../agent-logos/kiro.ico";
import kronoscodeLogo from "../../agent-logos/kronoscode.svg?url";
import opencodeLogo from "../../agent-logos/opencode.svg?url";
import qwenLogo from "../../agent-logos/qwen.svg?url";

interface UseProviderLogoReturn {
    src: string | null;
    onError: () => void;
    hasLogo: boolean;
}

const LOCAL_PROVIDER_LOGO_MAP = new Map<string, string>([
    ['codebuddy', codebuddyLogo],
    ['codex', codexLogo],
    ['openai', codexLogo],
    ['droid', droidLogo],
    ['gemini', geminiLogo],
    ['hermes', hermesLogo],
    ['anthropic', hermesLogo], // Approximation
    ['kiro', kiroLogo],
    ['kronoscode', kronoscodeLogo],
    ['opencode', opencodeLogo],
    ['qwen', qwenLogo],
]);

export function useProviderLogo(providerId: string | null | undefined): UseProviderLogoReturn {
    const normalizedId = providerId?.toLowerCase() ?? null;
    const [hasError, setHasError] = useState(false);

    const handleError = useCallback(() => {
        setHasError(true);
    }, []);

    if (!normalizedId || hasError) {
        return { src: null, onError: handleError, hasLogo: false };
    }

    const localLogoSrc = LOCAL_PROVIDER_LOGO_MAP.get(normalizedId) || null;

    if (localLogoSrc) {
        return {
            src: localLogoSrc,
            onError: handleError,
            hasLogo: true,
        };
    }

    return { src: null, onError: handleError, hasLogo: false };
}
