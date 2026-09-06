// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package aiusechat

import (
	"fmt"
	"strings"

	"github.com/wavetermdev/waveterm/pkg/aiusechat/toolregistry"
	"github.com/wavetermdev/waveterm/pkg/aiusechat/uctypes"
	"github.com/wavetermdev/waveterm/pkg/mcp"
)

func BuildToolRegistry(tools []uctypes.ToolDefinition) *toolregistry.Registry {
	registry := toolregistry.MakeRegistry()
	for _, tool := range tools {
		_ = registry.Register(classifyToolCapability(tool))
	}
	return registry
}

func BuildUnifiedToolRegistry(tools []uctypes.ToolDefinition, manager *mcp.MCPClientManager) *toolregistry.Registry {
	registry := BuildToolRegistry(tools)
	if manager == nil {
		return registry
	}
	for _, serverName := range manager.ListServers() {
		server, ok := manager.GetServer(serverName)
		if !ok {
			continue
		}
		for _, tool := range server.Tools {
			_ = registry.Register(classifyMCPToolCapability(server, tool))
		}
	}
	return registry
}

func classifyToolCapability(tool uctypes.ToolDefinition) toolregistry.Capability {
	return toolregistry.Capability{
		ID:           tool.Name,
		Name:         firstCapabilityValue(tool.DisplayName, tool.Name),
		Description:  tool.Desc(),
		Source:       classifyToolSource(tool.Source),
		Risk:         classifyToolRisk(tool.Name),
		Packs:        classifyToolPacks(tool.Name),
		Availability: toolregistry.ToolAvailabilityReady,
		Verification: classifyToolVerification(tool.Name),
	}
}

func classifyToolSource(source string) toolregistry.ToolSource {
	if strings.HasPrefix(source, "mcp:") {
		return toolregistry.ToolSourceMCP
	}
	if strings.HasPrefix(source, "plugin:") {
		return toolregistry.ToolSourcePlugin
	}
	if strings.HasPrefix(source, "runtime:") {
		return toolregistry.ToolSourceRuntime
	}
	return toolregistry.ToolSourceBuiltin
}

func classifyMCPToolCapability(server *mcp.MCPServer, tool mcp.MCPTool) toolregistry.Capability {
	return toolregistry.Capability{
		ID:           fmt.Sprintf("mcp:%s:%s", server.Name, tool.Name),
		Name:         firstCapabilityValue(tool.Name, "MCP tool"),
		Description:  tool.Description,
		Source:       toolregistry.ToolSourceMCP,
		Risk:         toolregistry.ToolRiskSensitive,
		Packs:        classifyToolPacks(tool.Name),
		Availability: mcpToolAvailability(server.Status),
		Verification: toolregistry.ToolVerificationResult,
		ConnectorID:  server.Name,
	}
}

func mcpToolAvailability(status mcp.ServerStatus) toolregistry.ToolAvailability {
	switch status {
	case mcp.ServerStatusConnected:
		return toolregistry.ToolAvailabilityReady
	case mcp.ServerStatusDisabled:
		return toolregistry.ToolAvailabilityDisabled
	case mcp.ServerStatusError:
		return toolregistry.ToolAvailabilityDegraded
	default:
		return toolregistry.ToolAvailabilityOffline
	}
}

func classifyToolVerification(toolName string) toolregistry.ToolVerification {
	if strings.HasPrefix(toolName, "widget_") ||
		strings.HasPrefix(toolName, "mouse_") ||
		strings.HasPrefix(toolName, "keyboard_") ||
		strings.HasPrefix(toolName, "desktop_") ||
		strings.HasPrefix(toolName, "web_") {
		return toolregistry.ToolVerificationSurface
	}
	return toolregistry.ToolVerificationResult
}

func classifyToolRisk(toolName string) toolregistry.ToolRisk {
	switch {
	case strings.HasPrefix(toolName, "write_"),
		strings.HasPrefix(toolName, "edit_"),
		strings.HasPrefix(toolName, "delete_"),
		toolName == "term_run_command":
		return toolregistry.ToolRiskDangerous
	case strings.HasPrefix(toolName, "widget_"),
		strings.HasPrefix(toolName, "mouse_"),
		strings.HasPrefix(toolName, "keyboard_"),
		strings.HasPrefix(toolName, "desktop_"),
		toolName == "web_navigate":
		return toolregistry.ToolRiskWrite
	default:
		return toolregistry.ToolRiskRead
	}
}

func classifyToolPacks(toolName string) []toolregistry.ToolPack {
	switch {
	case strings.HasPrefix(toolName, "widget_"),
		strings.HasPrefix(toolName, "mouse_"),
		strings.HasPrefix(toolName, "keyboard_"),
		toolName == "capture_screenshot",
		toolName == "screenshot_annotated",
		toolName == "wait_for_element":
		return []toolregistry.ToolPack{toolregistry.ToolPackWidget}
	case strings.HasPrefix(toolName, "desktop_"),
		strings.HasPrefix(toolName, "sandbox_"):
		return []toolregistry.ToolPack{toolregistry.ToolPackDesktop}
	case strings.HasPrefix(toolName, "web_"):
		return []toolregistry.ToolPack{toolregistry.ToolPackBrowser}
	case strings.HasPrefix(toolName, "term_"),
		strings.Contains(toolName, "file"),
		strings.Contains(toolName, "codebase"):
		return []toolregistry.ToolPack{toolregistry.ToolPackCode}
	default:
		return []toolregistry.ToolPack{toolregistry.ToolPackCore}
	}
}

func firstCapabilityValue(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
