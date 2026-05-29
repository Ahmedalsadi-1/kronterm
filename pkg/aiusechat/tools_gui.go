// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package aiusechat

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/wavetermdev/waveterm/pkg/aiusechat/uctypes"
	"github.com/wavetermdev/waveterm/pkg/waveappstore"
	"github.com/wavetermdev/waveterm/pkg/waveobj"
	"github.com/wavetermdev/waveterm/pkg/wshrpc"
	"github.com/wavetermdev/waveterm/pkg/wshrpc/wshclient"
)

type GuiCreateAppToolInput struct {
	AppName     string `json:"app_name"`
	Title       string `json:"title,omitempty"`
	Description string `json:"description,omitempty"`
	InitialCode string `json:"initial_code,omitempty"`
}

func parseGuiCreateAppInput(input any) (*GuiCreateAppToolInput, error) {
	result := &GuiCreateAppToolInput{}

	if input == nil {
		return nil, fmt.Errorf("app_name is required")
	}

	inputBytes, err := json.Marshal(input)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal input: %w", err)
	}

	if err := json.Unmarshal(inputBytes, result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal input: %w", err)
	}

	if result.AppName == "" {
		return nil, fmt.Errorf("app_name is required")
	}

	return result, nil
}

func GetGuiCreateAppToolDefinition(tabId string) uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "gui_create_app",
		DisplayName: "Create GUI App",
		Description: "Create a new Tsunami GUI application and open it in a new block. This allows you to build custom dashboards or tools using Go and VDOM.",
		ToolLogName: "gui:create_app",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"app_name": map[string]any{
					"type":        "string",
					"description": "Slug-style name for the app (e.g., 'my-dashboard')",
				},
				"title": map[string]any{
					"type":        "string",
					"description": "Human-readable title for the app",
				},
				"description": map[string]any{
					"type":        "string",
					"description": "Short description of what the app does",
				},
				"initial_code": map[string]any{
					"type":        "string",
					"description": "Initial Go code for app.go. Should define 'App' and 'AppMeta'.",
				},
			},
			"required":             []string{"app_name"},
			"additionalProperties": false,
		},
		ToolCallDesc: func(input any, output any, toolUseData *uctypes.UIMessageDataToolUse) string {
			parsed, err := parseGuiCreateAppInput(input)
			if err != nil {
				return fmt.Sprintf("error parsing input: %v", err)
			}
			return fmt.Sprintf("creating GUI app: %s", parsed.AppName)
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			parsed, err := parseGuiCreateAppInput(input)
			if err != nil {
				return nil, err
			}

			appId := waveappstore.MakeAppId(waveappstore.AppNSDraft, parsed.AppName)
			appDir, err := waveappstore.GetAppDir(appId)
			if err != nil {
				return nil, fmt.Errorf("failed to get app directory: %w", err)
			}

			// Create manifest
			manifest := &wshrpc.AppManifest{
				AppMeta: wshrpc.AppMeta{
					Title:     parsed.Title,
					ShortDesc: parsed.Description,
				},
			}
			if manifest.AppMeta.Title == "" {
				manifest.AppMeta.Title = parsed.AppName
			}
			manifestBytes, _ := json.MarshalIndent(manifest, "", "  ")
			err = waveappstore.WriteAppFile(appId, waveappstore.ManifestFileName, manifestBytes)
			if err != nil {
				return nil, fmt.Errorf("failed to write manifest: %w", err)
			}

			// Write initial app.go
			initialCode := parsed.InitialCode
			if initialCode == "" {
				initialCode = `package main

import (
	"github.com/wavetermdev/waveterm/tsunami/app"
	"github.com/wavetermdev/waveterm/tsunami/vdom"
)

var AppMeta = app.AppMeta{
	Title:     "` + manifest.AppMeta.Title + `",
	ShortDesc: "` + manifest.AppMeta.ShortDesc + `",
}

var App = app.DefineComponent("App", func(_ any) any {
	return vdom.H("div", map[string]any{"className": "p-4"},
		vdom.H("h1", map[string]any{"className": "text-2xl font-bold"}, "Hello Wave!"),
		vdom.H("p", nil, "This is your new generated GUI app."),
	)
})
`
			}
			err = waveappstore.WriteAppFile(appId, "app.go", []byte(initialCode))
			if err != nil {
				return nil, fmt.Errorf("failed to write app.go: %w", err)
			}

			// Create the block in the UI
			_, cancelFn := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancelFn()

			rpcClient := wshclient.GetBareRpcClient()
			blockDef := &waveobj.BlockDef{
				Meta: waveobj.MetaMapType{
					"view":  "tsunami",
					"appId": appId,
				},
			}

			_, err = wshclient.CreateBlockCommand(rpcClient, wshrpc.CommandCreateBlockData{
				TabId:    tabId,
				BlockDef: blockDef,
				Focused:  true,
			}, nil)

			if err != nil {
				return nil, fmt.Errorf("app created but failed to open block: %w", err)
			}

			return map[string]any{
				"success": true,
				"app_id":  appId,
				"app_dir": appDir,
				"message": "App created and block opened successfully",
			}, nil
		},
	}
}
