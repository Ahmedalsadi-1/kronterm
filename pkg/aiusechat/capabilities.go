// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package aiusechat

import (
	"strings"

	"github.com/wavetermdev/waveterm/pkg/aiusechat/toolregistry"
	"github.com/wavetermdev/waveterm/pkg/aiusechat/uctypes"
)

func BuildToolRegistry(tools []uctypes.ToolDefinition) *toolregistry.Registry {
	registry := toolregistry.MakeRegistry()
	for _, tool := range tools {
		_ = registry.Register(classifyToolCapability(tool))
	}
	return registry
}

func classifyToolCapability(tool uctypes.ToolDefinition) toolregistry.Capability {
	return toolregistry.Capability{
		ID:          tool.Name,
		Name:        firstCapabilityValue(tool.DisplayName, tool.Name),
		Description: tool.Desc(),
		Source:      toolregistry.ToolSourceBuiltin,
		Risk:        classifyToolRisk(tool.Name),
		Packs:       classifyToolPacks(tool.Name),
	}
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
