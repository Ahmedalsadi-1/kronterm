import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as net from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { Client } from "ssh2";
import { WebSocket, WebSocketServer } from "ws";

const SSH_PORT = 2222;
const VNC_PORT = 5901;
const WS_PORT = 5902; // Port for noVNC WebSocket proxy

function getSandboxDataDir(): string {
    const home = os.homedir();
// Default to ~/.kronterm/sandbox
return path.join(home, ".kronterm", "sandbox");
}

export class SandboxManager {
    private qemuProcess: child_process.ChildProcess | null = null;
    private sshClient: Client | null = null;
    private wsServer: WebSocketServer | null = null;
    private isRunning = false;

    constructor() {}

    async start() {
        if (this.isRunning) {
            console.log("Sandbox already running");
            return;
        }

        const dataDir = getSandboxDataDir();
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        const diskImage = path.join(dataDir, "ubuntu-desktop.qcow2");
        const seedIso = path.join(dataDir, "seed.iso");

        if (!fs.existsSync(diskImage) || !fs.existsSync(seedIso)) {
            throw new Error(`Sandbox images not found in ${dataDir}. Please run setup script.`);
        }

        console.log("Starting QEMU Sandbox...");

        // QEMU command for M3 Pro (macOS/ARM64)
        const args = [
            "-machine", "virt,accel=hvf,highmem=on",
            "-cpu", "host",
            "-smp", "2",
            "-m", "4G",
            "-drive", `file=${diskImage},format=qcow2,if=virtio`,
            "-drive", `file=${seedIso},format=raw,if=virtio`,
            "-net", "nic,model=virtio",
            "-net", `user,hostfwd=tcp::${SSH_PORT}-:22,hostfwd=tcp::${VNC_PORT}-:5901`,
            "-display", "none", // Headless, we use VNC
            "-vga", "virtio", // Or std
        ];

        this.qemuProcess = child_process.spawn("qemu-system-aarch64", args, {
            stdio: "inherit",
            detached: false,
        });

        this.isRunning = true;
        this.startVncProxy();

        console.log("QEMU started. Waiting for SSH...");
        await this.waitForSSH();
        console.log("Sandbox Ready.");
    }

    async stop() {
        if (this.qemuProcess) {
            this.qemuProcess.kill();
            this.qemuProcess = null;
        }
        if (this.wsServer) {
            this.wsServer.close();
            this.wsServer = null;
        }
        if (this.sshClient) {
            this.sshClient.end();
            this.sshClient = null;
        }
        this.isRunning = false;
        console.log("Sandbox stopped.");
    }

    private startVncProxy() {
        this.wsServer = new WebSocketServer({ port: WS_PORT });
        console.log(`VNC WebSocket Proxy listening on port ${WS_PORT}`);

        this.wsServer.on("connection", (ws: WebSocket) => {
            const tcpSocket = net.createConnection(VNC_PORT, "localhost", () => {
                console.log("Connected to QEMU VNC");
            });

            ws.on("message", (msg) => {
                tcpSocket.write(msg as Buffer);
            });

            tcpSocket.on("data", (data) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(data);
                }
            });

            ws.on("close", () => tcpSocket.end());
            tcpSocket.on("close", () => ws.close());
            tcpSocket.on("error", (err) => console.error("VNC TCP Error:", err));
        });
    }

    private async waitForSSH(retries = 30): Promise<void> {
        return new Promise((resolve, reject) => {
            const attempt = (n: number) => {
                const conn = new Client();
                conn.on("ready", () => {
                    conn.end();
                    this.sshClient = new Client();
                    // Connect persistently
                    this.sshClient.connect({
                        host: "localhost",
                        port: SSH_PORT,
                        username: "ubuntu",
                        password: "password", // Default from cloud-init script
                    });
                    this.sshClient.on("ready", () => resolve());
                }).on("error", (err) => {
                    if (n <= 0) return reject(err);
                    setTimeout(() => attempt(n - 1), 2000);
                }).connect({
                    host: "localhost",
                    port: SSH_PORT,
                    username: "ubuntu",
                    password: "password",
                });
            };
            attempt(retries);
        });
    }

    // MCP Tools Execution
    async executeCommand(command: string): Promise<string> {
        if (!this.sshClient) throw new Error("SSH not connected");
        
        return new Promise((resolve, reject) => {
            this.sshClient!.exec(command, (err, stream) => {
                if (err) return reject(err);
                let stdout = "";
                let stderr = "";
                stream.on("data", (data: Buffer) => stdout += data.toString());
                stream.stderr.on("data", (data: Buffer) => stderr += data.toString());
                stream.on("close", (code: number) => {
                    if (code !== 0) reject(new Error(`Command failed: ${stderr}`));
                    else resolve(stdout.trim());
                });
            });
        });
    }

    async desktopScreenshot(): Promise<string> {
        // Scrot to /tmp, then cat base64
        const cmd = "export DISPLAY=:1 && scrot /tmp/shot.png && base64 /tmp/shot.png && rm /tmp/shot.png";
        return this.executeCommand(cmd);
    }

    async desktopMouseMove(x: number, y: number): Promise<string> {
        return this.executeCommand(`export DISPLAY=:1 && xdotool mousemove ${x} ${y}`);
    }

    async desktopMouseClick(button: "left" | "right" | "middle" = "left"): Promise<string> {
        const btnMap = { left: 1, middle: 2, right: 3 };
        return this.executeCommand(`export DISPLAY=:1 && xdotool click ${btnMap[button]}`);
    }

    async desktopKeyboardType(text: string): Promise<string> {
        // Escape special chars for bash
        const safeText = text.replace(/'/g, "'\\''"); 
        return this.executeCommand(`export DISPLAY=:1 && xdotool type '${safeText}'`);
    }

    async desktopKeyPress(key: string): Promise<string> {
        return this.executeCommand(`export DISPLAY=:1 && xdotool key ${key}`);
    }
}

export const sandboxManager = new SandboxManager();
