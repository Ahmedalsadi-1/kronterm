// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package aiusechat

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/wavetermdev/waveterm/pkg/aiusechat/uctypes"
	"github.com/wavetermdev/waveterm/pkg/mcp"
)

var invalidMCPToolNameChars = regexp.MustCompile(`[^a-zA-Z0-9_-]+`)

func GetMCPToolDefinitions() []uctypes.ToolDefinition {
	manager := mcp.GetMCPManager()
	var definitions []uctypes.ToolDefinition
	nameCounts := make(map[string]int)
	for _, serverName := range manager.ListServers() {
		server, ok := manager.GetServer(serverName)
		if !ok || server.Status != mcp.ServerStatusConnected {
			continue
		}
		for _, tool := range server.Tools {
			definition := makeMCPToolDefinition(manager, serverName, tool)
			nameCounts[definition.Name]++
			if nameCounts[definition.Name] > 1 {
				definition.Name = fmt.Sprintf("%s_%d", definition.Name, nameCounts[definition.Name])
			}
			definitions = append(definitions, definition)
		}
	}
	return definitions
}

func makeMCPToolDefinition(manager *mcp.MCPClientManager, serverName string, tool mcp.MCPTool) uctypes.ToolDefinition {
	inputSchema := tool.InputSchema
	if inputSchema == nil {
		inputSchema = map[string]any{"type": "object"}
	}
	return uctypes.ToolDefinition{
		Name:        fmt.Sprintf("mcp_%s_%s", sanitizeMCPToolName(serverName), sanitizeMCPToolName(tool.Name)),
		DisplayName: fmt.Sprintf("%s / %s", serverName, tool.Name),
		Description: tool.Description,
		Source:      "mcp:" + serverName,
		InputSchema: inputSchema,
		ToolApproval: func(input any) string {
			return uctypes.ApprovalNeedsApproval
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			args, ok := input.(map[string]any)
			if !ok {
				return nil, fmt.Errorf("MCP tool input must be an object")
			}
			ctx, cancelFn := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancelFn()
			return manager.CallTool(ctx, serverName, tool.Name, args)
		},
	}
}

func sanitizeMCPToolName(name string) string {
	name = invalidMCPToolNameChars.ReplaceAllString(name, "_")
	name = strings.Trim(name, "_")
	if name == "" {
		return "tool"
	}
	return name
}
