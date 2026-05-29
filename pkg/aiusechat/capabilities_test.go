package aiusechat

import (
	"strings"
	"testing"

	"github.com/wavetermdev/waveterm/pkg/aiusechat/toolregistry"
	"github.com/wavetermdev/waveterm/pkg/aiusechat/uctypes"
)

func TestBuildToolRegistryClassifiesCapabilities(t *testing.T) {
	registry := BuildToolRegistry([]uctypes.ToolDefinition{
		{Name: "widget_click", DisplayName: "Widget Click", Description: "click"},
		{Name: "web_navigate", DisplayName: "Web Navigate", Description: "navigate"},
		{Name: "term_run_command", DisplayName: "Run Command", Description: "run"},
	})

	widget, ok := registry.Lookup("widget_click")
	if !ok {
		t.Fatal("expected widget_click capability")
	}
	if widget.Risk != toolregistry.ToolRiskWrite {
		t.Fatalf("expected write risk, got %q", widget.Risk)
	}

	scorecard := registry.Scorecard()
	if scorecard.ByPack[toolregistry.ToolPackWidget] != 1 {
		t.Fatalf("expected 1 widget capability, got %d", scorecard.ByPack[toolregistry.ToolPackWidget])
	}
	if scorecard.ByRisk[toolregistry.ToolRiskDangerous] != 1 {
		t.Fatalf("expected 1 dangerous capability, got %d", scorecard.ByRisk[toolregistry.ToolRiskDangerous])
	}
}

func TestGenerateToolCapabilityPrompt(t *testing.T) {
	prompt := GenerateToolCapabilityPrompt([]uctypes.ToolDefinition{
		{Name: "widget_click", Description: "click"},
		{Name: "web_navigate", Description: "navigate"},
	})
	if !strings.Contains(prompt, `total=2`) || !strings.Contains(prompt, `widget=1`) || !strings.Contains(prompt, `browser=1`) {
		t.Fatalf("unexpected capability prompt: %s", prompt)
	}
}
