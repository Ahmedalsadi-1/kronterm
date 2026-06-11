// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package aiusechat

import (
	"context"
	"fmt"
	"time"

	"github.com/wavetermdev/waveterm/pkg/aiusechat/uctypes"
	"github.com/wavetermdev/waveterm/pkg/waveobj"
	"github.com/wavetermdev/waveterm/pkg/wcore"
	"github.com/wavetermdev/waveterm/pkg/wshrpc"
	"github.com/wavetermdev/waveterm/pkg/wshrpc/wshclient"
	"github.com/wavetermdev/waveterm/pkg/wshutil"
	"github.com/wavetermdev/waveterm/pkg/wstore"
)

// =============================================================================
// WIDGET INTROSPECTION TOOLS
// =============================================================================

// WidgetGetElementsInput - Get interactive elements in a widget
type WidgetGetElementsInput struct {
	WidgetId string `json:"widget_id"`
}

// WidgetElement - Represents an interactive element
type WidgetElement struct {
	Ref       string  `json:"ref"`  // Unique identifier for the element
	Role      string  `json:"role"` // button, link, input, checkbox, etc.
	Name      string  `json:"name"` // Accessible name
	Value     string  `json:"value,omitempty"`
	Bounds    *Bounds `json:"bounds,omitempty"` // x, y, width, height
	Focusable bool    `json:"focusable"`
	Visible   bool    `json:"visible"`
}

// Bounds - Element position and size
type Bounds struct {
	X      int `json:"x"`
	Y      int `json:"y"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

// WidgetGetElementsOutput - Response for get_elements tool
type WidgetGetElementsOutput struct {
	WidgetId  string          `json:"widget_id"`
	Elements  []WidgetElement `json:"elements"`
	Count     int             `json:"count"`
	Timestamp int64           `json:"timestamp"`
}

// WidgetGetStateOutput - Get widget state information
type WidgetGetStateOutput struct {
	WidgetId   string         `json:"widget_id"`
	ViewType   string         `json:"view_type"`
	State      map[string]any `json:"state"`
	Focused    bool           `json:"focused"`
	Dimensions *Bounds        `json:"dimensions,omitempty"`
}

type OpenWidgetEntry struct {
	WidgetId   string         `json:"widget_id"`
	BlockId    string         `json:"block_id"`
	ViewType   string         `json:"view_type"`
	Title      string         `json:"title,omitempty"`
	Controller string         `json:"controller,omitempty"`
	Meta       map[string]any `json:"meta,omitempty"`
}

type OpenWidgetsOutput struct {
	TabId     string            `json:"tab_id"`
	Widgets   []OpenWidgetEntry `json:"widgets"`
	Count     int               `json:"count"`
	Timestamp int64             `json:"timestamp"`
}

func GetOpenWidgetsToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "widget_list_open",
		DisplayName: "List Open Widgets",
		Description: "List currently open widgets in this workspace tab, including each widget_id prefix to use with widget_snapshot, widget_click, widget_drag, and other widget tools.",
		ToolLogName: "human:widget_list_open",
		Strict:      false,
		InputSchema: map[string]any{
			"type":                 "object",
			"properties":           map[string]any{},
			"additionalProperties": false,
		},
		ToolCallDesc: func(input any, output any, toolUseData *uctypes.UIMessageDataToolUse) string {
			return "listing open widgets"
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			ctx, cancelFn := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancelFn()

			tabObj, err := wstore.DBMustGet[*waveobj.Tab](ctx, tabId)
			if err != nil {
				return nil, fmt.Errorf("error getting tab: %w", err)
			}

			rtn := &OpenWidgetsOutput{TabId: tabId, Timestamp: time.Now().UnixMilli()}
			for _, blockId := range tabObj.BlockIds {
				block, err := wstore.DBGet[*waveobj.Block](ctx, blockId)
				if err != nil || block == nil {
					continue
				}
				viewType, _ := block.Meta["view"].(string)
				title, _ := block.Meta["frame:title"].(string)
				controller, _ := block.Meta["controller"].(string)
				meta := make(map[string]any, len(block.Meta))
				for key, val := range block.Meta {
					meta[key] = val
				}
				rtn.Widgets = append(rtn.Widgets, OpenWidgetEntry{
					WidgetId:   block.OID[:8],
					BlockId:    block.OID,
					ViewType:   viewType,
					Title:      title,
					Controller: controller,
					Meta:       meta,
				})
			}
			rtn.Count = len(rtn.Widgets)
			return rtn, nil
		},
	}
}

// parseWidgetGetElementsInput parses the input for get_elements tool
func parseWidgetGetElementsInput(input any) (*WidgetGetElementsInput, error) {
	result := &WidgetGetElementsInput{}
	if input == nil {
		return nil, fmt.Errorf("widget_id is required")
	}
	inputMap, ok := input.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("invalid input format")
	}
	widgetId, ok := inputMap["widget_id"].(string)
	if !ok || widgetId == "" {
		return nil, fmt.Errorf("widget_id is required and must be a string")
	}
	result.WidgetId = widgetId
	return result, nil
}

// getWidgetElements executes the RPC to get widget elements
func getWidgetElements(ctx context.Context, tabId string, input *WidgetGetElementsInput) (*wshrpc.WidgetGetElementsRtnData, error) {
	fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, input.WidgetId)
	if err != nil {
		return nil, err
	}

	rpcClient := wshclient.GetBareRpcClient()
	result, err := wshclient.WidgetGetElementsCommand(
		rpcClient,
		wshrpc.CommandWidgetGetElementsData{BlockId: fullBlockId},
		&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get widget elements: %w", err)
	}

	return result, nil
}

// GetWidgetGetElementsToolDefinition returns the tool definition for getting widget elements
func GetWidgetGetElementsToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "widget_get_elements",
		DisplayName: "Get Widget Elements",
		Description: "Get a list of all interactive elements (buttons, links, inputs, etc.) in a widget. Returns element references that can be used with click/type tools, along with their positions and accessibility information.",
		ToolLogName: "human:get_elements",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "8-character widget ID of the widget to inspect",
				},
			},
			"required":             []string{"widget_id"},
			"additionalProperties": false,
		},
		ToolCallDesc: func(input any, output any, toolUseData *uctypes.UIMessageDataToolUse) string {
			parsed, err := parseWidgetGetElementsInput(input)
			if err != nil {
				return "error parsing input"
			}
			return fmt.Sprintf("inspecting interactive elements in widget %s", parsed.WidgetId)
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			parsed, err := parseWidgetGetElementsInput(input)
			if err != nil {
				return nil, err
			}

			ctx, cancelFn := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancelFn()

			result, err := getWidgetElements(ctx, tabId, parsed)
			if err != nil {
				return nil, err
			}

			return result, nil
		},
	}
}

// GetWidgetGetStateToolDefinition returns the tool definition for getting widget state
func GetWidgetGetStateToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "widget_get_state",
		DisplayName: "Get Widget State",
		Description: "Get the current state of a widget including view type, dimensions, focus status, and view-specific state information.",
		ToolLogName: "human:get_state",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "8-character widget ID of the widget to inspect",
				},
			},
			"required":             []string{"widget_id"},
			"additionalProperties": false,
		},
		ToolCallDesc: func(input any, output any, toolUseData *uctypes.UIMessageDataToolUse) string {
			parsed, err := parseWidgetGetElementsInput(input)
			if err != nil {
				return "error parsing input"
			}
			return fmt.Sprintf("getting state of widget %s", parsed.WidgetId)
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			parsed, err := parseWidgetGetElementsInput(input)
			if err != nil {
				return nil, err
			}

			ctx, cancelFn := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancelFn()

			fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, parsed.WidgetId)
			if err != nil {
				return nil, err
			}

			rpcClient := wshclient.GetBareRpcClient()
			result, err := wshclient.WidgetGetStateCommand(
				rpcClient,
				wshrpc.CommandWidgetGetStateData{BlockId: fullBlockId},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to get widget state: %w", err)
			}

			return result, nil
		},
	}
}

// =============================================================================
// MOUSE ACTION TOOLS
// =============================================================================

// MouseClickInput - Parameters for mouse click
type MouseClickInput struct {
	WidgetId   string `json:"widget_id"`
	ElementRef string `json:"element_ref,omitempty"` // Element to click (if known)
	X          *int   `json:"x,omitempty"`           // X coordinate (if no element_ref)
	Y          *int   `json:"y,omitempty"`           // Y coordinate (if no element_ref)
	Button     string `json:"button,omitempty"`      // left, right, middle (default: left)
	ClickCount int    `json:"click_count,omitempty"` // 1, 2, 3 (default: 1)
}

// MouseMoveInput - Parameters for mouse move
type MouseMoveInput struct {
	WidgetId string `json:"widget_id"`
	X        int    `json:"x"`
	Y        int    `json:"y"`
}

// MouseScrollInput - Parameters for mouse scroll
type MouseScrollInput struct {
	WidgetId string `json:"widget_id"`
	Amount   int    `json:"amount"` // Positive = scroll down, negative = scroll up
	OriginX  *int   `json:"origin_x,omitempty"`
	OriginY  *int   `json:"origin_y,omitempty"`
}

// MouseDragInput - Parameters for mouse drag
type MouseDragInput struct {
	WidgetId string `json:"widget_id"`
	StartX   int    `json:"start_x"`
	StartY   int    `json:"start_y"`
	EndX     int    `json:"end_x"`
	EndY     int    `json:"end_y"`
	Button   string `json:"button,omitempty"` // default: left
}

// MouseActionOutput - Result of mouse action
type MouseActionOutput struct {
	WidgetId string `json:"widget_id"`
	Success  bool   `json:"success"`
	Message  string `json:"message,omitempty"`
}

// parseMouseClickInput parses mouse click input
func parseMouseClickInput(input any) (*MouseClickInput, error) {
	result := &MouseClickInput{Button: "left", ClickCount: 1}
	if input == nil {
		return nil, fmt.Errorf("input is required")
	}
	inputMap, ok := input.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("invalid input format")
	}

	widgetId, ok := inputMap["widget_id"].(string)
	if !ok || widgetId == "" {
		return nil, fmt.Errorf("widget_id is required")
	}
	result.WidgetId = widgetId

	if v, ok := inputMap["element_ref"].(string); ok {
		result.ElementRef = v
	}
	if v, ok := inputMap["x"].(float64); ok {
		x := int(v)
		result.X = &x
	}
	if v, ok := inputMap["y"].(float64); ok {
		y := int(v)
		result.Y = &y
	}
	if v, ok := inputMap["button"].(string); ok {
		result.Button = v
	}
	if v, ok := inputMap["click_count"].(float64); ok {
		result.ClickCount = int(v)
	}

	return result, nil
}

// GetMouseClickToolDefinition returns the tool definition for clicking
func GetMouseClickToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "mouse_click",
		DisplayName: "Mouse Click",
		Description: "Click at a specific position or on a specific element in a widget. Use element_ref if known from get_elements, otherwise provide x,y coordinates relative to the widget.",
		ToolLogName: "human:mouse_click",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "8-character widget ID of the target widget",
				},
				"element_ref": map[string]any{
					"type":        "string",
					"description": "Element reference from get_elements (optional if x,y provided)",
				},
				"x": map[string]any{
					"type":        "integer",
					"description": "X coordinate within widget (optional if element_ref provided)",
				},
				"y": map[string]any{
					"type":        "integer",
					"description": "Y coordinate within widget (optional if element_ref provided)",
				},
				"button": map[string]any{
					"type":        "string",
					"description": "Mouse button: left, right, middle (default: left)",
					"enum":        []string{"left", "right", "middle"},
				},
				"click_count": map[string]any{
					"type":        "integer",
					"description": "Number of clicks: 1, 2, 3 (default: 1)",
				},
			},
			"required":             []string{"widget_id"},
			"additionalProperties": false,
		},
		ToolCallDesc: func(input any, output any, toolUseData *uctypes.UIMessageDataToolUse) string {
			parsed, err := parseMouseClickInput(input)
			if err != nil {
				return "error parsing input"
			}
			msg := fmt.Sprintf("clicking widget %s", parsed.WidgetId)
			if parsed.ElementRef != "" {
				msg += fmt.Sprintf(" on element %s", parsed.ElementRef)
			} else if parsed.X != nil && parsed.Y != nil {
				msg += fmt.Sprintf(" at (%d, %d)", *parsed.X, *parsed.Y)
			}
			return msg
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			parsed, err := parseMouseClickInput(input)
			if err != nil {
				return nil, err
			}

			ctx, cancelFn := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancelFn()

			fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, parsed.WidgetId)
			if err != nil {
				return nil, err
			}

			var x, y int
			if parsed.ElementRef != "" {
				// First get element position
				elementsResult, err := getWidgetElements(ctx, tabId, &WidgetGetElementsInput{WidgetId: parsed.WidgetId})
				if err != nil {
					return nil, err
				}
				var found bool
				for _, elem := range elementsResult.Elements {
					if elem.Ref == parsed.ElementRef && elem.Visible {
						x = elem.X + elem.Width/2
						y = elem.Y + elem.Height/2
						found = true
						break
					}
				}
				if !found {
					return nil, fmt.Errorf("element %s not found or has no bounds", parsed.ElementRef)
				}
			} else if parsed.X != nil && parsed.Y != nil {
				x = *parsed.X
				y = *parsed.Y
			} else {
				return nil, fmt.Errorf("either element_ref or x,y coordinates required")
			}

			rpcClient := wshclient.GetBareRpcClient()
			_, err = wshclient.WidgetMouseClickCommand(
				rpcClient,
				wshrpc.CommandWidgetMouseClickData{
					BlockId:    fullBlockId,
					X:          x,
					Y:          y,
					Button:     parsed.Button,
					ClickCount: parsed.ClickCount,
				},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to click: %w", err)
			}

			return &MouseActionOutput{
				WidgetId: parsed.WidgetId,
				Success:  true,
				Message:  fmt.Sprintf("clicked at (%d, %d)", x, y),
			}, nil
		},
	}
}

// GetMouseScrollToolDefinition returns the tool definition for scrolling
func GetMouseScrollToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "mouse_scroll",
		DisplayName: "Mouse Scroll",
		Description: "Scroll up or down within a widget. Positive amount scrolls down, negative scrolls up.",
		ToolLogName: "human:mouse_scroll",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "8-character widget ID of the target widget",
				},
				"amount": map[string]any{
					"type":        "integer",
					"description": "Scroll amount (positive = down, negative = up)",
				},
				"origin_x": map[string]any{
					"type":        "integer",
					"description": "X origin of scroll (optional, defaults to center)",
				},
				"origin_y": map[string]any{
					"type":        "integer",
					"description": "Y origin of scroll (optional, defaults to center)",
				},
			},
			"required":             []string{"widget_id", "amount"},
			"additionalProperties": false,
		},
		ToolCallDesc: func(input any, output any, toolUseData *uctypes.UIMessageDataToolUse) string {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return "error parsing input"
			}
			widgetId, _ := inputMap["widget_id"].(string)
			amount, _ := inputMap["amount"].(float64)
			direction := "down"
			if amount < 0 {
				direction = "up"
			}
			return fmt.Sprintf("scrolling widget %s %s by %d", widgetId, direction, int(amount))
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input format")
			}

			widgetId, ok := inputMap["widget_id"].(string)
			if !ok || widgetId == "" {
				return nil, fmt.Errorf("widget_id is required")
			}

			amount, ok := inputMap["amount"].(float64)
			if !ok {
				return nil, fmt.Errorf("amount is required")
			}

			ctx, cancelFn := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancelFn()

			fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, widgetId)
			if err != nil {
				return nil, err
			}

			var originX, originY *int
			if v, ok := inputMap["origin_x"].(float64); ok {
				x := int(v)
				originX = &x
			}
			if v, ok := inputMap["origin_y"].(float64); ok {
				y := int(v)
				originY = &y
			}

			rpcClient := wshclient.GetBareRpcClient()
			_, err = wshclient.WidgetMouseScrollCommand(
				rpcClient,
				wshrpc.CommandWidgetMouseScrollData{
					BlockId: fullBlockId,
					Amount:  int(amount),
					OriginX: originX,
					OriginY: originY,
				},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to scroll: %w", err)
			}

			return &MouseActionOutput{
				WidgetId: widgetId,
				Success:  true,
				Message:  fmt.Sprintf("scrolled by %d", int(amount)),
			}, nil
		},
	}
}

// GetMouseDragToolDefinition returns the tool definition for dragging
func GetMouseDragToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "mouse_drag",
		DisplayName: "Mouse Drag",
		Description: "Perform a drag operation from one position to another within a widget.",
		ToolLogName: "human:mouse_drag",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "8-character widget ID of the target widget",
				},
				"start_x": map[string]any{
					"type":        "integer",
					"description": "Starting X coordinate",
				},
				"start_y": map[string]any{
					"type":        "integer",
					"description": "Starting Y coordinate",
				},
				"end_x": map[string]any{
					"type":        "integer",
					"description": "Ending X coordinate",
				},
				"end_y": map[string]any{
					"type":        "integer",
					"description": "Ending Y coordinate",
				},
				"button": map[string]any{
					"type":        "string",
					"description": "Mouse button to drag with (default: left)",
					"enum":        []string{"left", "right", "middle"},
				},
			},
			"required":             []string{"widget_id", "start_x", "start_y", "end_x", "end_y"},
			"additionalProperties": false,
		},
		ToolCallDesc: func(input any, output any, toolUseData *uctypes.UIMessageDataToolUse) string {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return "error parsing input"
			}
			widgetId, _ := inputMap["widget_id"].(string)
			sx, _ := inputMap["start_x"].(float64)
			sy, _ := inputMap["start_y"].(float64)
			ex, _ := inputMap["end_x"].(float64)
			ey, _ := inputMap["end_y"].(float64)
			return fmt.Sprintf("dragging widget %s from (%d,%d) to (%d,%d)", widgetId, int(sx), int(sy), int(ex), int(ey))
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input format")
			}

			widgetId, ok := inputMap["widget_id"].(string)
			if !ok || widgetId == "" {
				return nil, fmt.Errorf("widget_id is required")
			}

			sx, ok := inputMap["start_x"].(float64)
			if !ok {
				return nil, fmt.Errorf("start_x is required")
			}
			sy, ok := inputMap["start_y"].(float64)
			if !ok {
				return nil, fmt.Errorf("start_y is required")
			}
			ex, ok := inputMap["end_x"].(float64)
			if !ok {
				return nil, fmt.Errorf("end_x is required")
			}
			ey, ok := inputMap["end_y"].(float64)
			if !ok {
				return nil, fmt.Errorf("end_y is required")
			}

			button := "left"
			if v, ok := inputMap["button"].(string); ok {
				button = v
			}

			ctx, cancelFn := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancelFn()

			fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, widgetId)
			if err != nil {
				return nil, err
			}

			rpcClient := wshclient.GetBareRpcClient()
			_, err = wshclient.WidgetMouseDragCommand(
				rpcClient,
				wshrpc.CommandWidgetMouseDragData{
					BlockId: fullBlockId,
					StartX:  int(sx),
					StartY:  int(sy),
					EndX:    int(ex),
					EndY:    int(ey),
					Button:  button,
				},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to drag: %w", err)
			}

			return &MouseActionOutput{
				WidgetId: widgetId,
				Success:  true,
				Message:  fmt.Sprintf("dragged from (%d,%d) to (%d,%d)", int(sx), int(sy), int(ex), int(ey)),
			}, nil
		},
	}
}

// =============================================================================
// KEYBOARD ACTION TOOLS
// =============================================================================

// KeyboardTypeInput - Parameters for typing
type KeyboardTypeInput struct {
	WidgetId string `json:"widget_id"`
	Text     string `json:"text"`
	Delay    *int   `json:"delay_ms,omitempty"` // Delay between keystrokes
}

// KeyboardPressInput - Parameters for key press
type KeyboardPressInput struct {
	WidgetId string   `json:"widget_id"`
	Keys     []string `json:"keys"` // e.g., ["Control", "c"] for Ctrl+C
}

// KeyboardActionOutput - Result of keyboard action
type KeyboardActionOutput struct {
	WidgetId string `json:"widget_id"`
	Success  bool   `json:"success"`
	Message  string `json:"message,omitempty"`
}

// GetKeyboardTypeToolDefinition returns the tool definition for typing
func GetKeyboardTypeToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "keyboard_type",
		DisplayName: "Keyboard Type",
		Description: "Type text into a widget. The widget must be focused. For special keys (Enter, Tab, etc.), use keyboard_press instead.",
		ToolLogName: "human:keyboard_type",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "8-character widget ID of the target widget",
				},
				"text": map[string]any{
					"type":        "string",
					"description": "Text to type",
				},
				"delay_ms": map[string]any{
					"type":        "integer",
					"description": "Delay between keystrokes in milliseconds (default: 50)",
				},
			},
			"required":             []string{"widget_id", "text"},
			"additionalProperties": false,
		},
		ToolCallDesc: func(input any, output any, toolUseData *uctypes.UIMessageDataToolUse) string {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return "error parsing input"
			}
			widgetId, _ := inputMap["widget_id"].(string)
			text, _ := inputMap["text"].(string)
			if len(text) > 50 {
				text = text[:47] + "..."
			}
			return fmt.Sprintf("typing \"%s\" into widget %s", text, widgetId)
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input format")
			}

			widgetId, ok := inputMap["widget_id"].(string)
			if !ok || widgetId == "" {
				return nil, fmt.Errorf("widget_id is required")
			}

			text, ok := inputMap["text"].(string)
			if !ok || text == "" {
				return nil, fmt.Errorf("text is required")
			}

			delay := 50
			if v, ok := inputMap["delay_ms"].(float64); ok {
				delay = int(v)
			}

			ctx, cancelFn := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancelFn()

			fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, widgetId)
			if err != nil {
				return nil, err
			}

			rpcClient := wshclient.GetBareRpcClient()
			_, err = wshclient.WidgetKeyboardTypeCommand(
				rpcClient,
				wshrpc.CommandWidgetKeyboardTypeData{
					BlockId: fullBlockId,
					Text:    text,
					DelayMs: delay,
				},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to type: %w", err)
			}

			return &KeyboardActionOutput{
				WidgetId: widgetId,
				Success:  true,
				Message:  fmt.Sprintf("typed %d characters", len(text)),
			}, nil
		},
	}
}

// GetKeyboardPressToolDefinition returns the tool definition for key press
func GetKeyboardPressToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "keyboard_press",
		DisplayName: "Keyboard Press",
		Description: "Press keyboard keys or key combinations. Examples: Enter, Tab, Escape, Backspace, ArrowUp, Control+c, Shift+Tab. Use + to combine keys.",
		ToolLogName: "human:keyboard_press",
		Strict:      true,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "8-character widget ID of the target widget",
				},
				"keys": map[string]any{
					"type":        "array",
					"items":       map[string]any{"type": "string"},
					"description": "Array of key names to press (e.g., [\"Control\", \"c\"] or [\"Enter\"])",
				},
			},
			"required":             []string{"widget_id", "keys"},
			"additionalProperties": false,
		},
		ToolCallDesc: func(input any, output any, toolUseData *uctypes.UIMessageDataToolUse) string {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return "error parsing input"
			}
			widgetId, _ := inputMap["widget_id"].(string)
			keys, _ := inputMap["keys"].([]any)
			keyStr := ""
			for i, k := range keys {
				if s, ok := k.(string); ok {
					if i > 0 {
						keyStr += "+"
					}
					keyStr += s
				}
			}
			return fmt.Sprintf("pressing %s in widget %s", keyStr, widgetId)
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input format")
			}

			widgetId, ok := inputMap["widget_id"].(string)
			if !ok || widgetId == "" {
				return nil, fmt.Errorf("widget_id is required")
			}

			keys, ok := inputMap["keys"].([]any)
			if !ok || len(keys) == 0 {
				return nil, fmt.Errorf("keys is required and must not be empty")
			}

			keyStrs := make([]string, len(keys))
			for i, k := range keys {
				if s, ok := k.(string); ok {
					keyStrs[i] = s
				} else {
					return nil, fmt.Errorf("all keys must be strings")
				}
			}

			ctx, cancelFn := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancelFn()

			fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, widgetId)
			if err != nil {
				return nil, err
			}

			rpcClient := wshclient.GetBareRpcClient()
			_, err = wshclient.WidgetKeyboardPressCommand(
				rpcClient,
				wshrpc.CommandWidgetKeyboardPressData{
					BlockId: fullBlockId,
					Keys:    keyStrs,
				},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to press keys: %w", err)
			}

			return &KeyboardActionOutput{
				WidgetId: widgetId,
				Success:  true,
				Message:  fmt.Sprintf("pressed %v", keyStrs),
			}, nil
		},
	}
}

// =============================================================================
// WAIT/CONDITION TOOLS
// =============================================================================

// WaitForElementInput - Parameters for waiting
type WaitForElementInput struct {
	WidgetId   string `json:"widget_id"`
	ElementRef string `json:"element_ref,omitempty"`
	Condition  string `json:"condition"` // visible, hidden, focused, enabled
	TimeoutMs  *int   `json:"timeout_ms,omitempty"`
}

// WaitForElementOutput - Result of wait
type WaitForElementOutput struct {
	WidgetId   string `json:"widget_id"`
	Condition  string `json:"condition"`
	Met        bool   `json:"met"`
	WaitTimeMs int    `json:"wait_time_ms"`
	Message    string `json:"message,omitempty"`
}

// GetWaitForElementToolDefinition returns the tool definition for waiting
func GetWaitForElementToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "wait_for_element",
		DisplayName: "Wait For Element",
		Description: "Wait for an element in a widget to reach a certain condition. Returns true if condition is met, false if timeout.",
		ToolLogName: "human:wait_for_element",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "8-character widget ID of the target widget",
				},
				"element_ref": map[string]any{
					"type":        "string",
					"description": "Element reference to wait for (optional, waits for any change if not provided)",
				},
				"condition": map[string]any{
					"type":        "string",
					"description": "Condition to wait for: visible, hidden, focused, enabled, disabled, text_contains",
					"enum":        []string{"visible", "hidden", "focused", "enabled", "disabled", "text_contains"},
				},
				"timeout_ms": map[string]any{
					"type":        "integer",
					"description": "Maximum time to wait in milliseconds (default: 10000)",
				},
			},
			"required":             []string{"widget_id", "condition"},
			"additionalProperties": false,
		},
		ToolCallDesc: func(input any, output any, toolUseData *uctypes.UIMessageDataToolUse) string {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return "error parsing input"
			}
			widgetId, _ := inputMap["widget_id"].(string)
			cond, _ := inputMap["condition"].(string)
			elemRef, _ := inputMap["element_ref"].(string)
			msg := fmt.Sprintf("waiting for %s in widget %s", cond, widgetId)
			if elemRef != "" {
				msg += fmt.Sprintf(" (element: %s)", elemRef)
			}
			return msg
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input format")
			}

			widgetId, ok := inputMap["widget_id"].(string)
			if !ok || widgetId == "" {
				return nil, fmt.Errorf("widget_id is required")
			}

			condition, ok := inputMap["condition"].(string)
			if !ok || condition == "" {
				return nil, fmt.Errorf("condition is required")
			}

			timeoutMs := 10000
			if v, ok := inputMap["timeout_ms"].(float64); ok {
				timeoutMs = int(v)
			}

			elementRef := ""
			if v, ok := inputMap["element_ref"].(string); ok {
				elementRef = v
			}

			ctx, cancelFn := context.WithTimeout(context.Background(), time.Duration(timeoutMs+1000)*time.Millisecond)
			defer cancelFn()

			fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, widgetId)
			if err != nil {
				return nil, err
			}

			rpcClient := wshclient.GetBareRpcClient()
			result, err := wshclient.WidgetWaitForElementCommand(
				rpcClient,
				wshrpc.CommandWidgetWaitForElementData{
					BlockId:    fullBlockId,
					ElementRef: elementRef,
					Condition:  condition,
					TimeoutMs:  timeoutMs,
				},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to wait: %w", err)
			}

			return result, nil
		},
	}
}

// =============================================================================
// SCREENSHOT WITH ANNOTATION TOOL
// =============================================================================

// ScreenshotAnnotatedInput - Parameters for annotated screenshot
type ScreenshotAnnotatedInput struct {
	WidgetId     string `json:"widget_id"`
	ShowElements bool   `json:"show_elements,omitempty"` // Overlay element numbers
}

// GetScreenshotAnnotatedToolDefinition returns the tool definition for annotated screenshot
func GetScreenshotAnnotatedToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:                 "screenshot_annotated",
		DisplayName:          "Screenshot Annotated",
		Description:          "Capture a screenshot of a widget with element numbers overlaid. Use this to see what elements are available and where they are positioned.",
		ToolLogName:          "human:screenshot_annotated",
		Strict:               false,
		RequiredCapabilities: []string{uctypes.AICapabilityImages},
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "8-character widget ID of the widget to screenshot",
				},
				"show_elements": map[string]any{
					"type":        "boolean",
					"description": "Whether to overlay element numbers (default: true)",
				},
			},
			"required":             []string{"widget_id"},
			"additionalProperties": false,
		},
		ToolCallDesc: func(input any, output any, toolUseData *uctypes.UIMessageDataToolUse) string {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return "error parsing input"
			}
			widgetId, _ := inputMap["widget_id"].(string)
			showElems := true
			if v, ok := inputMap["show_elements"].(bool); ok {
				showElems = v
			}
			msg := fmt.Sprintf("capturing annotated screenshot of widget %s", widgetId)
			if showElems {
				msg += " with element overlay"
			}
			return msg
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input format")
			}

			widgetId, ok := inputMap["widget_id"].(string)
			if !ok || widgetId == "" {
				return nil, fmt.Errorf("widget_id is required")
			}

			showElements := true
			if v, ok := inputMap["show_elements"].(bool); ok {
				showElements = v
			}

			ctx, cancelFn := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancelFn()

			fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, widgetId)
			if err != nil {
				return nil, err
			}

			rpcClient := wshclient.GetBareRpcClient()
			result, err := wshclient.WidgetScreenshotAnnotatedCommand(
				rpcClient,
				wshrpc.CommandWidgetScreenshotAnnotatedData{
					BlockId:      fullBlockId,
					ShowElements: showElements,
				},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to capture annotated screenshot: %w", err)
			}

			return result, nil
		},
	}
}

// =============================================================================
// EXTENDED WIDGET CONTROL TOOLS
// =============================================================================

type WidgetSnapshotInput struct {
	WidgetId string `json:"widget_id"`
}

type WidgetFindInput struct {
	WidgetId string `json:"widget_id"`
	Role     string `json:"role,omitempty"`
	Name     string `json:"name,omitempty"`
	Value    string `json:"value,omitempty"`
	Text     string `json:"text,omitempty"`
	MaxCount int    `json:"max_count,omitempty"`
}

type WidgetInspectInput struct {
	WidgetId   string `json:"widget_id"`
	ElementRef string `json:"element_ref"`
}

type WidgetElementAtInput struct {
	WidgetId string `json:"widget_id"`
	X        int    `json:"x"`
	Y        int    `json:"y"`
}

type WidgetClickInput struct {
	WidgetId   string `json:"widget_id"`
	ElementRef string `json:"element_ref,omitempty"`
	X          int    `json:"x,omitempty"`
	Y          int    `json:"y,omitempty"`
	Button     string `json:"button,omitempty"`
	ClickType  string `json:"click_type,omitempty"`
}

type WidgetHoverInput struct {
	WidgetId   string `json:"widget_id"`
	ElementRef string `json:"element_ref,omitempty"`
	X          int    `json:"x,omitempty"`
	Y          int    `json:"y,omitempty"`
}

type WidgetLongPressInput struct {
	WidgetId   string  `json:"widget_id"`
	ElementRef string  `json:"element_ref,omitempty"`
	X          int     `json:"x,omitempty"`
	Y          int     `json:"y,omitempty"`
	Duration   float64 `json:"duration,omitempty"`
}

type WidgetDragInput struct {
	WidgetId string `json:"widget_id"`
	StartRef string `json:"start_ref,omitempty"`
	StartX   int    `json:"start_x,omitempty"`
	StartY   int    `json:"start_y,omitempty"`
	EndRef   string `json:"end_ref,omitempty"`
	EndX     int    `json:"end_x,omitempty"`
	EndY     int    `json:"end_y,omitempty"`
	Button   string `json:"button,omitempty"`
}

type WidgetScrollToInput struct {
	WidgetId   string `json:"widget_id"`
	ElementRef string `json:"element_ref,omitempty"`
	X          int    `json:"x,omitempty"`
	Y          int    `json:"y,omitempty"`
}

type WidgetGetValueInput struct {
	WidgetId   string `json:"widget_id"`
	ElementRef string `json:"element_ref"`
}

type WidgetSetValueInput struct {
	WidgetId   string `json:"widget_id"`
	ElementRef string `json:"element_ref"`
	Value      string `json:"value"`
}

type WidgetClearInput struct {
	WidgetId   string `json:"widget_id"`
	ElementRef string `json:"element_ref"`
}

type WidgetSelectInput struct {
	WidgetId   string `json:"widget_id"`
	ElementRef string `json:"element_ref"`
	Option     string `json:"option"`
}

type WidgetToggleInput struct {
	WidgetId   string `json:"widget_id"`
	ElementRef string `json:"element_ref"`
}

type WidgetClipboardGetInput struct {
	WidgetId string `json:"widget_id"`
}

type WidgetClipboardSetInput struct {
	WidgetId string `json:"widget_id"`
	Text     string `json:"text"`
}

type WidgetWaitConditionInput struct {
	WidgetId   string `json:"widget_id"`
	ElementRef string `json:"element_ref,omitempty"`
	Condition  string `json:"condition"`
	Value      string `json:"value,omitempty"`
	TimeoutMs  int    `json:"timeout_ms,omitempty"`
}

func GetWidgetSnapshotToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "widget_snapshot",
		DisplayName: "Widget Snapshot",
		Description: "Get all interactive elements in a widget with auto-assigned refs (@e1, @e2, etc.). Call this FIRST to see what's on screen, then use refs in other tools. Elements include role, name, bounds, and state.",
		ToolLogName: "human:widget_snapshot",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "8-character widget ID of the widget to inspect",
				},
			},
			"required":             []string{"widget_id"},
			"additionalProperties": false,
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input format")
			}
			widgetId, ok := inputMap["widget_id"].(string)
			if !ok || widgetId == "" {
				return nil, fmt.Errorf("widget_id is required")
			}
			ctx, cancelFn := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancelFn()
			fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, widgetId)
			if err != nil {
				return nil, err
			}
			rpcClient := wshclient.GetBareRpcClient()
			result, err := wshclient.WidgetSnapshotCommand(
				rpcClient,
				wshrpc.CommandWidgetSnapshotData{BlockId: fullBlockId},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to snapshot widget: %w", err)
			}
			return result, nil
		},
	}
}

func GetWidgetFindToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "widget_find",
		DisplayName: "Widget Find",
		Description: "Search for elements by role, name, value, or text. Returns matching elements with refs.",
		ToolLogName: "human:widget_find",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "Widget ID",
				},
				"role": map[string]any{
					"type":        "string",
					"description": "Element role: button, textfield, checkbox, link, etc.",
				},
				"name": map[string]any{
					"type":        "string",
					"description": "Element accessible name (partial match)",
				},
				"value": map[string]any{
					"type":        "string",
					"description": "Element current value (partial match)",
				},
				"text": map[string]any{
					"type":        "string",
					"description": "Element text content (partial match)",
				},
				"max_count": map[string]any{
					"type":        "integer",
					"description": "Max results (default 10)",
				},
			},
			"required":             []string{"widget_id"},
			"additionalProperties": false,
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input format")
			}
			widgetId, ok := inputMap["widget_id"].(string)
			if !ok || widgetId == "" {
				return nil, fmt.Errorf("widget_id is required")
			}
			role, _ := inputMap["role"].(string)
			name, _ := inputMap["name"].(string)
			value, _ := inputMap["value"].(string)
			text, _ := inputMap["text"].(string)
			maxCount := 10
			if v, ok := inputMap["max_count"].(float64); ok {
				maxCount = int(v)
			}
			ctx, cancelFn := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancelFn()
			fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, widgetId)
			if err != nil {
				return nil, err
			}
			rpcClient := wshclient.GetBareRpcClient()
			result, err := wshclient.WidgetFindCommand(
				rpcClient,
				wshrpc.CommandWidgetFindData{
					BlockId:  fullBlockId,
					Role:     role,
					Name:     name,
					Value:    value,
					Text:     text,
					MaxCount: maxCount,
				},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to find elements: %w", err)
			}
			return result, nil
		},
	}
}

func GetWidgetInspectToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "widget_inspect",
		DisplayName: "Widget Inspect",
		Description: "Get complete metadata for a specific element by ref. Returns role, name, value, bounds, state, and available actions.",
		ToolLogName: "human:widget_inspect",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "Widget ID",
				},
				"element_ref": map[string]any{
					"type":        "string",
					"description": "Element ref from snapshot, e.g. @e3",
				},
			},
			"required":             []string{"widget_id", "element_ref"},
			"additionalProperties": false,
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input format")
			}
			widgetId, ok := inputMap["widget_id"].(string)
			if !ok || widgetId == "" {
				return nil, fmt.Errorf("widget_id is required")
			}
			elementRef, ok := inputMap["element_ref"].(string)
			if !ok || elementRef == "" {
				return nil, fmt.Errorf("element_ref is required")
			}
			ctx, cancelFn := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancelFn()
			fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, widgetId)
			if err != nil {
				return nil, err
			}
			rpcClient := wshclient.GetBareRpcClient()
			result, err := wshclient.WidgetInspectCommand(
				rpcClient,
				wshrpc.CommandWidgetInspectData{BlockId: fullBlockId, ElementRef: elementRef},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to inspect element: %w", err)
			}
			return result, nil
		},
	}
}

func GetWidgetElementAtToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "widget_element_at",
		DisplayName: "Widget Element At",
		Description: "Identify which element (if any) is at a specific screen coordinate. Useful for vision model pixel coordinates.",
		ToolLogName: "human:widget_element_at",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "Widget ID",
				},
				"x": map[string]any{
					"type":        "integer",
					"description": "X coordinate (relative to widget)",
				},
				"y": map[string]any{
					"type":        "integer",
					"description": "Y coordinate (relative to widget)",
				},
			},
			"required":             []string{"widget_id", "x", "y"},
			"additionalProperties": false,
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input format")
			}
			widgetId, ok := inputMap["widget_id"].(string)
			if !ok || widgetId == "" {
				return nil, fmt.Errorf("widget_id is required")
			}
			x, ok := inputMap["x"].(float64)
			if !ok {
				return nil, fmt.Errorf("x is required")
			}
			y, ok := inputMap["y"].(float64)
			if !ok {
				return nil, fmt.Errorf("y is required")
			}
			ctx, cancelFn := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancelFn()
			fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, widgetId)
			if err != nil {
				return nil, err
			}
			rpcClient := wshclient.GetBareRpcClient()
			result, err := wshclient.WidgetElementAtCommand(
				rpcClient,
				wshrpc.CommandWidgetElementAtData{BlockId: fullBlockId, X: int(x), Y: int(y)},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to get element at position: %w", err)
			}
			return result, nil
		},
	}
}

func GetWidgetClickToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "widget_click",
		DisplayName: "Widget Click",
		Description: "Click an element by ref (@e3) OR by coordinates. Prefer element refs for reliability.",
		ToolLogName: "human:widget_click",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "Widget ID",
				},
				"element_ref": map[string]any{
					"type":        "string",
					"description": "Element ref from snapshot, e.g. @e3",
				},
				"x": map[string]any{
					"type":        "integer",
					"description": "X coordinate (provide OR element_ref)",
				},
				"y": map[string]any{
					"type":        "integer",
					"description": "Y coordinate",
				},
				"button": map[string]any{
					"type":        "string",
					"description": "left, right, middle (default: left)",
					"enum":        []string{"left", "right", "middle"},
				},
				"click_type": map[string]any{
					"type":        "string",
					"description": "single, double, triple (default: single)",
					"enum":        []string{"single", "double", "triple"},
				},
			},
			"additionalProperties": false,
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input format")
			}
			widgetId, ok := inputMap["widget_id"].(string)
			if !ok || widgetId == "" {
				return nil, fmt.Errorf("widget_id is required")
			}
			elementRef := getStr(inputMap, "element_ref")
			x, hasX := getOptionalInt(inputMap, "x")
			y, hasY := getOptionalInt(inputMap, "y")
			if elementRef == "" && (!hasX || !hasY) {
				return nil, fmt.Errorf("either element_ref or x,y coordinates are required")
			}
			button := "left"
			if v, ok := inputMap["button"].(string); ok {
				button = v
			}
			clickType := "single"
			if v, ok := inputMap["click_type"].(string); ok {
				clickType = v
			}
			clickCount := 1
			if clickType == "double" {
				clickCount = 2
			}
			if clickType == "triple" {
				clickCount = 3
			}
			_ = clickCount
			ctx, cancelFn := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancelFn()
			fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, widgetId)
			if err != nil {
				return nil, err
			}
			rpcClient := wshclient.GetBareRpcClient()
			_, err = wshclient.WidgetClickCommand(
				rpcClient,
				wshrpc.CommandWidgetClickData{
					BlockId:    fullBlockId,
					ElementRef: elementRef,
					X:          x,
					Y:          y,
					Button:     button,
					ClickType:  clickType,
				},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to click: %w", err)
			}
			return &MouseActionOutput{WidgetId: widgetId, Success: true, Message: "clicked"}, nil
		},
	}
}

func GetWidgetHoverToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "widget_hover",
		DisplayName: "Widget Hover",
		Description: "Move cursor over an element or coordinate. Triggers hover effects.",
		ToolLogName: "human:widget_hover",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "Widget ID",
				},
				"element_ref": map[string]any{
					"type":        "string",
					"description": "Element ref",
				},
				"x": map[string]any{
					"type":        "integer",
					"description": "X coordinate",
				},
				"y": map[string]any{
					"type":        "integer",
					"description": "Y coordinate",
				},
			},
			"additionalProperties": false,
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input format")
			}
			widgetId, ok := inputMap["widget_id"].(string)
			if !ok || widgetId == "" {
				return nil, fmt.Errorf("widget_id is required")
			}
			elementRef := getStr(inputMap, "element_ref")
			x, hasX := getOptionalInt(inputMap, "x")
			y, hasY := getOptionalInt(inputMap, "y")
			if elementRef == "" && (!hasX || !hasY) {
				return nil, fmt.Errorf("either element_ref or x,y coordinates are required")
			}
			ctx, cancelFn := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancelFn()
			fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, widgetId)
			if err != nil {
				return nil, err
			}
			rpcClient := wshclient.GetBareRpcClient()
			_, err = wshclient.WidgetHoverCommand(
				rpcClient,
				wshrpc.CommandWidgetHoverData{BlockId: fullBlockId, ElementRef: elementRef, X: x, Y: y},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to hover: %w", err)
			}
			return &MouseActionOutput{WidgetId: widgetId, Success: true, Message: "hovered"}, nil
		},
	}
}

func GetWidgetLongPressToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "widget_long_press",
		DisplayName: "Widget Long Press",
		Description: "Press and hold an element. Triggers context menus and drag-initiation.",
		ToolLogName: "human:widget_long_press",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "Widget ID",
				},
				"element_ref": map[string]any{
					"type":        "string",
					"description": "Element ref",
				},
				"x": map[string]any{
					"type":        "integer",
					"description": "X coordinate",
				},
				"y": map[string]any{
					"type":        "integer",
					"description": "Y coordinate",
				},
				"duration": map[string]any{
					"type":        "number",
					"description": "Hold duration in seconds (default: 1.0)",
				},
			},
			"additionalProperties": false,
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input format")
			}
			widgetId, ok := inputMap["widget_id"].(string)
			if !ok || widgetId == "" {
				return nil, fmt.Errorf("widget_id is required")
			}
			elementRef := getStr(inputMap, "element_ref")
			x, hasX := getOptionalInt(inputMap, "x")
			y, hasY := getOptionalInt(inputMap, "y")
			if elementRef == "" && (!hasX || !hasY) {
				return nil, fmt.Errorf("either element_ref or x,y coordinates are required")
			}
			duration := 1.0
			if v, ok := inputMap["duration"].(float64); ok {
				duration = v
			}
			ctx, cancelFn := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancelFn()
			fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, widgetId)
			if err != nil {
				return nil, err
			}
			rpcClient := wshclient.GetBareRpcClient()
			_, err = wshclient.WidgetLongPressCommand(
				rpcClient,
				wshrpc.CommandWidgetLongPressData{BlockId: fullBlockId, ElementRef: elementRef, X: x, Y: y, Duration: duration},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to long press: %w", err)
			}
			return &MouseActionOutput{WidgetId: widgetId, Success: true, Message: "long pressed"}, nil
		},
	}
}

func GetWidgetDragToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "widget_drag",
		DisplayName: "Widget Drag",
		Description: "Drag from one element/position to another. Use for file moves, sliders, list reordering.",
		ToolLogName: "human:widget_drag",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "Widget ID",
				},
				"start_ref": map[string]any{
					"type":        "string",
					"description": "Start element ref",
				},
				"start_x": map[string]any{
					"type":        "integer",
					"description": "Start X coordinate",
				},
				"start_y": map[string]any{
					"type":        "integer",
					"description": "Start Y coordinate",
				},
				"end_ref": map[string]any{
					"type":        "string",
					"description": "End element ref",
				},
				"end_x": map[string]any{
					"type":        "integer",
					"description": "End X coordinate",
				},
				"end_y": map[string]any{
					"type":        "integer",
					"description": "End Y coordinate",
				},
				"button": map[string]any{
					"type":        "string",
					"description": "left, right, middle (default: left)",
				},
			},
			"additionalProperties": false,
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input format")
			}
			widgetId, ok := inputMap["widget_id"].(string)
			if !ok || widgetId == "" {
				return nil, fmt.Errorf("widget_id is required")
			}
			button := "left"
			if v, ok := inputMap["button"].(string); ok {
				button = v
			}
			startRef := getStr(inputMap, "start_ref")
			endRef := getStr(inputMap, "end_ref")
			startX, hasStartX := getOptionalInt(inputMap, "start_x")
			startY, hasStartY := getOptionalInt(inputMap, "start_y")
			endX, hasEndX := getOptionalInt(inputMap, "end_x")
			endY, hasEndY := getOptionalInt(inputMap, "end_y")
			if startRef == "" && (!hasStartX || !hasStartY) {
				return nil, fmt.Errorf("either start_ref or start_x,start_y coordinates are required")
			}
			if endRef == "" && (!hasEndX || !hasEndY) {
				return nil, fmt.Errorf("either end_ref or end_x,end_y coordinates are required")
			}
			ctx, cancelFn := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancelFn()
			fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, widgetId)
			if err != nil {
				return nil, err
			}
			rpcClient := wshclient.GetBareRpcClient()
			_, err = wshclient.WidgetDragCommand(
				rpcClient,
				wshrpc.CommandWidgetDragData{
					BlockId:  fullBlockId,
					StartRef: startRef,
					StartX:   startX,
					StartY:   startY,
					EndRef:   endRef,
					EndX:     endX,
					EndY:     endY,
					Button:   button,
				},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to drag: %w", err)
			}
			return &MouseActionOutput{WidgetId: widgetId, Success: true, Message: "dragged"}, nil
		},
	}
}

func GetWidgetScrollToToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "widget_scroll_to",
		DisplayName: "Widget Scroll To",
		Description: "Scroll an element into the visible viewport.",
		ToolLogName: "human:widget_scroll_to",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "Widget ID",
				},
				"element_ref": map[string]any{
					"type":        "string",
					"description": "Element ref to scroll into view",
				},
				"x": map[string]any{
					"type":        "integer",
					"description": "X coordinate",
				},
				"y": map[string]any{
					"type":        "integer",
					"description": "Y coordinate",
				},
			},
			"additionalProperties": false,
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input format")
			}
			widgetId, ok := inputMap["widget_id"].(string)
			if !ok || widgetId == "" {
				return nil, fmt.Errorf("widget_id is required")
			}
			elementRef := getStr(inputMap, "element_ref")
			ctx, cancelFn := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancelFn()
			fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, widgetId)
			if err != nil {
				return nil, err
			}
			rpcClient := wshclient.GetBareRpcClient()
			_, err = wshclient.WidgetScrollToCommand(
				rpcClient,
				wshrpc.CommandWidgetScrollToData{BlockId: fullBlockId, ElementRef: elementRef},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to scroll to element: %w", err)
			}
			return &MouseActionOutput{WidgetId: widgetId, Success: true, Message: "scrolled to element"}, nil
		},
	}
}

func GetWidgetGetValueToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "widget_get_value",
		DisplayName: "Widget Get Value",
		Description: "Read the current value of an input element.",
		ToolLogName: "human:widget_get_value",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "Widget ID",
				},
				"element_ref": map[string]any{
					"type":        "string",
					"description": "Element ref",
				},
			},
			"required":             []string{"widget_id", "element_ref"},
			"additionalProperties": false,
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input format")
			}
			widgetId, ok := inputMap["widget_id"].(string)
			if !ok || widgetId == "" {
				return nil, fmt.Errorf("widget_id is required")
			}
			elementRef, ok := inputMap["element_ref"].(string)
			if !ok || elementRef == "" {
				return nil, fmt.Errorf("element_ref is required")
			}
			ctx, cancelFn := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancelFn()
			fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, widgetId)
			if err != nil {
				return nil, err
			}
			rpcClient := wshclient.GetBareRpcClient()
			result, err := wshclient.WidgetGetValueCommand(
				rpcClient,
				wshrpc.CommandWidgetGetValueData{BlockId: fullBlockId, ElementRef: elementRef},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to get value: %w", err)
			}
			return result, nil
		},
	}
}

func GetWidgetSetValueToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "widget_set_value",
		DisplayName: "Widget Set Value",
		Description: "Set the value of an input element directly (without typing).",
		ToolLogName: "human:widget_set_value",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "Widget ID",
				},
				"element_ref": map[string]any{
					"type":        "string",
					"description": "Element ref",
				},
				"value": map[string]any{
					"type":        "string",
					"description": "Value to set",
				},
			},
			"required":             []string{"widget_id", "element_ref", "value"},
			"additionalProperties": false,
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input format")
			}
			widgetId, ok := inputMap["widget_id"].(string)
			if !ok || widgetId == "" {
				return nil, fmt.Errorf("widget_id is required")
			}
			elementRef, ok := inputMap["element_ref"].(string)
			if !ok || elementRef == "" {
				return nil, fmt.Errorf("element_ref is required")
			}
			value, ok := inputMap["value"].(string)
			if !ok {
				return nil, fmt.Errorf("value is required")
			}
			ctx, cancelFn := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancelFn()
			fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, widgetId)
			if err != nil {
				return nil, err
			}
			rpcClient := wshclient.GetBareRpcClient()
			_, err = wshclient.WidgetSetValueCommand(
				rpcClient,
				wshrpc.CommandWidgetSetValueData{BlockId: fullBlockId, ElementRef: elementRef, Value: value},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to set value: %w", err)
			}
			return &MouseActionOutput{WidgetId: widgetId, Success: true, Message: "value set"}, nil
		},
	}
}

func GetWidgetClearToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "widget_clear",
		DisplayName: "Widget Clear",
		Description: "Clear the value of an input element.",
		ToolLogName: "human:widget_clear",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "Widget ID",
				},
				"element_ref": map[string]any{
					"type":        "string",
					"description": "Element ref",
				},
			},
			"required":             []string{"widget_id", "element_ref"},
			"additionalProperties": false,
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input format")
			}
			widgetId, ok := inputMap["widget_id"].(string)
			if !ok || widgetId == "" {
				return nil, fmt.Errorf("widget_id is required")
			}
			elementRef, ok := inputMap["element_ref"].(string)
			if !ok || elementRef == "" {
				return nil, fmt.Errorf("element_ref is required")
			}
			ctx, cancelFn := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancelFn()
			fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, widgetId)
			if err != nil {
				return nil, err
			}
			rpcClient := wshclient.GetBareRpcClient()
			_, err = wshclient.WidgetClearCommand(
				rpcClient,
				wshrpc.CommandWidgetClearData{BlockId: fullBlockId, ElementRef: elementRef},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to clear element: %w", err)
			}
			return &MouseActionOutput{WidgetId: widgetId, Success: true, Message: "cleared"}, nil
		},
	}
}

func GetWidgetSelectToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "widget_select",
		DisplayName: "Widget Select",
		Description: "Select an option in a dropdown or list by text value.",
		ToolLogName: "human:widget_select",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "Widget ID",
				},
				"element_ref": map[string]any{
					"type":        "string",
					"description": "Element ref",
				},
				"option": map[string]any{
					"type":        "string",
					"description": "Text of option to select",
				},
			},
			"required":             []string{"widget_id", "element_ref", "option"},
			"additionalProperties": false,
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input format")
			}
			widgetId, ok := inputMap["widget_id"].(string)
			if !ok || widgetId == "" {
				return nil, fmt.Errorf("widget_id is required")
			}
			elementRef, ok := inputMap["element_ref"].(string)
			if !ok || elementRef == "" {
				return nil, fmt.Errorf("element_ref is required")
			}
			option, ok := inputMap["option"].(string)
			if !ok || option == "" {
				return nil, fmt.Errorf("option is required")
			}
			ctx, cancelFn := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancelFn()
			fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, widgetId)
			if err != nil {
				return nil, err
			}
			rpcClient := wshclient.GetBareRpcClient()
			_, err = wshclient.WidgetSelectCommand(
				rpcClient,
				wshrpc.CommandWidgetSelectData{BlockId: fullBlockId, ElementRef: elementRef, Option: option},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to select option: %w", err)
			}
			return &MouseActionOutput{WidgetId: widgetId, Success: true, Message: fmt.Sprintf("selected %s", option)}, nil
		},
	}
}

func GetWidgetToggleToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "widget_toggle",
		DisplayName: "Widget Toggle",
		Description: "Toggle a checkbox, switch, or similar toggle element.",
		ToolLogName: "human:widget_toggle",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "Widget ID",
				},
				"element_ref": map[string]any{
					"type":        "string",
					"description": "Element ref",
				},
			},
			"required":             []string{"widget_id", "element_ref"},
			"additionalProperties": false,
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input format")
			}
			widgetId, ok := inputMap["widget_id"].(string)
			if !ok || widgetId == "" {
				return nil, fmt.Errorf("widget_id is required")
			}
			elementRef, ok := inputMap["element_ref"].(string)
			if !ok || elementRef == "" {
				return nil, fmt.Errorf("element_ref is required")
			}
			ctx, cancelFn := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancelFn()
			fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, widgetId)
			if err != nil {
				return nil, err
			}
			rpcClient := wshclient.GetBareRpcClient()
			_, err = wshclient.WidgetToggleCommand(
				rpcClient,
				wshrpc.CommandWidgetToggleData{BlockId: fullBlockId, ElementRef: elementRef},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to toggle: %w", err)
			}
			return &MouseActionOutput{WidgetId: widgetId, Success: true, Message: "toggled"}, nil
		},
	}
}

func GetWidgetClipboardGetToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "widget_clipboard_get",
		DisplayName: "Widget Clipboard Get",
		Description: "Read text from the system clipboard.",
		ToolLogName: "human:widget_clipboard_get",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "Widget ID",
				},
			},
			"required":             []string{"widget_id"},
			"additionalProperties": false,
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input format")
			}
			widgetId, ok := inputMap["widget_id"].(string)
			if !ok || widgetId == "" {
				return nil, fmt.Errorf("widget_id is required")
			}
			ctx, cancelFn := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancelFn()
			fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, widgetId)
			if err != nil {
				return nil, err
			}
			rpcClient := wshclient.GetBareRpcClient()
			result, err := wshclient.WidgetClipboardGetCommand(
				rpcClient,
				wshrpc.CommandWidgetClipboardGetData{BlockId: fullBlockId},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to get clipboard: %w", err)
			}
			return result, nil
		},
	}
}

func GetWidgetClipboardSetToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "widget_clipboard_set",
		DisplayName: "Widget Clipboard Set",
		Description: "Write text to the system clipboard.",
		ToolLogName: "human:widget_clipboard_set",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "Widget ID",
				},
				"text": map[string]any{
					"type":        "string",
					"description": "Text to copy to clipboard",
				},
			},
			"required":             []string{"widget_id", "text"},
			"additionalProperties": false,
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input format")
			}
			widgetId, ok := inputMap["widget_id"].(string)
			if !ok || widgetId == "" {
				return nil, fmt.Errorf("widget_id is required")
			}
			text, ok := inputMap["text"].(string)
			if !ok {
				return nil, fmt.Errorf("text is required")
			}
			ctx, cancelFn := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancelFn()
			fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, widgetId)
			if err != nil {
				return nil, err
			}
			rpcClient := wshclient.GetBareRpcClient()
			_, err = wshclient.WidgetClipboardSetCommand(
				rpcClient,
				wshrpc.CommandWidgetClipboardSetData{BlockId: fullBlockId, Text: text},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to set clipboard: %w", err)
			}
			return &MouseActionOutput{WidgetId: widgetId, Success: true, Message: fmt.Sprintf("copied %d chars", len(text))}, nil
		},
	}
}

func GetWidgetWaitConditionToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "widget_wait_condition",
		DisplayName: "Widget Wait",
		Description: "Wait for an element condition, text to appear, or URL to change.",
		ToolLogName: "human:widget_wait",
		Strict:      false,
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "Widget ID",
				},
				"element_ref": map[string]any{
					"type":        "string",
					"description": "Element ref to wait for",
				},
				"condition": map[string]any{
					"type":        "string",
					"description": "visible, hidden, focused, enabled, disabled, text_contains, url_contains",
					"enum":        []string{"visible", "hidden", "focused", "enabled", "disabled", "text_contains", "url_contains"},
				},
				"value": map[string]any{
					"type":        "string",
					"description": "Expected value for text_contains or url_contains",
				},
				"timeout_ms": map[string]any{
					"type":        "integer",
					"description": "Max wait in ms (default: 5000)",
				},
			},
			"required":             []string{"widget_id", "condition"},
			"additionalProperties": false,
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input format")
			}
			widgetId, ok := inputMap["widget_id"].(string)
			if !ok || widgetId == "" {
				return nil, fmt.Errorf("widget_id is required")
			}
			condition, ok := inputMap["condition"].(string)
			if !ok || condition == "" {
				return nil, fmt.Errorf("condition is required")
			}
			elementRef := getStr(inputMap, "element_ref")
			value := getStr(inputMap, "value")
			timeoutMs := 5000
			if v, ok := inputMap["timeout_ms"].(float64); ok {
				timeoutMs = int(v)
			}
			ctx, cancelFn := context.WithTimeout(context.Background(), time.Duration(timeoutMs+1000)*time.Millisecond)
			defer cancelFn()
			fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, widgetId)
			if err != nil {
				return nil, err
			}
			rpcClient := wshclient.GetBareRpcClient()
			result, err := wshclient.WidgetWaitConditionCommand(
				rpcClient,
				wshrpc.CommandWidgetWaitConditionData{
					BlockId:    fullBlockId,
					ElementRef: elementRef,
					Condition:  condition,
					Value:      value,
					TimeoutMs:  timeoutMs,
				},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to wait: %w", err)
			}
			return result, nil
		},
	}
}

func getStr(input map[string]any, key string) string {
	if v, ok := input[key].(string); ok {
		return v
	}
	return ""
}

func getInt(input map[string]any, key string) int {
	if v, ok := input[key].(float64); ok {
		return int(v)
	}
	return 0
}

func getOptionalInt(input map[string]any, key string) (int, bool) {
	if v, ok := input[key].(float64); ok {
		return int(v), true
	}
	return 0, false
}
