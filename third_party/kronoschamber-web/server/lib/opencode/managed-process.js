const StartupOutputLimit = 64 * 1024;

function stopChild(child) {
    try {
        child.kill("SIGTERM");
    } catch {
        // The process already exited.
    }
}

export function waitForManagedServerProcess(child, { timeoutMs }) {
    return new Promise((resolve, reject) => {
        let startupOutput = "";
        let settled = false;

        const appendOutput = (chunk) => {
            if (settled) {
                return;
            }
            startupOutput = `${startupOutput}${chunk.toString()}`.slice(-StartupOutputLimit);
        };

        const removeLifecycleListeners = () => {
            child.off("exit", onExit);
            child.off("error", onError);
        };

        const removeAllListeners = () => {
            removeLifecycleListeners();
            child.stdout?.off("data", onStdout);
            child.stderr?.off("data", onStderr);
        };

        const fail = (error) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            removeAllListeners();
            stopChild(child);
            reject(error);
        };

        const succeed = (url) => {
            if (settled) {
                return;
            }
            settled = true;
            clearTimeout(timer);
            removeLifecycleListeners();
            resolve(url);
        };

        const onStdout = (chunk) => {
            appendOutput(chunk);
            if (settled) {
                return;
            }
            for (const line of startupOutput.split("\n")) {
                if (!line.trim().toLowerCase().startsWith("kronoscode server listening")) {
                    continue;
                }
                const match = line.match(/on\s+(https?:\/\/[^\s]+)/);
                if (!match) {
                    fail(new Error(`Failed to parse server url from output: ${line}`));
                    return;
                }
                succeed(match[1]);
                return;
            }
        };

        const onStderr = (chunk) => {
            appendOutput(chunk);
        };

        const onExit = (code) => {
            fail(new Error(`KronosCode exited with code ${code}. Output: ${startupOutput}`));
        };

        const onError = (error) => {
            fail(error);
        };

        const timer = setTimeout(() => {
            fail(new Error(`Timeout waiting for KronosCode to start after ${timeoutMs}ms`));
        }, timeoutMs);

        child.stdout?.on("data", onStdout);
        child.stderr?.on("data", onStderr);
        child.on("exit", onExit);
        child.on("error", onError);
    });
}

export function stopManagedServerProcess(child) {
    stopChild(child);
}
