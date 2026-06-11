// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package cmd

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
	"github.com/wavetermdev/waveterm/pkg/wshrpc"
	"github.com/wavetermdev/waveterm/pkg/wshrpc/wshclient"
	"github.com/wavetermdev/waveterm/pkg/wshutil"
)

var widgetJsonOutput bool
var WidgetScreenshotPath string

// Common opts helper
func getTabRouteOpts() *wshrpc.RpcOpts {
	return &wshrpc.RpcOpts{
		Route:   wshutil.MakeTabRouteId(getTabIdFromEnv()),
		Timeout: 15000,
	}
}

// ── Parent Command ────────────────────────────────────────────────────

var widgetCmd = &cobra.Command{
	Use:               "widget [command]",
	Short:             "widget (block) inspection and control commands",
	Long:              `Inspect and control interactive elements within any Wave Terminal block (web, terminal, AI, etc.)`,
	PersistentPreRunE: preRunSetupRpcClient,
}

func init() {
	widgetCmd.PersistentFlags().BoolVarP(&widgetJsonOutput, "json", "", false, "output as json")
	rootCmd.AddCommand(widgetCmd)

	// Register all subcommands
	initWidgetSnapshot()
	initWidgetFind()
	initWidgetInspect()
	initWidgetElementAt()
	initWidgetScreenshot()
	initWidgetScreenshotAnnotated()
	initWidgetClick()
	initWidgetHover()
	initWidgetType()
	initWidgetPress()
	initWidgetScroll()
	initWidgetScrollTo()
	initWidgetDrag()
	initWidgetLongPress()
	initWidgetGetValue()
	initWidgetSetValue()
	initWidgetClear()
	initWidgetSelect()
	initWidgetToggle()
	initWidgetWait()
	initWidgetGetState()
	initWidgetClipboardGet()
	initWidgetClipboardSet()
}

// =========================================================================
// Helper — resolve block ID from args or env
// =========================================================================

func resolveWidgetBlockId() (string, error) {
	fullORef, err := resolveBlockArg()
	if err != nil {
		return "", fmt.Errorf("resolving blockid: %w", err)
	}
	return fullORef.OID, nil
}

func requireWidgetAction(action string, result *wshrpc.WidgetMouseActionRtnData, err error) error {
	if err != nil {
		return fmt.Errorf("%s: %w", action, err)
	}
	if result == nil || !result.Success {
		message := "action was not applied"
		if result != nil && result.Message != "" {
			message = result.Message
		}
		return fmt.Errorf("%s: %s", action, message)
	}
	return nil
}

// =========================================================================
// snapshot — Get all interactive elements
// =========================================================================

var widgetSnapshotCmd = &cobra.Command{
	Use:   "snapshot",
	Short: "Get all interactive elements in a block",
	RunE:  widgetSnapshotRun,
}

func initWidgetSnapshot() {
	widgetCmd.AddCommand(widgetSnapshotCmd)
}

func widgetSnapshotRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("widget", rtnErr == nil) }()
	blockId, err := resolveWidgetBlockId()
	if err != nil {
		return err
	}
	result, err := wshclient.WidgetSnapshotCommand(RpcClient, wshrpc.CommandWidgetSnapshotData{BlockId: blockId}, getTabRouteOpts())
	if err != nil {
		return fmt.Errorf("widget snapshot: %w", err)
	}
	if widgetJsonOutput {
		barr, _ := json.MarshalIndent(result, "", "  ")
		WriteStdout("%s\n", string(barr))
	} else {
		WriteStdout("Widget: %s\n", result.BlockId)
		WriteStdout("Elements: %d\n\n", result.Count)
		for i, el := range result.Elements {
			visible := " "
			if el.Visible {
				visible = "v"
			}
			focusable := " "
			if el.Focusable {
				focusable = "f"
			}
			WriteStdout("  @e%d  [%s%s]  %-12s  %s  (%d,%d %dx%d)\n",
				i+1, visible, focusable, el.Role, el.Name, el.X, el.Y, el.Width, el.Height)
			if el.Value != "" {
				WriteStdout("       value: %s\n", el.Value)
			}
		}
	}
	return nil
}

// =========================================================================
// find — Find elements by criteria
// =========================================================================

var widgetFindRole string
var widgetFindName string
var widgetFindValue string
var widgetFindText string
var widgetFindMaxCount int

var widgetFindCmd = &cobra.Command{
	Use:   "find",
	Short: "Find elements by role, name, value, or text",
	RunE:  widgetFindRun,
}

func initWidgetFind() {
	widgetFindCmd.Flags().StringVar(&widgetFindRole, "role", "", "element role to match")
	widgetFindCmd.Flags().StringVar(&widgetFindName, "name", "", "element name (partial match)")
	widgetFindCmd.Flags().StringVar(&widgetFindValue, "value", "", "element value (partial match)")
	widgetFindCmd.Flags().StringVar(&widgetFindText, "text", "", "element text (partial match)")
	widgetFindCmd.Flags().IntVar(&widgetFindMaxCount, "max-count", 10, "max results")
	widgetCmd.AddCommand(widgetFindCmd)
}

func widgetFindRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("widget", rtnErr == nil) }()
	blockId, err := resolveWidgetBlockId()
	if err != nil {
		return err
	}
	result, err := wshclient.WidgetFindCommand(RpcClient, wshrpc.CommandWidgetFindData{
		BlockId:  blockId,
		Role:     widgetFindRole,
		Name:     widgetFindName,
		Value:    widgetFindValue,
		Text:     widgetFindText,
		MaxCount: widgetFindMaxCount,
	}, getTabRouteOpts())
	if err != nil {
		return fmt.Errorf("widget find: %w", err)
	}
	if widgetJsonOutput {
		barr, _ := json.MarshalIndent(result, "", "  ")
		WriteStdout("%s\n", string(barr))
	} else {
		WriteStdout("Found %d elements:\n", result.Count)
		for _, el := range result.Elements {
			WriteStdout("  %s  %-12s  %s\n", el.Ref, el.Role, el.Name)
		}
	}
	return nil
}

// =========================================================================
// inspect — Get element metadata
// =========================================================================

var widgetInspectCmd = &cobra.Command{
	Use:   "inspect <element-ref>",
	Short: "Get full metadata for an element (e.g. @e3)",
	Args:  cobra.ExactArgs(1),
	RunE:  widgetInspectRun,
}

func initWidgetInspect() {
	widgetCmd.AddCommand(widgetInspectCmd)
}

func widgetInspectRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("widget", rtnErr == nil) }()
	blockId, err := resolveWidgetBlockId()
	if err != nil {
		return err
	}
	result, err := wshclient.WidgetInspectCommand(RpcClient, wshrpc.CommandWidgetInspectData{
		BlockId:    blockId,
		ElementRef: args[0],
	}, getTabRouteOpts())
	if err != nil {
		return fmt.Errorf("widget inspect: %w", err)
	}
	if widgetJsonOutput {
		barr, _ := json.MarshalIndent(result, "", "  ")
		WriteStdout("%s\n", string(barr))
	} else {
		WriteStdout("Element: %s\n", result.ElementRef)
		WriteStdout("  Role:        %s\n", result.Role)
		WriteStdout("  Name:        %s\n", result.Name)
		WriteStdout("  Value:       %s\n", result.Value)
		WriteStdout("  Position:    (%d, %d) %dx%d\n", result.X, result.Y, result.Width, result.Height)
		WriteStdout("  Focusable:   %v\n", result.Focusable)
		WriteStdout("  Visible:     %v\n", result.Visible)
		WriteStdout("  Enabled:     %v\n", result.Enabled)
		if result.Description != "" {
			WriteStdout("  Description: %s\n", result.Description)
		}
		if len(result.Actions) > 0 {
			WriteStdout("  Actions:     %s\n", strings.Join(result.Actions, ", "))
		}
	}
	return nil
}

// =========================================================================
// element-at — What element is at coordinate
// =========================================================================

var widgetElementAtX int
var widgetElementAtY int

var widgetElementAtCmd = &cobra.Command{
	Use:   "element-at",
	Short: "Identify which element is at a coordinate",
	RunE:  widgetElementAtRun,
}

func initWidgetElementAt() {
	widgetElementAtCmd.Flags().IntVar(&widgetElementAtX, "x", 0, "X coordinate")
	widgetElementAtCmd.Flags().IntVar(&widgetElementAtY, "y", 0, "Y coordinate")
	widgetElementAtCmd.MarkFlagRequired("x")
	widgetElementAtCmd.MarkFlagRequired("y")
	widgetCmd.AddCommand(widgetElementAtCmd)
}

func widgetElementAtRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("widget", rtnErr == nil) }()
	blockId, err := resolveWidgetBlockId()
	if err != nil {
		return err
	}
	result, err := wshclient.WidgetElementAtCommand(RpcClient, wshrpc.CommandWidgetElementAtData{
		BlockId: blockId,
		X:       widgetElementAtX,
		Y:       widgetElementAtY,
	}, getTabRouteOpts())
	if err != nil {
		return fmt.Errorf("widget element-at: %w", err)
	}
	if widgetJsonOutput {
		barr, _ := json.MarshalIndent(result, "", "  ")
		WriteStdout("%s\n", string(barr))
	} else if result.Found {
		WriteStdout("Element at (%d,%d): %s (%s) ref=%s\n", result.X, result.Y, result.Name, result.Role, result.ElementRef)
	} else {
		WriteStdout("No element found at (%d,%d)\n", result.X, result.Y)
	}
	return nil
}

// =========================================================================
// screenshot — Capture block screenshot
// =========================================================================

var widgetScreenshotCmd = &cobra.Command{
	Use:   "screenshot",
	Short: "Take a screenshot of the block",
	RunE:  widgetScreenshotRun,
}

func initWidgetScreenshot() {
	widgetScreenshotCmd.Flags().StringVarP(&WidgetScreenshotPath, "output", "o", "", "write to file (default: stdout as base64)")
	widgetCmd.AddCommand(widgetScreenshotCmd)
}

func getScreenshotOpts() *wshrpc.RpcOpts {
	return &wshrpc.RpcOpts{
		Route:   wshutil.MakeTabRouteId(getTabIdFromEnv()),
		Timeout: 30000,
	}
}

func widgetScreenshotRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("widget", rtnErr == nil) }()
	blockId, err := resolveWidgetBlockId()
	if err != nil {
		return err
	}
	result, err := wshclient.CaptureBlockScreenshotCommand(RpcClient, wshrpc.CommandCaptureBlockScreenshotData{BlockId: blockId}, getScreenshotOpts())
	if err != nil {
		return fmt.Errorf("widget screenshot: %w", err)
	}
	if WidgetScreenshotPath != "" {
		if err := writeWidgetScreenshot(WidgetScreenshotPath, result); err != nil {
			return err
		}
		WriteStdout("Screenshot written to %s\n", WidgetScreenshotPath)
	} else {
		WriteStdout("%s\n", result)
	}
	return nil
}

// =========================================================================
// screenshot-annotated — Annotated screenshot with element labels
// =========================================================================

var widgetScreenshotAnnotNoElements bool

var widgetScreenshotAnnotatedCmd = &cobra.Command{
	Use:   "screenshot-annotated",
	Short: "Take a screenshot through the annotated endpoint",
	RunE:  widgetScreenshotAnnotatedRun,
}

func initWidgetScreenshotAnnotated() {
	widgetScreenshotAnnotatedCmd.Flags().BoolVar(&widgetScreenshotAnnotNoElements, "no-elements", false, "do not request element markers")
	widgetScreenshotAnnotatedCmd.Flags().StringVarP(&WidgetScreenshotPath, "output", "o", "", "write to file (default: stdout)")
	widgetCmd.AddCommand(widgetScreenshotAnnotatedCmd)
}

func widgetScreenshotAnnotatedRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("widget", rtnErr == nil) }()
	blockId, err := resolveWidgetBlockId()
	if err != nil {
		return err
	}
	result, err := wshclient.WidgetScreenshotAnnotatedCommand(RpcClient, wshrpc.CommandWidgetScreenshotAnnotatedData{
		BlockId:      blockId,
		ShowElements: !widgetScreenshotAnnotNoElements,
	}, getScreenshotOpts())
	if err != nil {
		return fmt.Errorf("widget screenshot-annotated: %w", err)
	}
	if WidgetScreenshotPath != "" {
		if err := writeWidgetScreenshot(WidgetScreenshotPath, result.ImageUrl); err != nil {
			return err
		}
		WriteStdout("Annotated screenshot written to %s\n", WidgetScreenshotPath)
	} else {
		if widgetJsonOutput {
			barr, _ := json.MarshalIndent(result, "", "  ")
			WriteStdout("%s\n", string(barr))
		} else {
			WriteStdout("Screenshot URL: %s\n", result.ImageUrl)
		}
	}
	return nil
}

func writeWidgetScreenshot(outputPath string, imageURL string) error {
	data := strings.TrimPrefix(imageURL, "data:image/png;base64,")
	pngData, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		return fmt.Errorf("decoding screenshot: %w", err)
	}
	if err := os.WriteFile(outputPath, pngData, 0644); err != nil {
		return fmt.Errorf("writing screenshot: %w", err)
	}
	return nil
}

// =========================================================================
// click — Click element or coordinates
// =========================================================================

var widgetClickRef string
var widgetClickX int
var widgetClickY int
var widgetClickButton string
var widgetClickType string

var widgetClickCmd = &cobra.Command{
	Use:   "click",
	Short: "Click an element (by ref) or at coordinates",
	RunE:  widgetClickRun,
}

func initWidgetClick() {
	widgetClickCmd.Flags().StringVar(&widgetClickRef, "element-ref", "", "element ref (e.g. @e3)")
	widgetClickCmd.Flags().IntVar(&widgetClickX, "x", 0, "X coordinate")
	widgetClickCmd.Flags().IntVar(&widgetClickY, "y", 0, "Y coordinate")
	widgetClickCmd.Flags().StringVar(&widgetClickButton, "button", "left", "mouse button: left, right, middle")
	widgetClickCmd.Flags().StringVar(&widgetClickType, "click-type", "single", "click type: single, double, triple")
	widgetCmd.AddCommand(widgetClickCmd)
}

func widgetClickRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("widget", rtnErr == nil) }()
	blockId, err := resolveWidgetBlockId()
	if err != nil {
		return err
	}
	result, err := wshclient.WidgetClickCommand(RpcClient, wshrpc.CommandWidgetClickData{
		BlockId:    blockId,
		ElementRef: widgetClickRef,
		X:          widgetClickX,
		Y:          widgetClickY,
		Button:     widgetClickButton,
		ClickType:  widgetClickType,
	}, getTabRouteOpts())
	if err := requireWidgetAction("widget click", result, err); err != nil {
		return err
	}
	desc := widgetClickRef
	if desc == "" {
		desc = fmt.Sprintf("(%d,%d)", widgetClickX, widgetClickY)
	}
	WriteStdout("Clicked %s [%s %s]\n", desc, widgetClickButton, widgetClickType)
	return nil
}

// =========================================================================
// hover — Hover over element or coordinates
// =========================================================================

var widgetHoverRef string
var widgetHoverX int
var widgetHoverY int

var widgetHoverCmd = &cobra.Command{
	Use:   "hover",
	Short: "Hover over an element or coordinate",
	RunE:  widgetHoverRun,
}

func initWidgetHover() {
	widgetHoverCmd.Flags().StringVar(&widgetHoverRef, "element-ref", "", "element ref")
	widgetHoverCmd.Flags().IntVar(&widgetHoverX, "x", 0, "X coordinate")
	widgetHoverCmd.Flags().IntVar(&widgetHoverY, "y", 0, "Y coordinate")
	widgetCmd.AddCommand(widgetHoverCmd)
}

func widgetHoverRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("widget", rtnErr == nil) }()
	blockId, err := resolveWidgetBlockId()
	if err != nil {
		return err
	}
	result, err := wshclient.WidgetHoverCommand(RpcClient, wshrpc.CommandWidgetHoverData{
		BlockId:    blockId,
		ElementRef: widgetHoverRef,
		X:          widgetHoverX,
		Y:          widgetHoverY,
	}, getTabRouteOpts())
	if err := requireWidgetAction("widget hover", result, err); err != nil {
		return err
	}
	WriteStdout("Hovered\n")
	return nil
}

// =========================================================================
// type — Type text into block
// =========================================================================

var widgetTypeDelay int

var widgetTypeCmd = &cobra.Command{
	Use:   "type <text>",
	Short: "Type text into a focused block",
	Args:  cobra.ExactArgs(1),
	RunE:  widgetTypeRun,
}

func initWidgetType() {
	widgetTypeCmd.Flags().IntVar(&widgetTypeDelay, "delay", 50, "delay between keystrokes (ms)")
	widgetCmd.AddCommand(widgetTypeCmd)
}

func widgetTypeRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("widget", rtnErr == nil) }()
	blockId, err := resolveWidgetBlockId()
	if err != nil {
		return err
	}
	result, err := wshclient.WidgetKeyboardTypeCommand(RpcClient, wshrpc.CommandWidgetKeyboardTypeData{
		BlockId: blockId,
		Text:    args[0],
		DelayMs: widgetTypeDelay,
	}, getTabRouteOpts())
	if err := requireWidgetAction("widget type", result, err); err != nil {
		return err
	}
	WriteStdout("Typed %d characters\n", len(args[0]))
	return nil
}

// =========================================================================
// press — Press key combination
// =========================================================================

var widgetPressCmd = &cobra.Command{
	Use:   "press <key> [key...]",
	Short: "Press key(s) or key combination",
	Args:  cobra.MinimumNArgs(1),
	RunE:  widgetPressRun,
}

func initWidgetPress() {
	widgetCmd.AddCommand(widgetPressCmd)
}

func widgetPressRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("widget", rtnErr == nil) }()
	blockId, err := resolveWidgetBlockId()
	if err != nil {
		return err
	}
	result, err := wshclient.WidgetKeyboardPressCommand(RpcClient, wshrpc.CommandWidgetKeyboardPressData{
		BlockId: blockId,
		Keys:    args,
	}, getTabRouteOpts())
	if err := requireWidgetAction("widget press", result, err); err != nil {
		return err
	}
	WriteStdout("Pressed %s\n", strings.Join(args, "+"))
	return nil
}

// =========================================================================
// scroll — Scroll by pixel delta
// =========================================================================

var widgetScrollAmount int
var widgetScrollOriginX int
var widgetScrollOriginY int

var widgetScrollCmd = &cobra.Command{
	Use:   "scroll",
	Short: "Scroll within a block by pixel delta",
	RunE:  widgetScrollRun,
}

func initWidgetScroll() {
	widgetScrollCmd.Flags().IntVar(&widgetScrollAmount, "amount", 0, "vertical scroll amount in pixels")
	widgetScrollCmd.Flags().IntVar(&widgetScrollOriginX, "origin-x", 0, "optional X coordinate of scroll target")
	widgetScrollCmd.Flags().IntVar(&widgetScrollOriginY, "origin-y", 0, "optional Y coordinate of scroll target")
	widgetScrollCmd.MarkFlagRequired("amount")
	widgetCmd.AddCommand(widgetScrollCmd)
}

func widgetScrollRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("widget", rtnErr == nil) }()
	blockId, err := resolveWidgetBlockId()
	if err != nil {
		return err
	}
	var originX *int
	var originY *int
	if cmd.Flags().Changed("origin-x") {
		originX = &widgetScrollOriginX
	}
	if cmd.Flags().Changed("origin-y") {
		originY = &widgetScrollOriginY
	}
	result, err := wshclient.WidgetMouseScrollCommand(RpcClient, wshrpc.CommandWidgetMouseScrollData{
		BlockId: blockId,
		Amount:  widgetScrollAmount,
		OriginX: originX,
		OriginY: originY,
	}, getTabRouteOpts())
	if err := requireWidgetAction("widget scroll", result, err); err != nil {
		return err
	}
	WriteStdout("Scrolled by %d pixels\n", widgetScrollAmount)
	return nil
}

// =========================================================================
// scroll-to — Scroll to element/position
// =========================================================================

var widgetScrollToRef string
var widgetScrollToX int
var widgetScrollToY int

var widgetScrollToCmd = &cobra.Command{
	Use:   "scroll-to",
	Short: "Scroll to an element or position",
	RunE:  widgetScrollToRun,
}

func initWidgetScrollTo() {
	widgetScrollToCmd.Flags().StringVar(&widgetScrollToRef, "element-ref", "", "element ref")
	widgetScrollToCmd.Flags().IntVar(&widgetScrollToX, "x", 0, "X coordinate")
	widgetScrollToCmd.Flags().IntVar(&widgetScrollToY, "y", 0, "Y coordinate")
	widgetCmd.AddCommand(widgetScrollToCmd)
}

func widgetScrollToRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("widget", rtnErr == nil) }()
	blockId, err := resolveWidgetBlockId()
	if err != nil {
		return err
	}
	result, err := wshclient.WidgetScrollToCommand(RpcClient, wshrpc.CommandWidgetScrollToData{
		BlockId:    blockId,
		ElementRef: widgetScrollToRef,
		X:          widgetScrollToX,
		Y:          widgetScrollToY,
	}, getTabRouteOpts())
	if err := requireWidgetAction("widget scroll-to", result, err); err != nil {
		return err
	}
	WriteStdout("Scrolled to target\n")
	return nil
}

// =========================================================================
// drag — Drag from one position to another
// =========================================================================

var widgetDragStartX int
var widgetDragStartY int
var widgetDragEndX int
var widgetDragEndY int
var widgetDragButton string

var widgetDragCmd = &cobra.Command{
	Use:   "drag",
	Short: "Drag from start position to end position",
	RunE:  widgetDragRun,
}

func initWidgetDrag() {
	widgetDragCmd.Flags().IntVar(&widgetDragStartX, "start-x", 0, "Start X")
	widgetDragCmd.Flags().IntVar(&widgetDragStartY, "start-y", 0, "Start Y")
	widgetDragCmd.Flags().IntVar(&widgetDragEndX, "end-x", 0, "End X")
	widgetDragCmd.Flags().IntVar(&widgetDragEndY, "end-y", 0, "End Y")
	widgetDragCmd.Flags().StringVar(&widgetDragButton, "button", "left", "mouse button")
	widgetDragCmd.MarkFlagRequired("start-x")
	widgetDragCmd.MarkFlagRequired("start-y")
	widgetDragCmd.MarkFlagRequired("end-x")
	widgetDragCmd.MarkFlagRequired("end-y")
	widgetCmd.AddCommand(widgetDragCmd)
}

func widgetDragRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("widget", rtnErr == nil) }()
	blockId, err := resolveWidgetBlockId()
	if err != nil {
		return err
	}
	result, err := wshclient.WidgetDragCommand(RpcClient, wshrpc.CommandWidgetDragData{
		BlockId: blockId,
		StartX:  widgetDragStartX,
		StartY:  widgetDragStartY,
		EndX:    widgetDragEndX,
		EndY:    widgetDragEndY,
		Button:  widgetDragButton,
	}, getTabRouteOpts())
	if err := requireWidgetAction("widget drag", result, err); err != nil {
		return err
	}
	WriteStdout("Dragged from (%d,%d) to (%d,%d)\n", widgetDragStartX, widgetDragStartY, widgetDragEndX, widgetDragEndY)
	return nil
}

// =========================================================================
// long-press — Long press at element/position
// =========================================================================

var widgetLongPressRef string
var widgetLongPressX int
var widgetLongPressY int
var widgetLongPressDuration float64

var widgetLongPressCmd = &cobra.Command{
	Use:   "long-press",
	Short: "Long press (hold) at element or position",
	RunE:  widgetLongPressRun,
}

func initWidgetLongPress() {
	widgetLongPressCmd.Flags().StringVar(&widgetLongPressRef, "element-ref", "", "element ref")
	widgetLongPressCmd.Flags().IntVar(&widgetLongPressX, "x", 0, "X coordinate")
	widgetLongPressCmd.Flags().IntVar(&widgetLongPressY, "y", 0, "Y coordinate")
	widgetLongPressCmd.Flags().Float64Var(&widgetLongPressDuration, "duration", 1.0, "hold duration (seconds)")
	widgetCmd.AddCommand(widgetLongPressCmd)
}

func widgetLongPressRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("widget", rtnErr == nil) }()
	blockId, err := resolveWidgetBlockId()
	if err != nil {
		return err
	}
	result, err := wshclient.WidgetLongPressCommand(RpcClient, wshrpc.CommandWidgetLongPressData{
		BlockId:    blockId,
		ElementRef: widgetLongPressRef,
		X:          widgetLongPressX,
		Y:          widgetLongPressY,
		Duration:   widgetLongPressDuration,
	}, getTabRouteOpts())
	if err := requireWidgetAction("widget long-press", result, err); err != nil {
		return err
	}
	WriteStdout("Long pressed (%.1fs)\n", widgetLongPressDuration)
	return nil
}

// =========================================================================
// get-value — Get element value
// =========================================================================

var widgetGetValueRef string

var widgetGetValueCmd = &cobra.Command{
	Use:   "get-value",
	Short: "Get the value of an element",
	RunE:  widgetGetValueRun,
}

func initWidgetGetValue() {
	widgetGetValueCmd.Flags().StringVar(&widgetGetValueRef, "element-ref", "", "element ref")
	widgetGetValueCmd.MarkFlagRequired("element-ref")
	widgetCmd.AddCommand(widgetGetValueCmd)
}

func widgetGetValueRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("widget", rtnErr == nil) }()
	blockId, err := resolveWidgetBlockId()
	if err != nil {
		return err
	}
	result, err := wshclient.WidgetGetValueCommand(RpcClient, wshrpc.CommandWidgetGetValueData{
		BlockId:    blockId,
		ElementRef: widgetGetValueRef,
	}, getTabRouteOpts())
	if err != nil {
		return fmt.Errorf("widget get-value: %w", err)
	}
	if widgetJsonOutput {
		barr, _ := json.MarshalIndent(result, "", "  ")
		WriteStdout("%s\n", string(barr))
	} else {
		WriteStdout("%s\n", result.Value)
	}
	return nil
}

// =========================================================================
// set-value — Set element value
// =========================================================================

var widgetSetValueRef string
var widgetSetValueVal string

var widgetSetValueCmd = &cobra.Command{
	Use:   "set-value",
	Short: "Set the value of an input element",
	RunE:  widgetSetValueRun,
}

func initWidgetSetValue() {
	widgetSetValueCmd.Flags().StringVar(&widgetSetValueRef, "element-ref", "", "element ref")
	widgetSetValueCmd.Flags().StringVar(&widgetSetValueVal, "value", "", "value to set")
	widgetSetValueCmd.MarkFlagRequired("element-ref")
	widgetSetValueCmd.MarkFlagRequired("value")
	widgetCmd.AddCommand(widgetSetValueCmd)
}

func widgetSetValueRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("widget", rtnErr == nil) }()
	blockId, err := resolveWidgetBlockId()
	if err != nil {
		return err
	}
	result, err := wshclient.WidgetSetValueCommand(RpcClient, wshrpc.CommandWidgetSetValueData{
		BlockId:    blockId,
		ElementRef: widgetSetValueRef,
		Value:      widgetSetValueVal,
	}, getTabRouteOpts())
	if err := requireWidgetAction("widget set-value", result, err); err != nil {
		return err
	}
	WriteStdout("Value set\n")
	return nil
}

// =========================================================================
// clear — Clear element
// =========================================================================

var widgetClearRef string

var widgetClearCmd = &cobra.Command{
	Use:   "clear",
	Short: "Clear an element's content",
	RunE:  widgetClearRun,
}

func initWidgetClear() {
	widgetClearCmd.Flags().StringVar(&widgetClearRef, "element-ref", "", "element ref")
	widgetClearCmd.MarkFlagRequired("element-ref")
	widgetCmd.AddCommand(widgetClearCmd)
}

func widgetClearRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("widget", rtnErr == nil) }()
	blockId, err := resolveWidgetBlockId()
	if err != nil {
		return err
	}
	result, err := wshclient.WidgetClearCommand(RpcClient, wshrpc.CommandWidgetClearData{
		BlockId:    blockId,
		ElementRef: widgetClearRef,
	}, getTabRouteOpts())
	if err := requireWidgetAction("widget clear", result, err); err != nil {
		return err
	}
	WriteStdout("Element cleared\n")
	return nil
}

// =========================================================================
// select — Select option
// =========================================================================

var widgetSelectRef string
var widgetSelectOption string

var widgetSelectCmd = &cobra.Command{
	Use:   "select",
	Short: "Select an option in a select/combobox element",
	RunE:  widgetSelectRun,
}

func initWidgetSelect() {
	widgetSelectCmd.Flags().StringVar(&widgetSelectRef, "element-ref", "", "element ref")
	widgetSelectCmd.Flags().StringVar(&widgetSelectOption, "option", "", "option to select")
	widgetSelectCmd.MarkFlagRequired("element-ref")
	widgetSelectCmd.MarkFlagRequired("option")
	widgetCmd.AddCommand(widgetSelectCmd)
}

func widgetSelectRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("widget", rtnErr == nil) }()
	blockId, err := resolveWidgetBlockId()
	if err != nil {
		return err
	}
	result, err := wshclient.WidgetSelectCommand(RpcClient, wshrpc.CommandWidgetSelectData{
		BlockId:    blockId,
		ElementRef: widgetSelectRef,
		Option:     widgetSelectOption,
	}, getTabRouteOpts())
	if err := requireWidgetAction("widget select", result, err); err != nil {
		return err
	}
	WriteStdout("Option selected\n")
	return nil
}

// =========================================================================
// toggle — Toggle element
// =========================================================================

var widgetToggleRef string

var widgetToggleCmd = &cobra.Command{
	Use:   "toggle",
	Short: "Toggle a checkbox, switch, or expandable element",
	RunE:  widgetToggleRun,
}

func initWidgetToggle() {
	widgetToggleCmd.Flags().StringVar(&widgetToggleRef, "element-ref", "", "element ref")
	widgetToggleCmd.MarkFlagRequired("element-ref")
	widgetCmd.AddCommand(widgetToggleCmd)
}

func widgetToggleRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("widget", rtnErr == nil) }()
	blockId, err := resolveWidgetBlockId()
	if err != nil {
		return err
	}
	result, err := wshclient.WidgetToggleCommand(RpcClient, wshrpc.CommandWidgetToggleData{
		BlockId:    blockId,
		ElementRef: widgetToggleRef,
	}, getTabRouteOpts())
	if err := requireWidgetAction("widget toggle", result, err); err != nil {
		return err
	}
	WriteStdout("Toggled\n")
	return nil
}

// =========================================================================
// wait-for — Wait for element condition
// =========================================================================

var widgetWaitRef string
var widgetWaitCondition string
var widgetWaitTimeout int

var widgetWaitCmd = &cobra.Command{
	Use:   "wait-for",
	Short: "Wait for an element to reach a condition",
	RunE:  widgetWaitRun,
}

func initWidgetWait() {
	widgetWaitCmd.Flags().StringVar(&widgetWaitRef, "element-ref", "", "element ref")
	widgetWaitCmd.Flags().StringVar(&widgetWaitCondition, "condition", "visible", "condition: visible, hidden, focused, enabled, disabled")
	widgetWaitCmd.Flags().IntVar(&widgetWaitTimeout, "timeout", 10000, "timeout in milliseconds")
	widgetCmd.AddCommand(widgetWaitCmd)
}

func widgetWaitRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("widget", rtnErr == nil) }()
	blockId, err := resolveWidgetBlockId()
	if err != nil {
		return err
	}
	result, err := wshclient.WidgetWaitForElementCommand(RpcClient, wshrpc.CommandWidgetWaitForElementData{
		BlockId:    blockId,
		ElementRef: widgetWaitRef,
		Condition:  widgetWaitCondition,
		TimeoutMs:  widgetWaitTimeout,
	}, getTabRouteOpts())
	if err != nil {
		return fmt.Errorf("widget wait-for: %w", err)
	}
	if widgetJsonOutput {
		barr, _ := json.MarshalIndent(result, "", "  ")
		WriteStdout("%s\n", string(barr))
	} else if result.Met {
		WriteStdout("Condition met after %dms\n", result.WaitTimeMs)
	} else {
		WriteStdout("Condition not met within timeout\n")
	}
	return nil
}

// =========================================================================
// get-state — Get block state
// =========================================================================

var widgetGetStateCmd = &cobra.Command{
	Use:   "get-state",
	Short: "Get the current state of the block",
	RunE:  widgetGetStateRun,
}

func initWidgetGetState() {
	widgetCmd.AddCommand(widgetGetStateCmd)
}

func widgetGetStateRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("widget", rtnErr == nil) }()
	blockId, err := resolveWidgetBlockId()
	if err != nil {
		return err
	}
	result, err := wshclient.WidgetGetStateCommand(RpcClient, wshrpc.CommandWidgetGetStateData{BlockId: blockId}, getTabRouteOpts())
	if err != nil {
		return fmt.Errorf("widget get-state: %w", err)
	}
	if widgetJsonOutput {
		barr, _ := json.MarshalIndent(result, "", "  ")
		WriteStdout("%s\n", string(barr))
	} else {
		WriteStdout("Block:    %s\n", result.BlockId)
		WriteStdout("ViewType: %s\n", result.ViewType)
		WriteStdout("Focused:  %v\n", result.Focused)
		WriteStdout("Position: (%.0f,%.0f) %.0fx%.0f\n", result.X, result.Y, result.Width, result.Height)
	}
	return nil
}

// =========================================================================
// clipboard-get — Get clipboard content
// =========================================================================

var widgetClipboardGetCmd = &cobra.Command{
	Use:   "clipboard-get",
	Short: "Get clipboard content from the block",
	RunE:  widgetClipboardGetRun,
}

func initWidgetClipboardGet() {
	widgetCmd.AddCommand(widgetClipboardGetCmd)
}

func widgetClipboardGetRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("widget", rtnErr == nil) }()
	blockId, err := resolveWidgetBlockId()
	if err != nil {
		return err
	}
	result, err := wshclient.WidgetClipboardGetCommand(RpcClient, wshrpc.CommandWidgetClipboardGetData{BlockId: blockId}, getTabRouteOpts())
	if err != nil {
		return fmt.Errorf("widget clipboard-get: %w", err)
	}
	if widgetJsonOutput {
		barr, _ := json.MarshalIndent(result, "", "  ")
		WriteStdout("%s\n", string(barr))
	} else {
		WriteStdout("%s\n", result.Text)
	}
	return nil
}

// =========================================================================
// clipboard-set — Set clipboard content
// =========================================================================

var widgetClipboardSetText string

var widgetClipboardSetCmd = &cobra.Command{
	Use:   "clipboard-set",
	Short: "Set clipboard content for the block",
	RunE:  widgetClipboardSetRun,
}

func initWidgetClipboardSet() {
	widgetClipboardSetCmd.Flags().StringVar(&widgetClipboardSetText, "text", "", "text to set on clipboard")
	widgetClipboardSetCmd.MarkFlagRequired("text")
	widgetCmd.AddCommand(widgetClipboardSetCmd)
}

func widgetClipboardSetRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("widget", rtnErr == nil) }()
	blockId, err := resolveWidgetBlockId()
	if err != nil {
		return err
	}
	result, err := wshclient.WidgetClipboardSetCommand(RpcClient, wshrpc.CommandWidgetClipboardSetData{
		BlockId: blockId,
		Text:    widgetClipboardSetText,
	}, getTabRouteOpts())
	if err := requireWidgetAction("widget clipboard-set", result, err); err != nil {
		return err
	}
	WriteStdout("Clipboard set\n")
	return nil
}
