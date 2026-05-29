// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package aiusechat

import (
	"encoding/json"
	"testing"

	"github.com/wavetermdev/waveterm/pkg/aiusechat/uctypes"
)

func TestBuildWaveToolManifestSortsAndIncludesMetadata(t *testing.T) {
	chatOpts := uctypes.WaveChatOpts{
		Tools: []uctypes.ToolDefinition{
			{
				Name:          "zeta_tool",
				Description:   "Zeta tool",
				Source:        "wave",
				ActsOnWidgets: false,
				InputSchema:   map[string]any{"type": "object"},
			},
			{
				Name:          "alpha_tool",
				Description:   "Alpha tool",
				Source:        "wave",
				ActsOnWidgets: true,
				InputSchema: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"widget_id": map[string]any{"type": "string"},
					},
				},
			},
		},
	}

	manifest := buildWaveToolManifest(chatOpts)
	if manifest == "" {
		t.Fatalf("expected manifest to be present")
	}

	var entries []map[string]any
	if err := json.Unmarshal([]byte(manifest), &entries); err != nil {
		t.Fatalf("expected valid JSON manifest, got error: %v", err)
	}
	if len(entries) != 2 {
		t.Fatalf("expected 2 manifest entries, got %d", len(entries))
	}
	if entries[0]["name"] != "alpha_tool" {
		t.Fatalf("expected first tool to be alpha_tool, got %#v", entries[0]["name"])
	}
	if entries[0]["acts_on_widgets"] != true {
		t.Fatalf("expected alpha_tool to act on widgets, got %#v", entries[0]["acts_on_widgets"])
	}
	if entries[0]["family"] != "wave-host" {
		t.Fatalf("expected default family to be wave-host, got %#v", entries[0]["family"])
	}
	if entries[1]["name"] != "zeta_tool" {
		t.Fatalf("expected second tool to be zeta_tool, got %#v", entries[1]["name"])
	}
}

func TestWaveToolCapabilityFamily(t *testing.T) {
	cases := map[string]string{
		"widget_click":        "widget-control",
		"mouse_click":         "direct-widget-input",
		"keyboard_type":       "direct-widget-input",
		"term_run_command":    "terminal-control",
		"web_navigate":        "browser-control",
		"sandbox_start":       "sandbox-control",
		"desktop_screenshot":  "sandbox-control",
		"codebase_search":     "codebase",
		"read_text_file":      "filesystem",
		"unknown_host_action": "wave-host",
	}
	for toolName, expected := range cases {
		if actual := waveToolCapabilityFamily(toolName); actual != expected {
			t.Fatalf("expected %s to map to %s, got %s", toolName, expected, actual)
		}
	}
}

func TestWidgetControlToolsActOnWidgets(t *testing.T) {
	widgetTools := []string{
		"widget_snapshot",
		"widget_inspect",
		"widget_click",
		"widget_hover",
		"widget_set_value",
		"widget_select",
		"widget_toggle",
		"mouse_click",
		"keyboard_type",
	}
	for _, toolName := range widgetTools {
		if !toolActsOnWidgets(toolName) {
			t.Fatalf("expected %s to be marked as acting on widgets", toolName)
		}
	}
}

func TestKronosToolUseDataFromPartIncludesSourceMetadata(t *testing.T) {
	part := KronosChatPart{
		CallID:        "call-123",
		Tool:          "widget_click",
		ToolSource:    "wave",
		ActsOnWidgets: true,
		State: &kronosToolState{
			Status: "completed",
			Title:  "clicking widget button",
		},
	}

	toolData := kronosToolUseDataFromPart(part)
	if toolData.ToolCallId != "call-123" {
		t.Fatalf("expected tool call id to be preserved, got %q", toolData.ToolCallId)
	}
	if toolData.ToolSource != "wave" {
		t.Fatalf("expected tool source %q, got %q", "wave", toolData.ToolSource)
	}
	if !toolData.ActsOnWidgets {
		t.Fatalf("expected tool to be marked as acting on widgets")
	}
	if toolData.Status != uctypes.ToolUseStatusCompleted {
		t.Fatalf("expected completed status, got %q", toolData.Status)
	}
	if toolData.ToolDesc != "clicking widget button" {
		t.Fatalf("expected tool description from state title, got %q", toolData.ToolDesc)
	}
}

func TestKronosPermissionToolUseDataRequiresApproval(t *testing.T) {
	toolData := makeKronosPermissionToolUseData(kronosPermissionAskedEvent{
		ID:       "perm-123",
		Patterns: []string{"shell:git status", "file:/tmp/example"},
	})

	if toolData.ToolCallId != "kronos-permission:perm-123" {
		t.Fatalf("expected permission tool call id, got %q", toolData.ToolCallId)
	}
	if toolData.ToolName != kronosPermissionToolName {
		t.Fatalf("expected tool name %q, got %q", kronosPermissionToolName, toolData.ToolName)
	}
	if toolData.Approval != uctypes.ApprovalNeedsApproval {
		t.Fatalf("expected approval %q, got %q", uctypes.ApprovalNeedsApproval, toolData.Approval)
	}
	if toolData.ToolSource != "kronos" {
		t.Fatalf("expected Kronos tool source, got %q", toolData.ToolSource)
	}
}

func TestKronosPermissionResponseForMode(t *testing.T) {
	cases := map[string]string{
		"always": "always",
		"once":   "once",
		"ask":    "reject",
		"":       "reject",
	}
	for mode, expected := range cases {
		if actual := kronosPermissionResponseForMode(mode); actual != expected {
			t.Fatalf("expected mode %q to map to %q, got %q", mode, expected, actual)
		}
	}
}

func TestDetectKronosNativeWaveConnector(t *testing.T) {
	snapshot := detectKronosNativeWaveConnector([]KronosToolCapabilitySnapshot{
		{ID: "read_file", Connector: "builtin"},
		{ID: "widget_click", Connector: "waveterm-native"},
	}, nil)
	if !snapshot.Available {
		t.Fatalf("expected native Wave connector to be detected")
	}
	if snapshot.Status != "native-ready" {
		t.Fatalf("expected native-ready status, got %q", snapshot.Status)
	}
	exactWaveSnapshot := detectKronosNativeWaveConnector([]KronosToolCapabilitySnapshot{
		{ID: "widget_snapshot", Connector: "wave"},
	}, nil)
	if !exactWaveSnapshot.Available {
		t.Fatalf("expected exact wave connector to be detected")
	}

	fallback := detectKronosNativeWaveConnector([]KronosToolCapabilitySnapshot{
		{ID: "read_file", Connector: "builtin"},
	}, nil)
	if fallback.Available {
		t.Fatalf("expected non-Wave capabilities to stay on XML bridge")
	}
	if fallback.Status != "xml-bridge" {
		t.Fatalf("expected xml-bridge status, got %q", fallback.Status)
	}
}
