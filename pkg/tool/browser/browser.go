package browser

import (
	"context"
	"fmt"
)

type BrowserTool interface {
	Name() string
	Description() string
	Execute(ctx context.Context, args map[string]interface{}) (string, error)
}

type ToolDefinition struct {
	Name        string                   `json:"name"`
	Description string                   `json:"description"`
	InputSchema map[string]interface{}   `json:"input_schema"`
}

type NavigateTool struct{}

func (t *NavigateTool) Name() string        { return "browser_navigate" }
func (t *NavigateTool) Description() string { return "Navigate to a URL in a web widget" }
func (t *NavigateTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	blockId, ok := args["block_id"].(string)
	if !ok {
		return "", fmt.Errorf("missing required parameter: block_id")
	}
	if err := ValidateBlockId(ctx, blockId); err != nil {
		return "", err
	}
	url, _ := args["url"].(string)
	if url == "" {
		return "", fmt.Errorf("missing required parameter: url")
	}
	return fmt.Sprintf("Navigated to %s in block %s", url, blockId), nil
}

type ClickTool struct{}

func (t *ClickTool) Name() string        { return "browser_click" }
func (t *ClickTool) Description() string { return "Click an element in a web widget" }
func (t *ClickTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	blockId, ok := args["block_id"].(string)
	if !ok {
		return "", fmt.Errorf("missing required parameter: block_id")
	}
	if err := ValidateBlockId(ctx, blockId); err != nil {
		return "", err
	}
	return fmt.Sprintf("Clicked element in block %s", blockId), nil
}

type TypeTool struct{}

func (t *TypeTool) Name() string        { return "browser_type" }
func (t *TypeTool) Description() string { return "Type text into an element in a web widget" }
func (t *TypeTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	blockId, ok := args["block_id"].(string)
	if !ok {
		return "", fmt.Errorf("missing required parameter: block_id")
	}
	if err := ValidateBlockId(ctx, blockId); err != nil {
		return "", err
	}
	return fmt.Sprintf("Typed text in block %s", blockId), nil
}

type ScreenshotTool struct{}

func (t *ScreenshotTool) Name() string        { return "browser_screenshot" }
func (t *ScreenshotTool) Description() string { return "Take a screenshot of a web widget" }
func (t *ScreenshotTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	blockId, ok := args["block_id"].(string)
	if !ok {
		return "", fmt.Errorf("missing required parameter: block_id")
	}
	if err := ValidateBlockId(ctx, blockId); err != nil {
		return "", err
	}
	return fmt.Sprintf("Screenshot captured from block %s", blockId), nil
}

type ScrollTool struct{}

func (t *ScrollTool) Name() string        { return "browser_scroll" }
func (t *ScrollTool) Description() string { return "Scroll a web widget" }
func (t *ScrollTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	blockId, ok := args["block_id"].(string)
	if !ok {
		return "", fmt.Errorf("missing required parameter: block_id")
	}
	if err := ValidateBlockId(ctx, blockId); err != nil {
		return "", err
	}
	return fmt.Sprintf("Scrolled in block %s", blockId), nil
}

type FillFormTool struct{}

func (t *FillFormTool) Name() string        { return "browser_fill_form" }
func (t *FillFormTool) Description() string { return "Fill multiple form fields in a web widget" }
func (t *FillFormTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	blockId, ok := args["block_id"].(string)
	if !ok {
		return "", fmt.Errorf("missing required parameter: block_id")
	}
	if err := ValidateBlockId(ctx, blockId); err != nil {
		return "", err
	}
	return fmt.Sprintf("Filled form fields in block %s", blockId), nil
}

func GetAllTools() []BrowserTool {
	return []BrowserTool{
		&NavigateTool{},
		&ClickTool{},
		&TypeTool{},
		&ScreenshotTool{},
		&ScrollTool{},
		&FillFormTool{},
	}
}

func GetToolDefinitions() []ToolDefinition {
	defs := []ToolDefinition{
		{
			Name:        "browser_navigate",
			Description: "Navigate to a URL in a web widget",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"block_id": map[string]interface{}{"type": "string", "description": "The block ID of the web widget"},
					"url":      map[string]interface{}{"type": "string", "description": "The URL to navigate to"},
				},
				"required": []string{"block_id", "url"},
			},
		},
		{
			Name:        "browser_click",
			Description: "Click an element in a web widget",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"block_id": map[string]interface{}{"type": "string", "description": "The block ID of the web widget"},
					"ref":      map[string]interface{}{"type": "string", "description": "Element reference (e.g. @e3)"},
				},
				"required": []string{"block_id"},
			},
		},
		{
			Name:        "browser_type",
			Description: "Type text into an element in a web widget",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"block_id": map[string]interface{}{"type": "string", "description": "The block ID of the web widget"},
					"text":     map[string]interface{}{"type": "string", "description": "Text to type"},
				},
				"required": []string{"block_id", "text"},
			},
		},
		{
			Name:        "browser_screenshot",
			Description: "Take a screenshot of a web widget",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"block_id": map[string]interface{}{"type": "string", "description": "The block ID of the web widget"},
				},
				"required": []string{"block_id"},
			},
		},
		{
			Name:        "browser_scroll",
			Description: "Scroll a web widget",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"block_id": map[string]interface{}{"type": "string", "description": "The block ID of the web widget"},
					"direction": map[string]interface{}{
						"type": "string",
						"enum": []string{"up", "down", "left", "right"},
					},
				},
				"required": []string{"block_id"},
			},
		},
		{
			Name:        "browser_fill_form",
			Description: "Fill multiple form fields in a web widget",
			InputSchema: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"block_id": map[string]interface{}{"type": "string", "description": "The block ID of the web widget"},
					"fields":   map[string]interface{}{"type": "object", "description": "Form field key-value pairs"},
				},
				"required": []string{"block_id", "fields"},
			},
		},
	}
	return defs
}

func ValidateBlockId(ctx context.Context, blockId string) error {
	if blockId == "" {
		return fmt.Errorf("block_id is required")
	}
	return nil
}

var _ = context.Background
