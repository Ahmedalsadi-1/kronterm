package sandbox

import (
	"context"
	"encoding/base64"
	"fmt"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

const DefaultSSHUser = "ubuntu"
const DefaultSSHPass = "ubuntu"

type DesktopTool interface {
	Name() string
	Description() string
	Execute(ctx context.Context, sshHost string, sshPort int, args map[string]interface{}) (string, error)
}

type ScreenshotTool struct{}

func (t *ScreenshotTool) Name() string        { return "desktop_screenshot" }
func (t *ScreenshotTool) Description() string { return "Capture a screenshot of the VM desktop" }

func (t *ScreenshotTool) Execute(ctx context.Context, sshHost string, sshPort int, args map[string]interface{}) (string, error) {
	cmd := exec.CommandContext(ctx, "ssh",
		"-o", "StrictHostKeyChecking=no",
		"-o", "UserKnownHostsFile=/dev/null",
		"-p", strconv.Itoa(sshPort),
		fmt.Sprintf("%s@%s", DefaultSSHUser, sshHost),
		"scrot -q 80 /tmp/screenshot.png && base64 /tmp/screenshot.png",
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("screenshot failed: %v, output: %s", err, string(out))
	}

	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(out)))
	if err != nil {
		return "", fmt.Errorf("failed to decode screenshot: %v", err)
	}

	return base64.StdEncoding.EncodeToString(decoded), nil
}

type MouseMoveTool struct{}

func (t *MouseMoveTool) Name() string        { return "desktop_mouse_move" }
func (t *MouseMoveTool) Description() string { return "Move the mouse cursor to specified coordinates" }

func (t *MouseMoveTool) Execute(ctx context.Context, sshHost string, sshPort int, args map[string]interface{}) (string, error) {
	x := int(args["x"].(float64))
	y := int(args["y"].(float64))

	cmd := exec.CommandContext(ctx, "ssh",
		"-o", "StrictHostKeyChecking=no",
		"-o", "UserKnownHostsFile=/dev/null",
		"-p", strconv.Itoa(sshPort),
		fmt.Sprintf("%s@%s", DefaultSSHUser, sshHost),
		fmt.Sprintf("xdotool mousemove %d %d", x, y),
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("mouse move failed: %v, output: %s", err, string(out))
	}
	return fmt.Sprintf("Moved mouse to (%d, %d)", x, y), nil
}

type MouseClickTool struct{}

func (t *MouseClickTool) Name() string { return "desktop_mouse_click" }
func (t *MouseClickTool) Description() string {
	return "Perform a mouse click at current position or coordinates"
}

func (t *MouseClickTool) Execute(ctx context.Context, sshHost string, sshPort int, args map[string]interface{}) (string, error) {
	button := "1"
	if b, ok := args["button"].(string); ok {
		button = b
	}

	x, hasX := args["x"]
	y, hasY := args["y"]

	var cmd *exec.Cmd
	if hasX && hasY {
		cmd = exec.CommandContext(ctx, "ssh",
			"-o", "StrictHostKeyChecking=no",
			"-o", "UserKnownHostsFile=/dev/null",
			"-p", strconv.Itoa(sshPort),
			fmt.Sprintf("%s@%s", DefaultSSHUser, sshHost),
			fmt.Sprintf("xdotool mousemove %d %d click %s", int(x.(float64)), int(y.(float64)), button),
		)
	} else {
		cmd = exec.CommandContext(ctx, "ssh",
			"-o", "StrictHostKeyChecking=no",
			"-o", "UserKnownHostsFile=/dev/null",
			"-p", strconv.Itoa(sshPort),
			fmt.Sprintf("%s@%s", DefaultSSHUser, sshHost),
			fmt.Sprintf("xdotool click %s", button),
		)
	}

	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("mouse click failed: %v, output: %s", err, string(out))
	}
	return fmt.Sprintf("Clicked button %s", button), nil
}

type KeyboardTypeTool struct{}

func (t *KeyboardTypeTool) Name() string        { return "desktop_keyboard_type" }
func (t *KeyboardTypeTool) Description() string { return "Type text into the VM" }

func (t *KeyboardTypeTool) Execute(ctx context.Context, sshHost string, sshPort int, args map[string]interface{}) (string, error) {
	text, ok := args["text"].(string)
	if !ok || text == "" {
		return "", fmt.Errorf("missing required parameter: text")
	}

	cmd := exec.CommandContext(ctx, "ssh",
		"-o", "StrictHostKeyChecking=no",
		"-o", "UserKnownHostsFile=/dev/null",
		"-p", strconv.Itoa(sshPort),
		fmt.Sprintf("%s@%s", DefaultSSHUser, sshHost),
		fmt.Sprintf("xdotool type -- '%s'", strings.ReplaceAll(text, "'", "'\\''")),
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("keyboard type failed: %v, output: %s", err, string(out))
	}
	return fmt.Sprintf("Typed: %s", text), nil
}

type KeyboardPressTool struct{}

func (t *KeyboardPressTool) Name() string { return "desktop_keyboard_press" }
func (t *KeyboardPressTool) Description() string {
	return "Press a single key (Return, Escape, Tab, etc.)"
}

func (t *KeyboardPressTool) Execute(ctx context.Context, sshHost string, sshPort int, args map[string]interface{}) (string, error) {
	key, ok := args["key"].(string)
	if !ok || key == "" {
		return "", fmt.Errorf("missing required parameter: key")
	}

	cmd := exec.CommandContext(ctx, "ssh",
		"-o", "StrictHostKeyChecking=no",
		"-o", "UserKnownHostsFile=/dev/null",
		"-p", strconv.Itoa(sshPort),
		fmt.Sprintf("%s@%s", DefaultSSHUser, sshHost),
		fmt.Sprintf("xdotool key %s", key),
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("keyboard press failed: %v, output: %s", err, string(out))
	}
	return fmt.Sprintf("Pressed key: %s", key), nil
}

type KeyboardComboTool struct{}

func (t *KeyboardComboTool) Name() string { return "desktop_keyboard_combo" }
func (t *KeyboardComboTool) Description() string {
	return "Press a key combination (Ctrl+C, Alt+Tab, etc.)"
}

func (t *KeyboardComboTool) Execute(ctx context.Context, sshHost string, sshPort int, args map[string]interface{}) (string, error) {
	keys, ok := args["keys"].([]interface{})
	if !ok || len(keys) == 0 {
		return "", fmt.Errorf("missing required parameter: keys")
	}

	var keyParts []string
	for _, k := range keys {
		keyParts = append(keyParts, k.(string))
	}

	cmd := exec.CommandContext(ctx, "ssh",
		"-o", "StrictHostKeyChecking=no",
		"-o", "UserKnownHostsFile=/dev/null",
		"-p", strconv.Itoa(sshPort),
		fmt.Sprintf("%s@%s", DefaultSSHUser, sshHost),
		fmt.Sprintf("xdotool key %s", strings.Join(keyParts, "+")),
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("keyboard combo failed: %v, output: %s", err, string(out))
	}
	return fmt.Sprintf("Pressed combo: %s", strings.Join(keyParts, "+")), nil
}

type GetWindowsTool struct{}

func (t *GetWindowsTool) Name() string        { return "desktop_get_windows" }
func (t *GetWindowsTool) Description() string { return "List all open windows in the VM" }

func (t *GetWindowsTool) Execute(ctx context.Context, sshHost string, sshPort int, args map[string]interface{}) (string, error) {
	cmd := exec.CommandContext(ctx, "ssh",
		"-o", "StrictHostKeyChecking=no",
		"-o", "UserKnownHostsFile=/dev/null",
		"-p", strconv.Itoa(sshPort),
		fmt.Sprintf("%s@%s", DefaultSSHUser, sshHost),
		"xdotool search --name .",
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("get windows failed: %v", err)
	}
	return strings.TrimSpace(string(out)), nil
}

type LaunchAppTool struct{}

func (t *LaunchAppTool) Name() string        { return "desktop_launch_app" }
func (t *LaunchAppTool) Description() string { return "Launch an application by name" }

func (t *LaunchAppTool) Execute(ctx context.Context, sshHost string, sshPort int, args map[string]interface{}) (string, error) {
	app, ok := args["app"].(string)
	if !ok || app == "" {
		return "", fmt.Errorf("missing required parameter: app")
	}

	cmd := exec.CommandContext(ctx, "ssh",
		"-o", "StrictHostKeyChecking=no",
		"-o", "UserKnownHostsFile=/dev/null",
		"-p", strconv.Itoa(sshPort),
		fmt.Sprintf("%s@%s", DefaultSSHUser, sshHost),
		fmt.Sprintf("%s &", app),
	)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("launch app failed: %v, output: %s", err, string(out))
	}
	return fmt.Sprintf("Launched: %s", app), nil
}

func GetAllDesktopTools() []DesktopTool {
	return []DesktopTool{
		&ScreenshotTool{},
		&MouseMoveTool{},
		&MouseClickTool{},
		&KeyboardTypeTool{},
		&KeyboardPressTool{},
		&KeyboardComboTool{},
		&GetWindowsTool{},
		&LaunchAppTool{},
	}
}

func ExecuteDesktopTool(name string, ctx context.Context, sshHost string, sshPort int, args map[string]interface{}) (string, error) {
	for _, tool := range GetAllDesktopTools() {
		if tool.Name() == name {
			return tool.Execute(ctx, sshHost, sshPort, args)
		}
	}
	return "", fmt.Errorf("tool not found: %s", name)
}

var _ = time.Sleep
