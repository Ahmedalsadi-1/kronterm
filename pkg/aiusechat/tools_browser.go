// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package aiusechat

import (
	"context"
	"encoding/json"
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

type BrowserWidgetInput struct {
	WidgetId string `json:"widget_id"`
}

func parseBrowserWidgetInput(input any) (*BrowserWidgetInput, error) {
	result := &BrowserWidgetInput{}
	if input == nil {
		return nil, fmt.Errorf("input is required")
	}
	inputBytes, err := json.Marshal(input)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal input: %w", err)
	}
	if err := json.Unmarshal(inputBytes, result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal input: %w", err)
	}
	if result.WidgetId == "" {
		return nil, fmt.Errorf("widget_id is required")
	}
	return result, nil
}

func resolveBrowserBlock(ctx context.Context, tabId string, widgetId string) (string, error) {
	fullBlockId, err := wcore.ResolveBlockIdFromPrefix(ctx, tabId, widgetId)
	if err != nil {
		return "", err
	}
	block, err := wstore.DBGet[*waveobj.Block](ctx, fullBlockId)
	if err != nil {
		return "", fmt.Errorf("block not found: %w", err)
	}
	if block.Meta == nil || block.Meta["view"].(string) != "web" {
		return "", fmt.Errorf("block %s is not a web browser widget (view=%v)", fullBlockId, block.Meta["view"])
	}
	return fullBlockId, nil
}

// GetBrowserGetUrlToolDefinition returns the current URL of a browser widget.
func GetBrowserGetUrlToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "browser_get_url",
		DisplayName: "Get Browser URL",
		Description: "Get the current URL of a web browser widget.",
		ToolLogName: "browser:get_url",
		Strict:      true,
		InputSchema: map[string]any{
			"type":     "object",
			"required": []string{"widget_id"},
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "8-character widget ID of the web browser widget",
				},
			},
			"additionalProperties": false,
		},
		ToolCallDesc: func(input any, output any, toolUseData *uctypes.UIMessageDataToolUse) string {
			parsed, err := parseBrowserWidgetInput(input)
			if err != nil {
				return "error parsing input"
			}
			return fmt.Sprintf("getting URL from browser widget %s", parsed.WidgetId)
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			parsed, err := parseBrowserWidgetInput(input)
			if err != nil {
				return nil, err
			}
			ctx, cancelFn := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancelFn()
			fullBlockId, err := resolveBrowserBlock(ctx, tabId, parsed.WidgetId)
			if err != nil {
				return nil, err
			}
			block, err := wstore.DBGet[*waveobj.Block](ctx, fullBlockId)
			if err != nil {
				return nil, err
			}
			url := ""
			if block.Meta != nil {
				if u, ok := block.Meta["url"].(string); ok {
					url = u
				}
			}
			return map[string]any{
				"widget_id": parsed.WidgetId,
				"url":       url,
				"title":     block.Meta["title"],
			}, nil
		},
	}
}

// GetBrowserReloadToolDefinition reloads the current page in a browser widget.
func GetBrowserReloadToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "browser_reload",
		DisplayName: "Reload Browser",
		Description: "Reload the current page in a web browser widget.",
		ToolLogName: "browser:reload",
		Strict:      true,
		InputSchema: map[string]any{
			"type":     "object",
			"required": []string{"widget_id"},
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "8-character widget ID of the web browser widget",
				},
			},
			"additionalProperties": false,
		},
		ToolCallDesc: func(input any, output any, toolUseData *uctypes.UIMessageDataToolUse) string {
			parsed, err := parseBrowserWidgetInput(input)
			if err != nil {
				return "error parsing input"
			}
			return fmt.Sprintf("reloading browser widget %s", parsed.WidgetId)
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			parsed, err := parseBrowserWidgetInput(input)
			if err != nil {
				return nil, err
			}
			ctx, cancelFn := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancelFn()
			fullBlockId, err := resolveBrowserBlock(ctx, tabId, parsed.WidgetId)
			if err != nil {
				return nil, err
			}
			block, err := wstore.DBGet[*waveobj.Block](ctx, fullBlockId)
			if err != nil {
				return nil, err
			}
			currentUrl := ""
			if block.Meta != nil {
				if u, ok := block.Meta["url"].(string); ok {
					currentUrl = u
				}
			}
			if currentUrl == "" {
				return nil, fmt.Errorf("browser widget has no URL to reload")
			}
			blockORef := waveobj.MakeORef(waveobj.OType_Block, fullBlockId)
			err = wstore.UpdateObjectMeta(ctx, blockORef, map[string]any{"url": currentUrl}, false)
			if err != nil {
				return nil, fmt.Errorf("failed to reload browser: %w", err)
			}
			wcore.SendWaveObjUpdate(blockORef)
			return map[string]any{
				"widget_id": parsed.WidgetId,
				"url":       currentUrl,
				"success":   true,
			}, nil
		},
	}
}

// GetBrowserGetStateToolDefinition returns the full state of a browser widget.
func GetBrowserGetStateToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "browser_get_state",
		DisplayName: "Get Browser State",
		Description: "Get the current state of a web browser widget including URL, loading status, zoom factor, and connection info.",
		ToolLogName: "browser:get_state",
		Strict:      true,
		InputSchema: map[string]any{
			"type":     "object",
			"required": []string{"widget_id"},
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "8-character widget ID of the web browser widget",
				},
			},
			"additionalProperties": false,
		},
		ToolCallDesc: func(input any, output any, toolUseData *uctypes.UIMessageDataToolUse) string {
			parsed, err := parseBrowserWidgetInput(input)
			if err != nil {
				return "error parsing input"
			}
			return fmt.Sprintf("getting state from browser widget %s", parsed.WidgetId)
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			parsed, err := parseBrowserWidgetInput(input)
			if err != nil {
				return nil, err
			}
			ctx, cancelFn := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancelFn()
			fullBlockId, err := resolveBrowserBlock(ctx, tabId, parsed.WidgetId)
			if err != nil {
				return nil, err
			}
			block, err := wstore.DBGet[*waveobj.Block](ctx, fullBlockId)
			if err != nil {
				return nil, err
			}
			state := map[string]any{
				"widget_id": parsed.WidgetId,
			}
			if block.Meta != nil {
				if u, ok := block.Meta["url"].(string); ok {
					state["url"] = u
				}
				if t, ok := block.Meta["title"].(string); ok {
					state["title"] = t
				}
				if z, ok := block.Meta["web:zoom"].(float64); ok {
					state["zoom"] = z
				}
				if ua, ok := block.Meta["web:useragenttype"].(string); ok {
					state["user_agent_type"] = ua
				}
				if conn, ok := block.Meta["connection"].(string); ok {
					state["connection"] = conn
				}
			}
			// Get widget state via RPC for dynamic info
			rpcClient := wshclient.GetBareRpcClient()
			widgetState, err := wshclient.WidgetGetStateCommand(
				rpcClient,
				wshrpc.CommandWidgetGetStateData{
					BlockId: fullBlockId,
				},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err == nil && widgetState != nil {
				state["focused"] = widgetState.Focused
				state["dimensions"] = map[string]any{
					"width":  widgetState.Width,
					"height": widgetState.Height,
				}
			}
			return state, nil
		},
	}
}

// GetBrowserClickToolDefinition clicks at a specific position within a browser widget.
func GetBrowserClickToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "browser_click",
		DisplayName: "Click in Browser",
		Description: "Click at a specific position or on a specific element within a web browser widget. Uses element_ref if known from browser_get_elements, otherwise provide x,y coordinates relative to the widget.",
		ToolLogName: "browser:click",
		Strict:      true,
		InputSchema: map[string]any{
			"type":     "object",
			"required": []string{"widget_id"},
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "8-character widget ID of the web browser widget",
				},
				"x": map[string]any{
					"type":        "integer",
					"description": "X coordinate within the browser widget (optional if element_ref provided)",
				},
				"y": map[string]any{
					"type":        "integer",
					"description": "Y coordinate within the browser widget (optional if element_ref provided)",
				},
				"element_ref": map[string]any{
					"type":        "string",
					"description": "Element reference from browser_get_elements (optional if x,y provided)",
				},
				"button": map[string]any{
					"type":        "string",
					"enum":        []string{"left", "right", "middle"},
					"description": "Mouse button (default: left)",
				},
				"click_count": map[string]any{
					"type":        "integer",
					"description": "Number of clicks: 1, 2, 3 (default: 1)",
				},
			},
			"additionalProperties": false,
		},
		ToolCallDesc: func(input any, output any, toolUseData *uctypes.UIMessageDataToolUse) string {
			parsed, err := parseBrowserWidgetInput(input)
			if err != nil {
				return "error parsing input"
			}
			msg := fmt.Sprintf("clicking in browser widget %s", parsed.WidgetId)
			return msg
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			parsed, err := parseBrowserWidgetInput(input)
			if err != nil {
				return nil, err
			}
			ctx, cancelFn := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancelFn()
			fullBlockId, err := resolveBrowserBlock(ctx, tabId, parsed.WidgetId)
			if err != nil {
				return nil, err
			}
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input")
			}
			var x, y int
			hasCoords := false
			if ref, ok := inputMap["element_ref"].(string); ok && ref != "" {
				elementsResult, err := getWidgetElements(ctx, tabId, &WidgetGetElementsInput{WidgetId: parsed.WidgetId})
				if err != nil {
					return nil, err
				}
				for _, elem := range elementsResult.Elements {
					if elem.Ref == ref && elem.Visible {
						x = elem.X + elem.Width/2
						y = elem.Y + elem.Height/2
						hasCoords = true
						break
					}
				}
				if !hasCoords {
					return nil, fmt.Errorf("element %s not found or not visible", ref)
				}
			} else if xv, ok := inputMap["x"].(float64); ok {
				if yv, ok := inputMap["y"].(float64); ok {
					x = int(xv)
					y = int(yv)
					hasCoords = true
				}
			}
			if !hasCoords {
				return nil, fmt.Errorf("either element_ref or x,y coordinates required")
			}
			button := "left"
			if b, ok := inputMap["button"].(string); ok {
				button = b
			}
			clickCount := 1
			if cc, ok := inputMap["click_count"].(float64); ok {
				clickCount = int(cc)
			}
			rpcClient := wshclient.GetBareRpcClient()
			_, err = wshclient.WidgetMouseClickCommand(
				rpcClient,
				wshrpc.CommandWidgetMouseClickData{
					BlockId:    fullBlockId,
					X:          x,
					Y:          y,
					Button:     button,
					ClickCount: clickCount,
				},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to click in browser: %w", err)
			}
			return map[string]any{
				"widget_id":   parsed.WidgetId,
				"x":           x,
				"y":           y,
				"button":      button,
				"click_count": clickCount,
				"success":     true,
			}, nil
		},
	}
}

// GetBrowserTypeTextToolDefinition types text into a browser widget.
func GetBrowserTypeTextToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "browser_type_text",
		DisplayName: "Type in Browser",
		Description: "Type text into the currently focused element within a web browser widget. Use this for filling in form fields, search boxes, or any text input.",
		ToolLogName: "browser:type_text",
		Strict:      true,
		InputSchema: map[string]any{
			"type":     "object",
			"required": []string{"widget_id", "text"},
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "8-character widget ID of the web browser widget",
				},
				"text": map[string]any{
					"type":        "string",
					"description": "Text to type into the browser widget",
				},
			},
			"additionalProperties": false,
		},
		ToolCallDesc: func(input any, output any, toolUseData *uctypes.UIMessageDataToolUse) string {
			parsed, err := parseBrowserWidgetInput(input)
			if err != nil {
				return "error parsing input"
			}
			inputMap := input.(map[string]any)
			text, _ := inputMap["text"].(string)
			if len(text) > 30 {
				text = text[:27] + "..."
			}
			return fmt.Sprintf("typing %q into browser widget %s", text, parsed.WidgetId)
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			parsed, err := parseBrowserWidgetInput(input)
			if err != nil {
				return nil, err
			}
			ctx, cancelFn := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancelFn()
			fullBlockId, err := resolveBrowserBlock(ctx, tabId, parsed.WidgetId)
			if err != nil {
				return nil, err
			}
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input")
			}
			text, _ := inputMap["text"].(string)
			rpcClient := wshclient.GetBareRpcClient()
			_, err = wshclient.WidgetKeyboardTypeCommand(
				rpcClient,
				wshrpc.CommandWidgetKeyboardTypeData{
					BlockId: fullBlockId,
					Text:    text,
				},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to type in browser: %w", err)
			}
			return map[string]any{
				"widget_id": parsed.WidgetId,
				"text":      text,
				"success":   true,
			}, nil
		},
	}
}

// GetBrowserScrollToolDefinition scrolls the browser page in a specified direction.
func GetBrowserScrollToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "browser_scroll",
		DisplayName: "Scroll Browser",
		Description: "Scroll the page in a web browser widget up or down.",
		ToolLogName: "browser:scroll",
		Strict:      true,
		InputSchema: map[string]any{
			"type":     "object",
			"required": []string{"widget_id", "direction"},
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "8-character widget ID of the web browser widget",
				},
				"direction": map[string]any{
					"type":        "string",
					"enum":        []string{"up", "down"},
					"description": "Direction to scroll (up or down)",
				},
				"amount": map[string]any{
					"type":        "integer",
					"description": "Number of scroll steps (default: 3)",
				},
			},
			"additionalProperties": false,
		},
		ToolCallDesc: func(input any, output any, toolUseData *uctypes.UIMessageDataToolUse) string {
			parsed, err := parseBrowserWidgetInput(input)
			if err != nil {
				return "error parsing input"
			}
			return fmt.Sprintf("scrolling %s in browser widget %s", input.(map[string]any)["direction"], parsed.WidgetId)
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			parsed, err := parseBrowserWidgetInput(input)
			if err != nil {
				return nil, err
			}
			ctx, cancelFn := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancelFn()
			fullBlockId, err := resolveBrowserBlock(ctx, tabId, parsed.WidgetId)
			if err != nil {
				return nil, err
			}
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input")
			}
			direction, _ := inputMap["direction"].(string)
			amount := 3
			if a, ok := inputMap["amount"].(float64); ok {
				amount = int(a)
			}
			scrollAmount := amount
			if direction == "up" {
				scrollAmount = -scrollAmount
			}
			rpcClient := wshclient.GetBareRpcClient()
			_, err = wshclient.WidgetMouseScrollCommand(
				rpcClient,
				wshrpc.CommandWidgetMouseScrollData{
					BlockId: fullBlockId,
					Amount:  scrollAmount,
				},
				&wshrpc.RpcOpts{Route: wshutil.MakeTabRouteId(tabId)},
			)
			if err != nil {
				return nil, fmt.Errorf("failed to scroll browser: %w", err)
			}
			return map[string]any{
				"widget_id": parsed.WidgetId,
				"direction": direction,
				"amount":    amount,
				"success":   true,
			}, nil
		},
	}
}

// GetBrowserWaitToolDefinition waits for page to load or waits a specified duration.
func GetBrowserWaitToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "browser_wait",
		DisplayName: "Wait in Browser",
		Description: "Wait for a specified duration or for the browser page to finish loading. Use this between browser actions that need time to complete (e.g., after clicking a link, before typing into a form).",
		ToolLogName: "browser:wait",
		Strict:      true,
		InputSchema: map[string]any{
			"type":     "object",
			"required": []string{"widget_id"},
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "8-character widget ID of the web browser widget",
				},
				"duration_ms": map[string]any{
					"type":        "integer",
					"description": "Duration to wait in milliseconds (default: 2000). Set to 0 to wait for page load instead.",
				},
			},
			"additionalProperties": false,
		},
		ToolCallDesc: func(input any, output any, toolUseData *uctypes.UIMessageDataToolUse) string {
			parsed, err := parseBrowserWidgetInput(input)
			if err != nil {
				return "error parsing input"
			}
			return fmt.Sprintf("waiting in browser widget %s", parsed.WidgetId)
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			parsed, err := parseBrowserWidgetInput(input)
			if err != nil {
				return nil, err
			}
			inputMap, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("invalid input")
			}
			durationMs := 2000
			if d, ok := inputMap["duration_ms"].(float64); ok {
				durationMs = int(d)
			}
			time.Sleep(time.Duration(durationMs) * time.Millisecond)
			return map[string]any{
				"widget_id":  parsed.WidgetId,
				"waited_ms":  durationMs,
				"success":    true,
			}, nil
		},
	}
}

// GetBrowserGetElementsToolDefinition gets interactive elements from a browser widget.
func GetBrowserGetElementsToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "browser_get_elements",
		DisplayName: "Get Browser Elements",
		Description: "Get all interactive elements visible in a web browser widget. Returns elements with their positions, roles, and reference IDs that can be used with browser_click.",
		ToolLogName: "browser:get_elements",
		Strict:      true,
		InputSchema: map[string]any{
			"type":     "object",
			"required": []string{"widget_id"},
			"properties": map[string]any{
				"widget_id": map[string]any{
					"type":        "string",
					"description": "8-character widget ID of the web browser widget",
				},
			},
			"additionalProperties": false,
		},
		ToolCallDesc: func(input any, output any, toolUseData *uctypes.UIMessageDataToolUse) string {
			parsed, err := parseBrowserWidgetInput(input)
			if err != nil {
				return "error parsing input"
			}
			return fmt.Sprintf("getting elements from browser widget %s", parsed.WidgetId)
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			parsed, err := parseBrowserWidgetInput(input)
			if err != nil {
				return nil, err
			}
			ctx, cancelFn := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancelFn()
			_, err = resolveBrowserBlock(ctx, tabId, parsed.WidgetId)
			if err != nil {
				return nil, err
			}
			return getWidgetElements(ctx, tabId, &WidgetGetElementsInput{WidgetId: parsed.WidgetId})
		},
	}
}
