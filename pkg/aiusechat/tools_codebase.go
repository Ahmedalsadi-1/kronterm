// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package aiusechat

import (
	"context"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
	"time"

	"github.com/wavetermdev/waveterm/pkg/aiusechat/uctypes"
)

type CodebaseSearchToolInput struct {
	Pattern     string `json:"pattern"`
	IncludeGlob string `json:"include_glob,omitempty"`
}

func parseCodebaseSearchInput(input any) (*CodebaseSearchToolInput, error) {
	result := &CodebaseSearchToolInput{}

	if input == nil {
		return nil, fmt.Errorf("pattern is required")
	}

	inputBytes, err := json.Marshal(input)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal input: %w", err)
	}

	if err := json.Unmarshal(inputBytes, result); err != nil {
		return nil, fmt.Errorf("failed to unmarshal input: %w", err)
	}

	if result.Pattern == "" {
		return nil, fmt.Errorf("pattern is required")
	}

	return result, nil
}

func GetCodebaseSearchToolDefinition() uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "codebase_search",
		DisplayName: "Search Codebase",
		Description: "Search for a text pattern in the entire current project codebase. Uses 'grep' internally. Returns matching file paths and snippets.",
		ToolLogName: "codebase:search",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"pattern": map[string]any{
					"type":        "string",
					"description": "The regex pattern to search for",
				},
				"include_glob": map[string]any{
					"type":        "string",
					"description": "Optional glob pattern to restrict search (e.g., '*.ts')",
				},
			},
			"required":             []string{"pattern"},
			"additionalProperties": false,
		},
		ToolCallDesc: func(input any, output any, toolUseData *uctypes.UIMessageDataToolUse) string {
			parsed, err := parseCodebaseSearchInput(input)
			if err != nil {
				return fmt.Sprintf("error parsing input: %v", err)
			}
			return fmt.Sprintf("searching codebase for: %s", parsed.Pattern)
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			parsed, err := parseCodebaseSearchInput(input)
			if err != nil {
				return nil, err
			}

			ctx, cancelFn := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancelFn()

			args := []string{"-r", "-n", "--max-count=10", "--exclude-dir=.git", "--exclude-dir=node_modules"}
			if parsed.IncludeGlob != "" {
				args = append(args, "--include="+parsed.IncludeGlob)
			}
			args = append(args, parsed.Pattern, ".")

			cmd := exec.CommandContext(ctx, "grep", args...)
			output, err := cmd.CombinedOutput()
			// grep returns exit code 1 if no matches found, we should handle that
			if err != nil {
				if cmd.ProcessState.ExitCode() == 1 {
					return "No matches found.", nil
				}
				return nil, fmt.Errorf("grep failed: %w (output: %s)", err, string(output))
			}

			return string(output), nil
		},
	}
}

func GetCodebaseGetStructureToolDefinition() uctypes.ToolDefinition {
	return uctypes.ToolDefinition{
		Name:        "codebase_get_structure",
		DisplayName: "Get Codebase Structure",
		Description: "Get a high-level overview of the project's file structure. Useful for understanding where files are located.",
		ToolLogName: "codebase:structure",
		InputSchema: map[string]any{
			"type":                 "object",
			"properties":           map[string]any{},
			"additionalProperties": false,
		},
		ToolCallDesc: func(input any, output any, toolUseData *uctypes.UIMessageDataToolUse) string {
			return "getting codebase structure"
		},
		ToolAnyCallback: func(input any, toolUseData *uctypes.UIMessageDataToolUse) (any, error) {
			ctx, cancelFn := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancelFn()

			// Use 'find' to get a list of files, but limit depth to avoid massive output
			cmd := exec.CommandContext(ctx, "find", ".", "-maxdepth", "3", "-not", "-path", "*/.*", "-not", "-path", "*/node_modules*")
			output, err := cmd.CombinedOutput()
			if err != nil {
				return nil, fmt.Errorf("find failed: %w (output: %s)", err, string(output))
			}

			lines := strings.Split(string(output), "\n")
			if len(lines) > 100 {
				lines = append(lines[:100], "... (truncated)")
			}

			return strings.Join(lines, "\n"), nil
		},
	}
}
