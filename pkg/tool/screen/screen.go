package screen

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const DefaultScreenpipeURL = "http://localhost:3030"

type ScreenSearchResult struct {
	Content    string    `json:"content"`
	AppName    string    `json:"app_name"`
	WindowName string    `json:"window_name"`
	Timestamp  time.Time `json:"timestamp"`
}

type ScreenTool interface {
	Name() string
	Description() string
	Execute(ctx context.Context, args map[string]interface{}) (string, error)
}

type ScreenSearchTool struct {
	BaseURL string
}

func NewScreenSearchTool(baseURL string) *ScreenSearchTool {
	if baseURL == "" {
		baseURL = DefaultScreenpipeURL
	}
	return &ScreenSearchTool{BaseURL: baseURL}
}

func (t *ScreenSearchTool) Name() string { return "screen_search" }
func (t *ScreenSearchTool) Description() string {
	return "Search through screen content using OCR (requires Screenpipe)"
}

func (t *ScreenSearchTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	query, ok := args["query"].(string)
	if !ok || query == "" {
		return "", fmt.Errorf("missing required parameter: query")
	}

	limit := 10
	if l, ok := args["limit"].(float64); ok {
		limit = int(l)
	}

	url := fmt.Sprintf("%s/api/v0/search?q=%s&limit=%d", t.BaseURL, query, limit)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %v", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("screenpipe not available: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("screenpipe returned status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %v", err)
	}

	var results []ScreenSearchResult
	if err := json.Unmarshal(body, &results); err != nil {
		return string(body), nil
	}

	if len(results) == 0 {
		return "No matching screen content found", nil
	}

	var output string
	for i, r := range results {
		if i >= limit {
			break
		}
		output += fmt.Sprintf("[%s] %s: %s\n", r.AppName, r.WindowName, r.Content)
	}
	return output, nil
}

type ScreenRecallTool struct {
	BaseURL string
}

func NewScreenRecallTool(baseURL string) *ScreenRecallTool {
	if baseURL == "" {
		baseURL = DefaultScreenpipeURL
	}
	return &ScreenRecallTool{BaseURL: baseURL}
}

func (t *ScreenRecallTool) Name() string { return "screen_recall" }
func (t *ScreenRecallTool) Description() string {
	return "Recall specific screen moments by time or app"
}

func (t *ScreenRecallTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	appName, _ := args["app_name"].(string)
	minutes := 5
	if m, ok := args["minutes"].(float64); ok {
		minutes = int(m)
	}

	url := fmt.Sprintf("%s/api/v0/recent?minutes=%d", t.BaseURL, minutes)
	if appName != "" {
		url += fmt.Sprintf("&app_name=%s", appName)
	}

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %v", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("screenpipe not available: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("screenpipe returned status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %v", err)
	}

	return string(body), nil
}

type ScreenContextTool struct {
	BaseURL string
}

func NewScreenContextTool(baseURL string) *ScreenContextTool {
	if baseURL == "" {
		baseURL = DefaultScreenpipeURL
	}
	return &ScreenContextTool{BaseURL: baseURL}
}

func (t *ScreenContextTool) Name() string { return "screen_context" }
func (t *ScreenContextTool) Description() string {
	return "Get AI-relevant context from recent screen activity"
}

func (t *ScreenContextTool) Execute(ctx context.Context, args map[string]interface{}) (string, error) {
	prompt, _ := args["prompt"].(string)
	if prompt == "" {
		prompt = "What is the user currently working on?"
	}

	url := fmt.Sprintf("%s/api/v0/context?prompt=%s", t.BaseURL, prompt)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return "", fmt.Errorf("failed to create request: %v", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("screenpipe not available: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("screenpipe returned status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %v", err)
	}

	return string(body), nil
}

func GetAllTools(baseURL string) []ScreenTool {
	return []ScreenTool{
		NewScreenSearchTool(baseURL),
		NewScreenRecallTool(baseURL),
		NewScreenContextTool(baseURL),
	}
}

func ExecuteTool(name string, baseURL string, ctx context.Context, args map[string]interface{}) (string, error) {
	for _, tool := range GetAllTools(baseURL) {
		if tool.Name() == name {
			return tool.Execute(ctx, args)
		}
	}
	return "", fmt.Errorf("tool not found: %s", name)
}

var _ = json.Marshal
