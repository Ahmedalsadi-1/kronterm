package aiusechat

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/wavetermdev/waveterm/pkg/aiusechat/uctypes"
	sandboxmanager "github.com/wavetermdev/waveterm/pkg/sandbox/manager"
)

func GetSandboxStartToolDefinition() uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "sandbox_start",
		Description: "Start a local Ubuntu desktop sandbox VM for AI agent control. The VM runs xfce4 desktop with VNC and SSH access.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"sessionId": map[string]any{
					"type":        "string",
					"description": "Unique session identifier (optional, auto-generated if not provided)",
				},
				"mode": map[string]any{
					"type":        "string",
					"description": "Sandbox presentation mode: 'desktop' or 'background'",
					"enum":        []string{sandboxmanager.SandboxModeDesktop, sandboxmanager.SandboxModeBackground},
				},
				"browserUrl": map[string]any{
					"type":        "string",
					"description": "Browser URL to associate with background mode",
				},
				"ensureBrowser": map[string]any{
					"type":        "boolean",
					"description": "When true, signals the UI to ensure a linked browser widget exists",
				},
			},
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			ctx := context.Background()
			sessionId := "default"
			mode := sandboxmanager.SandboxModeDesktop
			browserURL := sandboxmanager.SandboxDefaultBrowserURL
			ensureBrowser := false
			if inputMap, ok := input.(map[string]any); ok {
				if sid, ok := inputMap["sessionId"].(string); ok && sid != "" {
					sessionId = sid
				}
				if modeValue, ok := inputMap["mode"].(string); ok && modeValue != "" {
					mode = modeValue
				}
				if browserURLValue, ok := inputMap["browserUrl"].(string); ok && browserURLValue != "" {
					browserURL = browserURLValue
				}
				if ensureBrowserValue, ok := inputMap["ensureBrowser"].(bool); ok {
					ensureBrowser = ensureBrowserValue
				}
			}
			sm := sandboxmanager.GetSandboxManager()
			session, err := sm.Start(ctx, sandboxmanager.StartOpts{
				SessionID:  sessionId,
				Mode:       mode,
				BrowserURL: browserURL,
			})
			if err != nil {
				return nil, fmt.Errorf("failed to start sandbox: %w", err)
			}
			config := session.Config
			sshPort := 0
			vncPort := 0
			sshConn := ""
			if config != nil {
				sshPort = config.SSHPort
				vncPort = config.VNCPort
				sshConn = fmt.Sprintf("ssh ubuntu@localhost -p %d", config.SSHPort)
			}
			return map[string]any{
				"sessionId":     session.SessionID,
				"status":        session.Status,
				"mode":          session.Mode,
				"browserUrl":    session.BrowserURL,
				"runtime":       session.Runtime,
				"ensureBrowser": ensureBrowser,
				"vncPort":       vncPort,
				"sshPort":       sshPort,
				"vncWsUrl":      sandboxmanager.MakeVNCWsURL(session.SessionID),
				"desktopUrl":    session.DesktopURL,
				"mcpUrl":        session.MCPURL,
				"sshConn":       sshConn,
				"password":      sandboxmanager.SandboxDefaultPassword,
				"error":         session.LastError,
			}, nil
		},
	}
}

func GetSandboxStopToolDefinition() uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "sandbox_stop",
		Description: "Stop the running sandbox VM session.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"sessionId": map[string]any{
					"type":        "string",
					"description": "Session ID to stop (default: 'default')",
				},
			},
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			sessionId := "default"
			if inputMap, ok := input.(map[string]any); ok {
				if sid, ok := inputMap["sessionId"].(string); ok && sid != "" {
					sessionId = sid
				}
			}
			sm := sandboxmanager.GetSandboxManager()
			if err := sm.Stop(sessionId); err != nil {
				return nil, fmt.Errorf("failed to stop sandbox: %w", err)
			}
			return map[string]any{"status": "stopped"}, nil
		},
	}
}

func GetSandboxStatusToolDefinition() uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "sandbox_status",
		Description: "Check the status of the sandbox VM.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"sessionId": map[string]any{
					"type":        "string",
					"description": "Session ID to check (default: 'default')",
				},
			},
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			sessionId := "default"
			if inputMap, ok := input.(map[string]any); ok {
				if sid, ok := inputMap["sessionId"].(string); ok && sid != "" {
					sessionId = sid
				}
			}
			sm := sandboxmanager.GetSandboxManager()
			session, err := sm.GetStatus(sessionId)
			if err != nil {
				return nil, err
			}
			config := session.Config
			sshPort := 0
			vncPort := 0
			sshConn := ""
			if config != nil {
				sshPort = config.SSHPort
				vncPort = config.VNCPort
				sshConn = fmt.Sprintf("ssh ubuntu@localhost -p %d", config.SSHPort)
			}
			return map[string]any{
				"sessionId":  session.SessionID,
				"status":     session.Status,
				"mode":       session.Mode,
				"runtime":    session.Runtime,
				"vncPort":    vncPort,
				"sshPort":    sshPort,
				"vncWsUrl":   sandboxmanager.MakeVNCWsURL(session.SessionID),
				"desktopUrl": session.DesktopURL,
				"mcpUrl":     session.MCPURL,
				"sshConn":    sshConn,
				"error":      session.LastError,
			}, nil
		},
	}
}

func GetDesktopScreenshotToolDefinition() uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "desktop_screenshot",
		Description: "Take a screenshot of the sandbox desktop VM. Returns base64-encoded PNG image.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"sessionId": map[string]any{
					"type":        "string",
					"description": "Session ID (default: 'default')",
				},
			},
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			sessionId := "default"
			if inputMap, ok := input.(map[string]any); ok {
				if sid, ok := inputMap["sessionId"].(string); ok && sid != "" {
					sessionId = sid
				}
			}
			sm := sandboxmanager.GetSandboxManager()
			session, err := sm.GetStatus(sessionId)
			if err != nil {
				return nil, err
			}
			if session.Runtime == sandboxmanager.SandboxRuntimeBytebot {
				return bytebotAction(session, map[string]any{"action": "screenshot"})
			}
			if session.Config == nil {
				return nil, fmt.Errorf("sandbox not running, start it first with sandbox_start")
			}
			return takeScreenshot(session.Config.SSHPort)
		},
	}
}

func GetDesktopMouseMoveToolDefinition() uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "desktop_mouse_move",
		Description: "Move the mouse cursor to specified X,Y coordinates on the sandbox desktop.",
		InputSchema: map[string]any{
			"type":     "object",
			"required": []string{"x", "y"},
			"properties": map[string]any{
				"x": map[string]any{
					"type":        "integer",
					"description": "X coordinate",
				},
				"y": map[string]any{
					"type":        "integer",
					"description": "Y coordinate",
				},
				"sessionId": map[string]any{
					"type":        "string",
					"description": "Session ID (default: 'default')",
				},
			},
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap := input.(map[string]any)
			x := int(inputMap["x"].(float64))
			y := int(inputMap["y"].(float64))
			sessionId := "default"
			if sid, ok := inputMap["sessionId"].(string); ok {
				sessionId = sid
			}
			sm := sandboxmanager.GetSandboxManager()
			session, err := sm.GetStatus(sessionId)
			if err != nil {
				return nil, err
			}
			if session.Runtime == sandboxmanager.SandboxRuntimeBytebot {
				return bytebotAction(session, map[string]any{
					"action": "move_mouse",
					"coordinates": map[string]any{
						"x": x,
						"y": y,
					},
				})
			}
			if session.Config == nil {
				return nil, fmt.Errorf("sandbox not running")
			}
			return moveMouse(session.Config.SSHPort, x, y)
		},
	}
}

func GetDesktopMouseClickToolDefinition() uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "desktop_mouse_click",
		Description: "Click the mouse at current position or specified X,Y coordinates.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"x": map[string]any{
					"type":        "integer",
					"description": "X coordinate (optional)",
				},
				"y": map[string]any{
					"type":        "integer",
					"description": "Y coordinate (optional)",
				},
				"button": map[string]any{
					"type":        "string",
					"description": "Mouse button: 1=left, 2=middle, 3=right (default: 1)",
				},
				"sessionId": map[string]any{
					"type":        "string",
					"description": "Session ID (default: 'default')",
				},
			},
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap := input.(map[string]any)
			sessionId := "default"
			if sid, ok := inputMap["sessionId"].(string); ok {
				sessionId = sid
			}
			sm := sandboxmanager.GetSandboxManager()
			session, err := sm.GetStatus(sessionId)
			if err != nil {
				return nil, err
			}
			if session.Runtime == sandboxmanager.SandboxRuntimeBytebot {
				return bytebotClickMouse(session, inputMap)
			}
			if session.Config == nil {
				return nil, fmt.Errorf("sandbox not running")
			}
			return clickMouse(session.Config.SSHPort, inputMap)
		},
	}
}

func GetDesktopKeyboardTypeToolDefinition() uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "desktop_keyboard_type",
		Description: "Type text into the sandbox desktop.",
		InputSchema: map[string]any{
			"type":     "object",
			"required": []string{"text"},
			"properties": map[string]any{
				"text": map[string]any{
					"type":        "string",
					"description": "Text to type",
				},
				"sessionId": map[string]any{
					"type":        "string",
					"description": "Session ID (default: 'default')",
				},
			},
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap := input.(map[string]any)
			text := inputMap["text"].(string)
			sessionId := "default"
			if sid, ok := inputMap["sessionId"].(string); ok {
				sessionId = sid
			}
			sm := sandboxmanager.GetSandboxManager()
			session, err := sm.GetStatus(sessionId)
			if err != nil {
				return nil, err
			}
			if session.Runtime == sandboxmanager.SandboxRuntimeBytebot {
				return bytebotAction(session, map[string]any{
					"action": "type_text",
					"text":   text,
				})
			}
			if session.Config == nil {
				return nil, fmt.Errorf("sandbox not running")
			}
			return typeText(session.Config.SSHPort, text)
		},
	}
}

func GetDesktopKeyboardPressToolDefinition() uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "desktop_keyboard_press",
		Description: "Press a keyboard key on the sandbox desktop.",
		InputSchema: map[string]any{
			"type":     "object",
			"required": []string{"key"},
			"properties": map[string]any{
				"key": map[string]any{
					"type":        "string",
					"description": "Key to press (e.g., 'Return', 'Tab', 'Escape', 'a', 'ctrl+c')",
				},
				"sessionId": map[string]any{
					"type":        "string",
					"description": "Session ID (default: 'default')",
				},
			},
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap := input.(map[string]any)
			key := inputMap["key"].(string)
			sessionId := "default"
			if sid, ok := inputMap["sessionId"].(string); ok {
				sessionId = sid
			}
			sm := sandboxmanager.GetSandboxManager()
			session, err := sm.GetStatus(sessionId)
			if err != nil {
				return nil, err
			}
			if session.Runtime == sandboxmanager.SandboxRuntimeBytebot {
				return bytebotAction(session, map[string]any{
					"action": "type_keys",
					"keys":   strings.Split(key, "+"),
				})
			}
			if session.Config == nil {
				return nil, fmt.Errorf("sandbox not running")
			}
			return pressKey(session.Config.SSHPort, key)
		},
	}
}

func bytebotAction(session *sandboxmanager.Session, payload map[string]any) (any, error) {
	baseURL := strings.TrimRight(session.DesktopURL, "/")
	if baseURL == "" {
		return nil, fmt.Errorf("bytebot runtime URL is not configured")
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	client := http.Client{Timeout: 30 * time.Second}
	resp, err := client.Post(baseURL+"/computer-use", "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("bytebot action failed: %w", err)
	}
	defer resp.Body.Close()
	var result map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("bytebot action returned HTTP %d: %v", resp.StatusCode, result)
	}
	if success, ok := result["success"].(bool); ok && !success {
		return nil, fmt.Errorf("bytebot action failed: %v", result["error"])
	}
	return result, nil
}

func bytebotClickMouse(session *sandboxmanager.Session, args map[string]any) (any, error) {
	payload := map[string]any{
		"action":     "click_mouse",
		"button":     bytebotButton(args),
		"clickCount": 1,
	}
	if x, ok := args["x"].(float64); ok {
		if y, ok := args["y"].(float64); ok {
			payload["coordinates"] = map[string]any{
				"x": int(x),
				"y": int(y),
			}
		}
	}
	return bytebotAction(session, payload)
}

func bytebotButton(args map[string]any) string {
	button, _ := args["button"].(string)
	switch strings.ToLower(button) {
	case "2", "middle":
		return "middle"
	case "3", "right":
		return "right"
	default:
		return "left"
	}
}

func takeScreenshot(sshPort int) (any, error) {
	cmd := exec.Command("ssh",
		"-o", "StrictHostKeyChecking=no",
		"-o", "UserKnownHostsFile=/dev/null",
		"-p", strconv.Itoa(sshPort),
		"ubuntu@localhost",
		"scrot -q 80 /tmp/screenshot.png -e 'cat $f' | base64",
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("screenshot failed: %v, output: %s", err, string(out))
	}
	imgData := strings.TrimSpace(string(out))
	return map[string]any{
		"image":    imgData,
		"encoding": "base64",
	}, nil
}

func moveMouse(sshPort int, x, y int) (any, error) {
	cmd := exec.Command("ssh",
		"-o", "StrictHostKeyChecking=no",
		"-o", "UserKnownHostsFile=/dev/null",
		"-p", strconv.Itoa(sshPort),
		"ubuntu@localhost",
		fmt.Sprintf("xdotool mousemove %d %d", x, y),
	)
	_, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("mouse move failed: %v", err)
	}
	return map[string]any{"result": fmt.Sprintf("moved to (%d, %d)", x, y)}, nil
}

func clickMouse(sshPort int, args map[string]any) (any, error) {
	button := "1"
	if b, ok := args["button"].(string); ok {
		button = b
	}
	var cmd *exec.Cmd
	if x, ok := args["x"].(float64); ok {
		if y, ok := args["y"].(float64); ok {
			cmd = exec.Command("ssh",
				"-o", "StrictHostKeyChecking=no",
				"-o", "UserKnownHostsFile=/dev/null",
				"-p", strconv.Itoa(sshPort),
				"ubuntu@localhost",
				fmt.Sprintf("xdotool mousemove %d %d click %s", int(x), int(y), button),
			)
		}
	}
	if cmd == nil {
		cmd = exec.Command("ssh",
			"-o", "StrictHostKeyChecking=no",
			"-o", "UserKnownHostsFile=/dev/null",
			"-p", strconv.Itoa(sshPort),
			"ubuntu@localhost",
			fmt.Sprintf("xdotool click %s", button),
		)
	}
	_, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("mouse click failed: %v", err)
	}
	return map[string]any{"result": "clicked"}, nil
}

func typeText(sshPort int, text string) (any, error) {
	escaped := strings.ReplaceAll(text, "'", "'\\''")
	cmd := exec.Command("ssh",
		"-o", "StrictHostKeyChecking=no",
		"-o", "UserKnownHostsFile=/dev/null",
		"-p", strconv.Itoa(sshPort),
		"ubuntu@localhost",
		fmt.Sprintf("xdotool type -- '%s'", escaped),
	)
	_, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("type failed: %v", err)
	}
	return map[string]any{"result": fmt.Sprintf("typed: %s", text)}, nil
}

func pressKey(sshPort int, key string) (any, error) {
	cmd := exec.Command("ssh",
		"-o", "StrictHostKeyChecking=no",
		"-o", "UserKnownHostsFile=/dev/null",
		"-p", strconv.Itoa(sshPort),
		"ubuntu@localhost",
		fmt.Sprintf("xdotool key %s", key),
	)
	_, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("key press failed: %v", err)
	}
	return map[string]any{"result": fmt.Sprintf("pressed: %s", key)}, nil
}
