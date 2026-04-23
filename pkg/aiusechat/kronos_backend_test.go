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
	if entries[1]["name"] != "zeta_tool" {
		t.Fatalf("expected second tool to be zeta_tool, got %#v", entries[1]["name"])
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
