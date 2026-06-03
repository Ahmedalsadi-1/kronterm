// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package desktop

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"runtime"
	"strings"
)

type DesktopTool interface {
	Name() string
	Description() string
	Execute(ctx context.Context, args map[string]interface{}) (string, error)
}

type ScreenshotTool struct{}

func (t *ScreenshotTool) Name() string { return "desktop_screenshot" }
func (t *ScreenshotTool) Description() string {
	return "Capture a screenshot of the entire screen or a region"
}

func (t *ScreenshotTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	if runtime.GOOS != "darwin" {
		return "", fmt.Errorf("screenshot only supported on macOS")
	}

	script := `osascript -e 'tell application "System Events" to keystroke "s" using {command down, shift down, control down}'`
	cmd := exec.CommandContext(ctx, "bash", "-c", script)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("screenshot failed: %v, output: %s", err, string(out))
	}
	return "Screenshot captured", nil
}

type ClickTool struct{}

func (t *ClickTool) Name() string        { return "desktop_click" }
func (t *ClickTool) Description() string { return "Click at specified screen coordinates" }

func (t *ClickTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	if runtime.GOOS != "darwin" {
		return "", fmt.Errorf("click only supported on macOS")
	}

	xVal, ok := args["x"].(float64)
	if !ok {
		return "", fmt.Errorf("missing or invalid required parameter: x")
	}
	yVal, ok := args["y"].(float64)
	if !ok {
		return "", fmt.Errorf("missing or invalid required parameter: y")
	}
	x := int(xVal)
	y := int(yVal)
	if x < 0 || x > 10000 || y < 0 || y > 10000 {
		return "", fmt.Errorf("coordinates out of range: (%d, %d)", x, y)
	}

	script := fmt.Sprintf(`osascript -e 'tell application "System Events" to click at {%d, %d}'`, x, y)
	cmd := exec.CommandContext(ctx, "bash", "-c", script)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("click failed: %v, output: %s", err, string(out))
	}
	return fmt.Sprintf("Clicked at (%d, %d)", x, y), nil
}

type TypeTool struct{}

func (t *TypeTool) Name() string        { return "desktop_type" }
func (t *TypeTool) Description() string { return "Type text at the current cursor position" }

func (t *TypeTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	if runtime.GOOS != "darwin" {
		return "", fmt.Errorf("type only supported on macOS")
	}

	text, ok := args["text"].(string)
	if !ok {
		return "", fmt.Errorf("missing required parameter: text")
	}

	escaped := strings.ReplaceAll(text, "\\", "\\\\")
	escaped = strings.ReplaceAll(escaped, `"`, `\"`)
	script := fmt.Sprintf(`osascript -e 'tell application "System Events" to keystroke "%s"'`, escaped)
	cmd := exec.CommandContext(ctx, "bash", "-c", script)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("type failed: %v, output: %s", err, string(out))
	}
	return fmt.Sprintf("Typed: %s", text), nil
}

type HotkeyTool struct{}

func (t *HotkeyTool) Name() string        { return "desktop_hotkey" }
func (t *HotkeyTool) Description() string { return "Press a keyboard shortcut combination" }

// modifierMap maps human-readable modifier names to osascript key terms
var modifierMap = map[string]string{
	"command": "command down",
	"cmd":     "command down",
	"option":  "option down",
	"opt":     "option down",
	"alt":     "option down",
	"shift":   "shift down",
	"control": "control down",
	"ctrl":    "control down",
}

var knownModifiers = map[string]bool{
	"command": true, "cmd": true,
	"option": true, "opt": true, "alt": true,
	"shift": true,
	"control": true, "ctrl": true,
}

func (t *HotkeyTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	if runtime.GOOS != "darwin" {
		return "", fmt.Errorf("hotkey only supported on macOS")
	}

	rawKeys, ok := args["keys"].([]interface{})
	if !ok || len(rawKeys) == 0 {
		return "", fmt.Errorf("missing required parameter: keys (array of key strings)")
	}

	var modifiers []string
	var mainKey string
	for i, k := range rawKeys {
		keyStr, ok := k.(string)
		if !ok {
			return "", fmt.Errorf("key at index %d is not a string", i)
		}
		lower := strings.ToLower(keyStr)
		if knownModifiers[lower] {
			modTerm, exists := modifierMap[lower]
			if exists {
				modifiers = append(modifiers, modTerm)
			}
		} else {
			mainKey = keyStr
		}
	}

	if mainKey == "" {
		return "", fmt.Errorf("no main key found in keys array (all entries are modifiers)")
	}

	var script string
	if len(modifiers) > 0 {
		script = fmt.Sprintf(
			`osascript -e 'tell application "System Events" to keystroke "%s" using {%s}'`,
			escapeKey(mainKey), strings.Join(modifiers, ", "),
		)
	} else {
		script = fmt.Sprintf(
			`osascript -e 'tell application "System Events" to keystroke "%s"'`,
			escapeKey(mainKey),
		)
	}

	cmd := exec.CommandContext(ctx, "bash", "-c", script)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("hotkey failed: %v, output: %s", err, string(out))
	}
	return fmt.Sprintf("Pressed hotkey: %s", mainKey), nil
}

func escapeKey(key string) string {
	key = strings.ReplaceAll(key, "\\", "\\\\")
	key = strings.ReplaceAll(key, `"`, `\"`)
	return key
}

type WindowListTool struct{}

func (t *WindowListTool) Name() string        { return "desktop_window_list" }
func (t *WindowListTool) Description() string { return "List all currently open windows" }

func (t *WindowListTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	if runtime.GOOS != "darwin" {
		return "", fmt.Errorf("window_list only supported on macOS")
	}

	script := `osascript -e 'tell application "System Events" to get name of every process whose background only is false'`
	cmd := exec.CommandContext(ctx, "bash", "-c", script)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("window_list failed: %v", err)
	}
	return strings.TrimSpace(string(out)), nil
}

type ClipboardGetTool struct{}

func (t *ClipboardGetTool) Name() string        { return "desktop_clipboard_get" }
func (t *ClipboardGetTool) Description() string { return "Get the current clipboard contents" }

func (t *ClipboardGetTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	if runtime.GOOS != "darwin" {
		return "", fmt.Errorf("clipboard_get only supported on macOS")
	}

	script := `osascript -e 'get the clipboard'`
	cmd := exec.CommandContext(ctx, "bash", "-c", script)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("clipboard_get failed: %v", err)
	}
	result := strings.TrimSpace(string(out))
	result = strings.ReplaceAll(result, "\n", " ")
	return result, nil
}

type ClipboardSetTool struct{}

func (t *ClipboardSetTool) Name() string        { return "desktop_clipboard_set" }
func (t *ClipboardSetTool) Description() string { return "Set the clipboard contents" }

func (t *ClipboardSetTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	if runtime.GOOS != "darwin" {
		return "", fmt.Errorf("clipboard_set only supported on macOS")
	}

	text, ok := args["value"].(string)
	if !ok {
		return "", fmt.Errorf("missing required parameter: value")
	}

	escaped := strings.ReplaceAll(text, "\\", "\\\\")
	escaped = strings.ReplaceAll(escaped, `"`, `\"`)
	script := fmt.Sprintf(`osascript -e 'set the clipboard to "%s"'`, escaped)
	cmd := exec.CommandContext(ctx, "bash", "-c", script)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("clipboard_set failed: %v, output: %s", err, string(out))
	}
	return fmt.Sprintf("Set clipboard: %s", text), nil
}

type OpenAppTool struct{}

func (t *OpenAppTool) Name() string        { return "desktop_open_app" }
func (t *OpenAppTool) Description() string { return "Open an application by name" }

func (t *OpenAppTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	app, ok := args["app"].(string)
	if !ok {
		return "", fmt.Errorf("missing required parameter: app")
	}

	cmd := exec.CommandContext(ctx, "open", "-a", app)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("open_app failed: %v, output: %s", err, string(out))
	}
	return fmt.Sprintf("Opened: %s", app), nil
}

func GetAllTools() []DesktopTool {
	return []DesktopTool{
		&ScreenshotTool{},
		&ClickTool{},
		&TypeTool{},
		&HotkeyTool{},
		&WindowListTool{},
		&ClipboardGetTool{},
		&ClipboardSetTool{},
		&OpenAppTool{},
	}
}

func ExecuteTool(name string, ctx context.Context, args map[string]interface{}) (string, error) {
	for _, tool := range GetAllTools() {
		if tool.Name() == name {
			return tool.Execute(ctx, args)
		}
	}
	return "", fmt.Errorf("tool not found: %s", name)
}

func GetToolDefinitions() []map[string]interface{} {
	var defs []map[string]interface{}
	for _, tool := range GetAllTools() {
		defs = append(defs, map[string]interface{}{
			"name":        tool.Name(),
			"description": tool.Description(),
		})
	}
	return defs
}

var _ = json.Marshal
