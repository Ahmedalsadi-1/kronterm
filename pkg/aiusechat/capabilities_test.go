package aiusechat

import (
	"strings"
	"testing"

	"github.com/wavetermdev/waveterm/pkg/aiusechat/toolregistry"
	"github.com/wavetermdev/waveterm/pkg/aiusechat/uctypes"
	"github.com/wavetermdev/waveterm/pkg/mcp"
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
	if widget.Availability != toolregistry.ToolAvailabilityReady {
		t.Fatalf("expected ready availability, got %q", widget.Availability)
	}
	if widget.Verification != toolregistry.ToolVerificationSurface {
		t.Fatalf("expected surface verification, got %q", widget.Verification)
	}

	scorecard := registry.Scorecard()
	if scorecard.ByPack[toolregistry.ToolPackWidget] != 1 {
		t.Fatalf("expected 1 widget capability, got %d", scorecard.ByPack[toolregistry.ToolPackWidget])
	}
	if scorecard.ByRisk[toolregistry.ToolRiskDangerous] != 1 {
		t.Fatalf("expected 1 dangerous capability, got %d", scorecard.ByRisk[toolregistry.ToolRiskDangerous])
	}
}

func TestBuildUnifiedToolRegistryIncludesMCPHealth(t *testing.T) {
	manager := &mcp.MCPClientManager{Servers: map[string]*mcp.MCPServer{
		"demo": {
			Name:   "demo",
			Status: mcp.ServerStatusConnected,
			Tools:  []mcp.MCPTool{{Name: "search_docs", Description: "Search documentation"}},
		},
	}}
	registry := BuildUnifiedToolRegistry([]uctypes.ToolDefinition{{Name: "widget_click", Description: "click"}}, manager)

	capability, ok := registry.Lookup("mcp:demo:search_docs")
	if !ok {
		t.Fatal("expected MCP capability")
	}
	if capability.Source != toolregistry.ToolSourceMCP || capability.ConnectorID != "demo" {
		t.Fatalf("unexpected MCP capability source: %#v", capability)
	}
	if capability.Availability != toolregistry.ToolAvailabilityReady {
		t.Fatalf("expected ready MCP capability, got %q", capability.Availability)
	}
	if capability.Risk != toolregistry.ToolRiskSensitive {
		t.Fatalf("expected conservative MCP risk, got %q", capability.Risk)
	}
}

func TestMakeMCPToolDefinitionNamespacesAndRequiresApproval(t *testing.T) {
	definition := makeMCPToolDefinition(nil, "docs server", mcp.MCPTool{
		Name:        "search/docs",
		Description: "Search documentation",
		InputSchema: map[string]any{"type": "object"},
	})

	if definition.Name != "mcp_docs_server_search_docs" {
		t.Fatalf("unexpected MCP tool name: %q", definition.Name)
	}
	if definition.Source != "mcp:docs server" {
		t.Fatalf("unexpected MCP tool source: %q", definition.Source)
	}
	if definition.ToolApproval(nil) != uctypes.ApprovalNeedsApproval {
		t.Fatal("expected MCP tool approval gate")
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
