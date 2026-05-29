package browser

import (
	"context"
	"fmt"
)

type BrowserTool interface {
	Name() string
	Description() string
}

type NavigateTool struct{}

func (t *NavigateTool) Name() string        { return "browser_navigate" }
func (t *NavigateTool) Description() string { return "Navigate to a URL in a web widget" }

type ClickTool struct{}

func (t *ClickTool) Name() string        { return "browser_click" }
func (t *ClickTool) Description() string { return "Click an element in a web widget" }

type TypeTool struct{}

func (t *TypeTool) Name() string        { return "browser_type" }
func (t *TypeTool) Description() string { return "Type text into an element in a web widget" }

type ScreenshotTool struct{}

func (t *ScreenshotTool) Name() string        { return "browser_screenshot" }
func (t *ScreenshotTool) Description() string { return "Take a screenshot of a web widget" }

type ScrollTool struct{}

func (t *ScrollTool) Name() string        { return "browser_scroll" }
func (t *ScrollTool) Description() string { return "Scroll a web widget" }

type FillFormTool struct{}

func (t *FillFormTool) Name() string        { return "browser_fill_form" }
func (t *FillFormTool) Description() string { return "Fill multiple form fields in a web widget" }

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

func ValidateBlockId(ctx context.Context, blockId string) error {
	if blockId == "" {
		return fmt.Errorf("block_id is required")
	}
	return nil
}

var _ = context.Background
