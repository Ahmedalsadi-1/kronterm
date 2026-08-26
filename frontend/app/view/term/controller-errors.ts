// Copyright (c) 2026 KronTerm. Licensed under the Apache License, Version 2.0 (the "License").

export function isControllerInputUnavailableError(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes("no controller found for block") || message.includes("no shell input chan");
}
