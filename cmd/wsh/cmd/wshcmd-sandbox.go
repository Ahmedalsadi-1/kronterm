// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package cmd

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"github.com/wavetermdev/waveterm/pkg/wshrpc"
	"github.com/wavetermdev/waveterm/pkg/wshrpc/wshclient"
)

const sandboxCommandTimeout = 30000

var sandboxSessionID string
var sandboxMode string
var sandboxBrowserURL string
var sandboxClickX int
var sandboxClickY int
var sandboxClickHasCoordinates bool
var sandboxClickButton string
var sandboxClickCount int
var sandboxTypeDelay int
var sandboxScrollDirection string
var sandboxScrollCount int
var sandboxScrollX int
var sandboxScrollY int
var sandboxScrollHasCoordinates bool
var sandboxDragButton string

var sandboxCmd = &cobra.Command{
	Use:               "sandbox [command]",
	Short:             "control an isolated sandbox desktop session",
	PersistentPreRunE: preRunSetupRpcClient,
}

var sandboxStartCmd = &cobra.Command{
	Use:   "start",
	Short: "start an isolated sandbox desktop session",
	RunE:  sandboxStartRun,
}

var sandboxStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "get isolated sandbox desktop session status",
	RunE:  sandboxStatusRun,
}

var sandboxStopCmd = &cobra.Command{
	Use:   "stop",
	Short: "stop an isolated sandbox desktop session",
	RunE:  sandboxStopRun,
}

var sandboxScreenshotCmd = &cobra.Command{
	Use:   "screenshot",
	Short: "capture a screenshot of the isolated sandbox desktop",
	RunE:  sandboxScreenshotRun,
}

var sandboxMouseMoveCmd = &cobra.Command{
	Use:   "mouse-move <x> <y>",
	Short: "move the sandbox desktop mouse pointer",
	Args:  cobra.ExactArgs(2),
	RunE:  sandboxMouseMoveRun,
}

var sandboxClickCmd = &cobra.Command{
	Use:   "click",
	Short: "click on the isolated sandbox desktop",
	RunE:  sandboxClickRun,
}

var sandboxTypeCmd = &cobra.Command{
	Use:   "type <text>",
	Short: "type text into the isolated sandbox desktop",
	Args:  cobra.ExactArgs(1),
	RunE:  sandboxTypeRun,
}

var sandboxPasteCmd = &cobra.Command{
	Use:   "paste <text>",
	Short: "paste text into the isolated sandbox desktop",
	Args:  cobra.ExactArgs(1),
	RunE:  sandboxPasteRun,
}

var sandboxPressCmd = &cobra.Command{
	Use:   "press <key> [key...]",
	Short: "press a key or key combination in the isolated sandbox desktop",
	Args:  cobra.MinimumNArgs(1),
	RunE:  sandboxPressRun,
}

var sandboxScrollCmd = &cobra.Command{
	Use:   "scroll",
	Short: "scroll within the isolated sandbox desktop",
	RunE:  sandboxScrollRun,
}

var sandboxDragCmd = &cobra.Command{
	Use:   "drag <start-x> <start-y> <end-x> <end-y>",
	Short: "drag within the isolated sandbox desktop",
	Args:  cobra.ExactArgs(4),
	RunE:  sandboxDragRun,
}

func init() {
	sandboxCmd.PersistentFlags().StringVar(&sandboxSessionID, "session-id", "default", "sandbox session ID")
	sandboxStartCmd.Flags().StringVar(&sandboxMode, "mode", "desktop", "presentation mode: desktop or background")
	sandboxStartCmd.Flags().StringVar(&sandboxBrowserURL, "browser-url", "", "browser URL associated with background mode")
	sandboxClickCmd.Flags().IntVar(&sandboxClickX, "x", 0, "X coordinate")
	sandboxClickCmd.Flags().IntVar(&sandboxClickY, "y", 0, "Y coordinate")
	sandboxClickCmd.Flags().BoolVar(&sandboxClickHasCoordinates, "at", false, "click at --x and --y instead of the current cursor")
	sandboxClickCmd.Flags().StringVar(&sandboxClickButton, "button", "left", "mouse button: left, middle, or right")
	sandboxClickCmd.Flags().IntVar(&sandboxClickCount, "count", 1, "click count: 1, 2, or 3")
	sandboxTypeCmd.Flags().IntVar(&sandboxTypeDelay, "delay", 0, "delay between typed characters in milliseconds")
	sandboxScrollCmd.Flags().StringVar(&sandboxScrollDirection, "direction", "down", "scroll direction: up, down, left, or right")
	sandboxScrollCmd.Flags().IntVar(&sandboxScrollCount, "count", 1, "number of wheel scroll increments")
	sandboxScrollCmd.Flags().IntVar(&sandboxScrollX, "x", 0, "optional X coordinate")
	sandboxScrollCmd.Flags().IntVar(&sandboxScrollY, "y", 0, "optional Y coordinate")
	sandboxScrollCmd.Flags().BoolVar(&sandboxScrollHasCoordinates, "at", false, "scroll at --x and --y instead of the current pointer")
	sandboxDragCmd.Flags().StringVar(&sandboxDragButton, "button", "left", "mouse button: left, middle, or right")
	sandboxCmd.AddCommand(
		sandboxStartCmd,
		sandboxStatusCmd,
		sandboxStopCmd,
		sandboxScreenshotCmd,
		sandboxMouseMoveCmd,
		sandboxClickCmd,
		sandboxTypeCmd,
		sandboxPasteCmd,
		sandboxPressCmd,
		sandboxScrollCmd,
		sandboxDragCmd,
	)
	rootCmd.AddCommand(sandboxCmd)
}

func sandboxStartRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("sandbox", rtnErr == nil) }()
	if sandboxMode != "desktop" && sandboxMode != "background" {
		return fmt.Errorf("sandbox start: invalid mode %q", sandboxMode)
	}
	result, err := wshclient.SandboxStartCommand(RpcClient, wshrpc.SandboxStartRequest{
		SessionId:  sandboxSessionID,
		Mode:       sandboxMode,
		BrowserUrl: sandboxBrowserURL,
	}, &wshrpc.RpcOpts{Timeout: sandboxCommandTimeout})
	if err != nil {
		return fmt.Errorf("sandbox start: %w", err)
	}
	return writeSandboxJSON(result)
}

func sandboxStatusRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("sandbox", rtnErr == nil) }()
	result, err := sandboxStatus()
	if err != nil {
		return err
	}
	return writeSandboxJSON(result)
}

func sandboxStopRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("sandbox", rtnErr == nil) }()
	result, err := wshclient.SandboxStopCommand(RpcClient, wshrpc.SandboxStopRequest{
		SessionId: sandboxSessionID,
	}, &wshrpc.RpcOpts{Timeout: sandboxCommandTimeout})
	if err != nil {
		return fmt.Errorf("sandbox stop: %w", err)
	}
	return writeSandboxJSON(result)
}

func sandboxScreenshotRun(cmd *cobra.Command, args []string) error {
	return sandboxDesktopAction(map[string]any{"action": "screenshot"}, func(status wshrpc.SandboxStatusResponse) (any, error) {
		return sandboxSSHCommand(status, "scrot -q 80 /tmp/screenshot.png -e 'cat $f' | base64", func(output string) any {
			return map[string]any{"image": strings.TrimSpace(output), "encoding": "base64"}
		})
	})
}

func sandboxMouseMoveRun(cmd *cobra.Command, args []string) error {
	x, err := strconv.Atoi(args[0])
	if err != nil {
		return fmt.Errorf("sandbox mouse-move: invalid X coordinate: %w", err)
	}
	y, err := strconv.Atoi(args[1])
	if err != nil {
		return fmt.Errorf("sandbox mouse-move: invalid Y coordinate: %w", err)
	}
	return sandboxDesktopAction(map[string]any{
		"action":      "move_mouse",
		"coordinates": map[string]int{"x": x, "y": y},
	}, func(status wshrpc.SandboxStatusResponse) (any, error) {
		command := fmt.Sprintf("xdotool mousemove %d %d", x, y)
		return sandboxSSHCommand(status, command, func(string) any {
			return map[string]any{"result": fmt.Sprintf("moved to (%d, %d)", x, y)}
		})
	})
}

func sandboxClickRun(cmd *cobra.Command, args []string) error {
	if sandboxClickCount < 1 || sandboxClickCount > 3 {
		return fmt.Errorf("sandbox click: count must be between 1 and 3")
	}
	buttonName, buttonNumber, err := sandboxButton(sandboxClickButton)
	if err != nil {
		return err
	}
	payload := map[string]any{
		"action":     "click_mouse",
		"button":     buttonName,
		"clickCount": sandboxClickCount,
	}
	if sandboxClickHasCoordinates {
		payload["coordinates"] = map[string]int{"x": sandboxClickX, "y": sandboxClickY}
	}
	return sandboxDesktopAction(payload, func(status wshrpc.SandboxStatusResponse) (any, error) {
		command := ""
		if sandboxClickHasCoordinates {
			command = fmt.Sprintf("xdotool mousemove %d %d && ", sandboxClickX, sandboxClickY)
		}
		command += fmt.Sprintf("xdotool click --repeat %d %s", sandboxClickCount, buttonNumber)
		return sandboxSSHCommand(status, command, func(string) any {
			return map[string]any{"result": "clicked", "clickCount": sandboxClickCount}
		})
	})
}

func sandboxTypeRun(cmd *cobra.Command, args []string) error {
	text := args[0]
	return sandboxDesktopAction(map[string]any{
		"action": "type_text",
		"text":   text,
		"delay":  sandboxTypeDelay,
	}, func(status wshrpc.SandboxStatusResponse) (any, error) {
		command := fmt.Sprintf("xdotool type -- '%s'", strings.ReplaceAll(text, "'", "'\\''"))
		return sandboxSSHCommand(status, command, func(string) any {
			return map[string]any{"result": "typed"}
		})
	})
}

func sandboxPasteRun(cmd *cobra.Command, args []string) error {
	text := args[0]
	return sandboxDesktopAction(map[string]any{
		"action": "paste_text",
		"text":   text,
	}, func(status wshrpc.SandboxStatusResponse) (any, error) {
		command := fmt.Sprintf("xdotool type -- '%s'", strings.ReplaceAll(text, "'", "'\\''"))
		return sandboxSSHCommand(status, command, func(string) any {
			return map[string]any{"result": "pasted"}
		})
	})
}

func sandboxPressRun(cmd *cobra.Command, args []string) error {
	for _, key := range args {
		if !regexp.MustCompile(`^[A-Za-z0-9_+:-]+$`).MatchString(key) {
			return fmt.Errorf("sandbox press: invalid key %q", key)
		}
	}
	return sandboxDesktopAction(map[string]any{
		"action": "type_keys",
		"keys":   args,
	}, func(status wshrpc.SandboxStatusResponse) (any, error) {
		key := strings.Join(args, "+")
		return sandboxSSHCommand(status, "xdotool key "+key, func(string) any {
			return map[string]any{"result": "pressed", "keys": args}
		})
	})
}

func sandboxScrollRun(cmd *cobra.Command, args []string) error {
	button, err := sandboxScrollButton(sandboxScrollDirection)
	if err != nil {
		return err
	}
	if sandboxScrollCount < 1 {
		return fmt.Errorf("sandbox scroll: count must be at least 1")
	}
	payload := map[string]any{
		"action":      "scroll",
		"direction":   sandboxScrollDirection,
		"scrollCount": sandboxScrollCount,
	}
	if sandboxScrollHasCoordinates {
		payload["coordinates"] = map[string]int{"x": sandboxScrollX, "y": sandboxScrollY}
	}
	return sandboxDesktopAction(payload, func(status wshrpc.SandboxStatusResponse) (any, error) {
		command := ""
		if sandboxScrollHasCoordinates {
			command = fmt.Sprintf("xdotool mousemove %d %d && ", sandboxScrollX, sandboxScrollY)
		}
		command += fmt.Sprintf("xdotool click --repeat %d %s", sandboxScrollCount, button)
		return sandboxSSHCommand(status, command, func(string) any {
			return map[string]any{"result": "scrolled", "direction": sandboxScrollDirection, "count": sandboxScrollCount}
		})
	})
}

func sandboxDragRun(cmd *cobra.Command, args []string) error {
	coordinates := make([]int, len(args))
	for index, arg := range args {
		value, err := strconv.Atoi(arg)
		if err != nil {
			return fmt.Errorf("sandbox drag: invalid coordinate %q: %w", arg, err)
		}
		coordinates[index] = value
	}
	buttonName, buttonNumber, err := sandboxButton(sandboxDragButton)
	if err != nil {
		return err
	}
	payload := map[string]any{
		"action": "drag_mouse",
		"button": buttonName,
		"path": []map[string]int{
			{"x": coordinates[0], "y": coordinates[1]},
			{"x": coordinates[2], "y": coordinates[3]},
		},
	}
	return sandboxDesktopAction(payload, func(status wshrpc.SandboxStatusResponse) (any, error) {
		command := fmt.Sprintf(
			"xdotool mousemove %d %d mousedown %s mousemove %d %d mouseup %s",
			coordinates[0], coordinates[1], buttonNumber, coordinates[2], coordinates[3], buttonNumber,
		)
		return sandboxSSHCommand(status, command, func(string) any {
			return map[string]any{"result": "dragged"}
		})
	})
}

func sandboxDesktopAction(payload map[string]any, qemuAction func(wshrpc.SandboxStatusResponse) (any, error)) error {
	status, err := sandboxStatus()
	if err != nil {
		return err
	}
	if status.Status != "running" {
		return fmt.Errorf("sandbox desktop: session %q is not running (status: %s)", sandboxSessionID, status.Status)
	}
	var result any
	if status.Runtime == "kronterm-desktop" {
		result, err = sandboxKrontermDesktopAction(status, payload)
	} else {
		result, err = qemuAction(status)
	}
	if err != nil {
		return err
	}
	return writeSandboxJSON(result)
}

func sandboxStatus() (wshrpc.SandboxStatusResponse, error) {
	status, err := wshclient.SandboxStatusCommand(RpcClient, wshrpc.SandboxStatusRequest{
		SessionId: sandboxSessionID,
	}, &wshrpc.RpcOpts{Timeout: sandboxCommandTimeout})
	if err != nil {
		return status, fmt.Errorf("sandbox status: %w", err)
	}
	if status.Error != "" {
		return status, fmt.Errorf("sandbox status: %s", status.Error)
	}
	return status, nil
}

func sandboxKrontermDesktopAction(status wshrpc.SandboxStatusResponse, payload map[string]any) (any, error) {
	baseURL := strings.TrimSuffix(status.DesktopUrl, "/computer-use")
	if baseURL == "" || baseURL == status.DesktopUrl {
		return nil, fmt.Errorf("sandbox desktop: KrontermDesktop URL is not configured")
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}
	client := http.Client{Timeout: 30 * time.Second}
	resp, err := client.Post(baseURL+"/computer-use", "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("sandbox desktop action: %w", err)
	}
	defer resp.Body.Close()
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("sandbox desktop response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("sandbox desktop action returned HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(responseBody)))
	}
	if len(bytes.TrimSpace(responseBody)) == 0 {
		return map[string]any{"success": true}, nil
	}
	var result map[string]any
	if err := json.Unmarshal(responseBody, &result); err != nil {
		return nil, fmt.Errorf("sandbox desktop response: %w", err)
	}
	if success, ok := result["success"].(bool); ok && !success {
		return nil, fmt.Errorf("sandbox desktop action failed: %v", result["error"])
	}
	return result, nil
}

func sandboxSSHCommand(status wshrpc.SandboxStatusResponse, command string, resultFn func(string) any) (any, error) {
	if status.SshPort == 0 {
		return nil, fmt.Errorf("sandbox desktop: QEMU SSH port is unavailable")
	}
	output, err := exec.Command(
		"ssh",
		"-o", "StrictHostKeyChecking=no",
		"-o", "UserKnownHostsFile=/dev/null",
		"-p", strconv.Itoa(status.SshPort),
		"ubuntu@localhost",
		command,
	).CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("sandbox desktop SSH action: %w, output: %s", err, strings.TrimSpace(string(output)))
	}
	return resultFn(string(output)), nil
}

func sandboxButton(button string) (string, string, error) {
	switch strings.ToLower(button) {
	case "left", "1":
		return "left", "1", nil
	case "middle", "2":
		return "middle", "2", nil
	case "right", "3":
		return "right", "3", nil
	default:
		return "", "", fmt.Errorf("sandbox click: invalid button %q", button)
	}
}

func sandboxScrollButton(direction string) (string, error) {
	switch strings.ToLower(direction) {
	case "up":
		return "4", nil
	case "down":
		return "5", nil
	case "left":
		return "6", nil
	case "right":
		return "7", nil
	default:
		return "", fmt.Errorf("sandbox scroll: invalid direction %q", direction)
	}
}

func writeSandboxJSON(value any) error {
	output, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return fmt.Errorf("sandbox JSON encoding: %w", err)
	}
	WriteStdout("%s\n", string(output))
	return nil
}
