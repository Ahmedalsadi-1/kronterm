// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package aiusechat

import (
	"fmt"
	"strings"

	"github.com/wavetermdev/waveterm/pkg/aiusechat/uctypes"
	sandboxmanager "github.com/wavetermdev/waveterm/pkg/sandbox/manager"
)

func getSessionFromInput(input any) (*sandboxmanager.Session, error) {
	inputMap, ok := input.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("invalid input")
	}
	sessionId := "default"
	if sid, ok := inputMap["sessionId"].(string); ok && sid != "" {
		sessionId = sid
	}
	sm := sandboxmanager.GetSandboxManager()
	session, err := sm.GetStatus(sessionId)
	if err != nil {
		return nil, err
	}
	if session.Runtime != sandboxmanager.SandboxRuntimeKrontermDesktop {
		return nil, fmt.Errorf("session %q is not a kronterm-desktop runtime (runtime=%q)", sessionId, session.Runtime)
	}
	return session, nil
}

// GetDesktopScrollToolDefinition scrolls the mouse wheel on the sandbox desktop.
func GetDesktopScrollToolDefinition() uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "desktop_scroll",
		Description: "Scroll the mouse wheel on the sandbox desktop in a specified direction.",
		InputSchema: map[string]any{
			"type":     "object",
			"required": []string{"direction"},
			"properties": map[string]any{
				"direction": map[string]any{
					"type":        "string",
					"enum":        []string{"up", "down", "left", "right"},
					"description": "Direction to scroll",
				},
				"scrollCount": map[string]any{
					"type":        "integer",
					"description": "Number of scroll steps (default: 3)",
				},
				"x": map[string]any{
					"type":        "integer",
					"description": "X coordinate for scroll position (optional)",
				},
				"y": map[string]any{
					"type":        "integer",
					"description": "Y coordinate for scroll position (optional)",
				},
				"sessionId": map[string]any{
					"type":        "string",
					"description": "Session ID (default: 'default')",
				},
			},
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input")
			}
			payload := map[string]any{
				"action":    "scroll",
				"direction": inputMap["direction"].(string),
			}
			if sc, ok := inputMap["scrollCount"].(float64); ok {
				payload["scrollCount"] = int(sc)
			}
			if x, ok := inputMap["x"].(float64); ok {
				if y, ok := inputMap["y"].(float64); ok {
					payload["coordinates"] = map[string]any{
						"x": int(x),
						"y": int(y),
					}
				}
			}
			session, err := getSessionFromInput(input)
			if err != nil {
				return nil, err
			}
			return krontermDesktopAction(session, payload)
		},
	}
}

// GetDesktopDragToolDefinition drags the mouse from start to end coordinates on the sandbox desktop.
func GetDesktopDragToolDefinition() uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "desktop_drag",
		Description: "Drag the mouse from one coordinate to another on the sandbox desktop, optionally holding modifier keys.",
		InputSchema: map[string]any{
			"type":     "object",
			"required": []string{"startX", "startY", "endX", "endY"},
			"properties": map[string]any{
				"startX": map[string]any{
					"type":        "integer",
					"description": "Starting X coordinate",
				},
				"startY": map[string]any{
					"type":        "integer",
					"description": "Starting Y coordinate",
				},
				"endX": map[string]any{
					"type":        "integer",
					"description": "Ending X coordinate",
				},
				"endY": map[string]any{
					"type":        "integer",
					"description": "Ending Y coordinate",
				},
				"button": map[string]any{
					"type":        "string",
					"enum":        []string{"left", "right", "middle"},
					"description": "Mouse button to hold during drag (default: left)",
				},
				"sessionId": map[string]any{
					"type":        "string",
					"description": "Session ID (default: 'default')",
				},
			},
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input")
			}
			button := "left"
			if b, ok := inputMap["button"].(string); ok {
				button = b
			}
			path := []map[string]any{
				{"x": int(inputMap["startX"].(float64)), "y": int(inputMap["startY"].(float64))},
				{"x": int(inputMap["endX"].(float64)), "y": int(inputMap["endY"].(float64))},
			}
			payload := map[string]any{
				"action": "drag_mouse",
				"path":   path,
				"button": button,
			}
			session, err := getSessionFromInput(input)
			if err != nil {
				return nil, err
			}
			return krontermDesktopAction(session, payload)
		},
	}
}

// GetDesktopCursorPositionToolDefinition gets current cursor position on the sandbox desktop.
func GetDesktopCursorPositionToolDefinition() uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "desktop_cursor_position",
		Description: "Get the current mouse cursor position on the sandbox desktop.",
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
			session, err := getSessionFromInput(input)
			if err != nil {
				return nil, err
			}
			return krontermDesktopAction(session, map[string]any{"action": "cursor_position"})
		},
	}
}

// GetDesktopPasteTextToolDefinition pastes text into the sandbox desktop via clipboard.
func GetDesktopPasteTextToolDefinition() uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "desktop_paste_text",
		Description: "Copy text to the clipboard and paste it into the active field on the sandbox desktop. Use this for long text strings or special characters.",
		InputSchema: map[string]any{
			"type":     "object",
			"required": []string{"text"},
			"properties": map[string]any{
				"text": map[string]any{
					"type":        "string",
					"description": "Text to paste",
				},
				"sessionId": map[string]any{
					"type":        "string",
					"description": "Session ID (default: 'default')",
				},
			},
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input")
			}
			text, _ := inputMap["text"].(string)
			session, err := getSessionFromInput(input)
			if err != nil {
				return nil, err
			}
			return krontermDesktopAction(session, map[string]any{
				"action": "paste_text",
				"text":   text,
			})
		},
	}
}

// GetDesktopMousePressToolDefinition presses or releases a mouse button on the sandbox desktop.
func GetDesktopMousePressToolDefinition() uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "desktop_mouse_press",
		Description: "Press or release a mouse button on the sandbox desktop without clicking. Use for advanced mouse interactions like drag-and-drop.",
		InputSchema: map[string]any{
			"type":     "object",
			"required": []string{"action"},
			"properties": map[string]any{
				"action": map[string]any{
					"type":        "string",
					"enum":        []string{"press", "release"},
					"description": "Whether to press or release the button",
				},
				"button": map[string]any{
					"type":        "string",
					"enum":        []string{"left", "right", "middle"},
					"description": "Mouse button (default: left)",
				},
				"x": map[string]any{
					"type":        "integer",
					"description": "X coordinate (optional)",
				},
				"y": map[string]any{
					"type":        "integer",
					"description": "Y coordinate (optional)",
				},
				"sessionId": map[string]any{
					"type":        "string",
					"description": "Session ID (default: 'default')",
				},
			},
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input")
			}
			pressAction := inputMap["action"].(string)
			button := "left"
			if b, ok := inputMap["button"].(string); ok {
				button = b
			}
			payload := map[string]any{
				"action": "press_mouse",
				"press":  pressAction,
				"button": button,
			}
			if x, ok := inputMap["x"].(float64); ok {
				if y, ok := inputMap["y"].(float64); ok {
					payload["coordinates"] = map[string]any{
						"x": int(x),
						"y": int(y),
					}
				}
			}
			session, err := getSessionFromInput(input)
			if err != nil {
				return nil, err
			}
			return krontermDesktopAction(session, payload)
		},
	}
}

// GetDesktopTraceMouseToolDefinition moves the mouse along a path of coordinates with smooth animation.
func GetDesktopTraceMouseToolDefinition() uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "desktop_trace_mouse",
		Description: "Move the mouse cursor along a smooth path through a series of coordinates on the sandbox desktop.",
		InputSchema: map[string]any{
			"type":     "object",
			"required": []string{"path"},
			"properties": map[string]any{
				"path": map[string]any{
					"type":        "array",
					"description": "Array of coordinate pairs to trace through: [[x1,y1],[x2,y2],...]",
					"items": map[string]any{
						"type": "array",
						"items": map[string]any{
							"type": "integer",
						},
						"minItems": 2,
						"maxItems": 2,
					},
				},
				"sessionId": map[string]any{
					"type":        "string",
					"description": "Session ID (default: 'default')",
				},
			},
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input")
			}
			rawPath, ok := inputMap["path"].([]any)
			if !ok {
				return nil, fmt.Errorf("path must be an array of [x,y] pairs")
			}
			pathObj := make([]map[string]any, 0, len(rawPath))
			for _, raw := range rawPath {
				point, ok := raw.([]any)
				if !ok || len(point) < 2 {
					return nil, fmt.Errorf("each path point must be an [x,y] array")
				}
				pathObj = append(pathObj, map[string]any{
					"x": int(point[0].(float64)),
					"y": int(point[1].(float64)),
				})
			}
			payload := map[string]any{
				"action": "trace_mouse",
				"path":   pathObj,
			}
			session, err := getSessionFromInput(input)
			if err != nil {
				return nil, err
			}
			return krontermDesktopAction(session, payload)
		},
	}
}

// GetDesktopApplicationToolDefinition opens or switches to an application on the sandbox desktop.
func GetDesktopApplicationToolDefinition() uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "desktop_application",
		Description: "Open or switch to an application on the sandbox desktop. Applications available: firefox, 1password, thunderbird, vscode, terminal, desktop, directory.",
		InputSchema: map[string]any{
			"type":     "object",
			"required": []string{"application"},
			"properties": map[string]any{
				"application": map[string]any{
					"type":        "string",
					"description": "Application to open or switch to",
					"enum":        []string{"firefox", "1password", "thunderbird", "vscode", "terminal", "desktop", "directory"},
				},
				"sessionId": map[string]any{
					"type":        "string",
					"description": "Session ID (default: 'default')",
				},
			},
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input")
			}
			app, _ := inputMap["application"].(string)
			session, err := getSessionFromInput(input)
			if err != nil {
				return nil, err
			}
			return krontermDesktopAction(session, map[string]any{
				"action":      "application",
				"application": app,
			})
		},
	}
}

// GetDesktopWaitToolDefinition pauses execution for a specified duration on the sandbox desktop.
func GetDesktopWaitToolDefinition() uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "desktop_wait",
		Description: "Wait for a specified duration (in milliseconds) on the sandbox desktop. Use this between actions that need time to complete.",
		InputSchema: map[string]any{
			"type":     "object",
			"required": []string{"duration"},
			"properties": map[string]any{
				"duration": map[string]any{
					"type":        "integer",
					"description": "Duration to wait in milliseconds (e.g., 500 for half a second, 2000 for 2 seconds)",
				},
				"sessionId": map[string]any{
					"type":        "string",
					"description": "Session ID (default: 'default')",
				},
			},
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input")
			}
			duration := 500
			if d, ok := inputMap["duration"].(float64); ok {
				duration = int(d)
			}
			session, err := getSessionFromInput(input)
			if err != nil {
				return nil, err
			}
			return krontermDesktopAction(session, map[string]any{
				"action":   "wait",
				"duration": duration,
			})
		},
	}
}

// GetDesktopReadFileToolDefinition reads a file from the sandbox desktop container.
func GetDesktopReadFileToolDefinition() uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "desktop_read_file",
		Description: "Read the contents of a file from the sandbox desktop container filesystem.",
		InputSchema: map[string]any{
			"type":     "object",
			"required": []string{"path"},
			"properties": map[string]any{
				"path": map[string]any{
					"type":        "string",
					"description": "Absolute path to the file within the sandbox desktop container",
				},
				"sessionId": map[string]any{
					"type":        "string",
					"description": "Session ID (default: 'default')",
				},
			},
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input")
			}
			path, _ := inputMap["path"].(string)
			if strings.TrimSpace(path) == "" {
				return nil, fmt.Errorf("path is required")
			}
			session, err := getSessionFromInput(input)
			if err != nil {
				return nil, err
			}
			return krontermDesktopAction(session, map[string]any{
				"action": "read_file",
				"path":   path,
			})
		},
	}
}

// GetDesktopPressKeysToolDefinition presses or releases individual keys on the sandbox desktop.
// This is for holding/releasing modifier keys (e.g., holding Shift while clicking).
// For typing key combinations (e.g., Ctrl+C), use desktop_keyboard_press.
func GetDesktopPressKeysToolDefinition() uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "desktop_press_keys",
		Description: "Press down or release individual keys on the sandbox desktop. Use this for holding modifier keys (e.g., holding Shift, Control, Alt) while performing other actions. For typing key combinations like Ctrl+C, use desktop_keyboard_press instead.",
		InputSchema: map[string]any{
			"type":     "object",
			"required": []string{"keys", "press"},
			"properties": map[string]any{
				"keys": map[string]any{
					"type":        "array",
					"description": "Array of key names to press or release (e.g., ['shift'], ['control', 'shift'])",
					"items": map[string]any{
						"type": "string",
					},
				},
				"press": map[string]any{
					"type":        "string",
					"enum":        []string{"down", "up"},
					"description": "Whether to press keys down or release them up",
				},
				"sessionId": map[string]any{
					"type":        "string",
					"description": "Session ID (default: 'default')",
				},
			},
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input")
			}
			pressAction, _ := inputMap["press"].(string)
			rawKeys, ok := inputMap["keys"].([]any)
			if !ok {
				return nil, fmt.Errorf("keys must be an array of key names")
			}
			keys := make([]string, 0, len(rawKeys))
			for _, k := range rawKeys {
				keyStr, ok := k.(string)
				if !ok {
					return nil, fmt.Errorf("each key must be a string")
				}
				keys = append(keys, keyStr)
			}
			session, err := getSessionFromInput(input)
			if err != nil {
				return nil, err
			}
			return krontermDesktopAction(session, map[string]any{
				"action": "press_keys",
				"keys":   keys,
				"press":  pressAction,
			})
		},
	}
}

// GetDesktopWriteFileToolDefinition writes a file to the sandbox desktop container.
func GetDesktopWriteFileToolDefinition() uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "desktop_write_file",
		Description: "Write content to a file on the sandbox desktop container filesystem. The data must be base64-encoded.",
		InputSchema: map[string]any{
			"type":     "object",
			"required": []string{"path", "data"},
			"properties": map[string]any{
				"path": map[string]any{
					"type":        "string",
					"description": "Absolute path to write the file to within the sandbox desktop container",
				},
				"data": map[string]any{
					"type":        "string",
					"description": "Base64-encoded file content to write",
				},
				"sessionId": map[string]any{
					"type":        "string",
					"description": "Session ID (default: 'default')",
				},
			},
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input")
			}
			path, _ := inputMap["path"].(string)
			data, _ := inputMap["data"].(string)
			if strings.TrimSpace(path) == "" {
				return nil, fmt.Errorf("path is required")
			}
			if data == "" {
				return nil, fmt.Errorf("data is required (base64-encoded content)")
			}
			session, err := getSessionFromInput(input)
			if err != nil {
				return nil, err
			}
			return krontermDesktopAction(session, map[string]any{
				"action": "write_file",
				"path":   path,
				"data":   data,
			})
		},
	}
}
