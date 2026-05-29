// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package toolregistry

type ToolSource string

const (
	ToolSourceBuiltin ToolSource = "builtin"
	ToolSourceMCP     ToolSource = "mcp"
	ToolSourcePlugin  ToolSource = "plugin"
	ToolSourceRuntime ToolSource = "runtime"
)

type ToolRisk string

const (
	ToolRiskRead      ToolRisk = "read"
	ToolRiskWrite     ToolRisk = "write"
	ToolRiskSensitive ToolRisk = "sensitive"
	ToolRiskDangerous ToolRisk = "dangerous"
)

type ToolPack string

const (
	ToolPackCore    ToolPack = "core"
	ToolPackWidget  ToolPack = "widget"
	ToolPackBrowser ToolPack = "browser"
	ToolPackDesktop ToolPack = "desktop"
	ToolPackCode    ToolPack = "code"
)

type Capability struct {
	ID          string
	Name        string
	Description string
	Source      ToolSource
	Risk        ToolRisk
	Packs       []ToolPack
}
