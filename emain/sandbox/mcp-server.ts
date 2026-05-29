import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { sandboxManager } from "./sandbox-manager";

// Create server instance
const server = new McpServer({
    name: "kronterm-sandbox",
    version: "1.0.0",
});

// Define tools
server.tool(
    "start_sandbox",
    "Start the Ubuntu Sandbox VM",
    {},
    async () => {
        try {
            await sandboxManager.start();
            return {
                content: [{ type: "text", text: "Sandbox started successfully. VNC available at localhost:5901 (WS: 5902)." }],
            };
        } catch (error: any) {
            return {
                content: [{ type: "text", text: `Error starting sandbox: ${error.message}` }],
                isError: true,
            };
        }
    }
);

server.tool(
    "stop_sandbox",
    "Stop the Ubuntu Sandbox VM",
    {},
    async () => {
        try {
            await sandboxManager.stop();
            return {
                content: [{ type: "text", text: "Sandbox stopped." }],
            };
        } catch (error: any) {
            return {
                content: [{ type: "text", text: `Error stopping sandbox: ${error.message}` }],
                isError: true,
            };
        }
    }
);

server.tool(
    "desktop_screenshot",
    "Take a screenshot of the desktop",
    {},
    async () => {
        try {
            const base64Image = await sandboxManager.desktopScreenshot();
            return {
                content: [
                    { type: "image", data: base64Image, mimeType: "image/png" },
                    { type: "text", text: "Screenshot taken." }
                ],
            };
        } catch (error: any) {
             return {
                content: [{ type: "text", text: `Error taking screenshot: ${error.message}` }],
                isError: true,
            };
        }
    }
);

server.tool(
    "desktop_mouse_move",
    "Move the mouse cursor",
    {
        x: z.number().describe("X coordinate"),
        y: z.number().describe("Y coordinate"),
    },
    async ({ x, y }) => {
        try {
            await sandboxManager.desktopMouseMove(x, y);
            return {
                content: [{ type: "text", text: `Mouse moved to ${x}, ${y}` }],
            };
        } catch (error: any) {
            return {
                content: [{ type: "text", text: `Error moving mouse: ${error.message}` }],
                isError: true,
            };
        }
    }
);

server.tool(
    "desktop_mouse_click",
    "Click a mouse button",
    {
        button: z.enum(["left", "right", "middle"]).optional().describe("Button to click (default: left)"),
    },
    async ({ button }) => {
        try {
            await sandboxManager.desktopMouseClick(button || "left");
            return {
                content: [{ type: "text", text: `Clicked ${button || "left"} button` }],
            };
        } catch (error: any) {
            return {
                content: [{ type: "text", text: `Error clicking mouse: ${error.message}` }],
                isError: true,
            };
        }
    }
);

server.tool(
    "desktop_keyboard_type",
    "Type text using the keyboard",
    {
        text: z.string().describe("Text to type"),
    },
    async ({ text }) => {
        try {
            await sandboxManager.desktopKeyboardType(text);
            return {
                content: [{ type: "text", text: `Typed text: ${text}` }],
            };
        } catch (error: any) {
            return {
                content: [{ type: "text", text: `Error typing text: ${error.message}` }],
                isError: true,
            };
        }
    }
);

server.tool(
    "desktop_key_press",
    "Press a specific key combination",
    {
        key: z.string().describe("Key to press (e.g. 'Return', 'ctrl+c')"),
    },
    async ({ key }) => {
        try {
            await sandboxManager.desktopKeyPress(key);
            return {
                content: [{ type: "text", text: `Pressed key: ${key}` }],
            };
        } catch (error: any) {
            return {
                content: [{ type: "text", text: `Error pressing key: ${error.message}` }],
                isError: true,
            };
        }
    }
);

// Start server on stdio
const transport = new StdioServerTransport();
server.connect(transport).catch((err) => {
    console.error("MCP Server Error:", err);
    process.exit(1);
});
