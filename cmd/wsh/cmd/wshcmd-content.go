// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/spf13/cobra"
	"github.com/wavetermdev/waveterm/pkg/wshrpc"
	"github.com/wavetermdev/waveterm/pkg/wshrpc/wshclient"
)

var contentCmd = &cobra.Command{
	Use:               "content [blockid]",
	Short:             "get structured content of any block/widget as JSON",
	Long: `Get the structured content and state of any block or widget in the workspace.
Returns a JSON object with view-type-specific fields.

Supported view types: term, web, editor, preview, sandbox, waveai

Use "this" or omit the blockid to target the current block.`,
	Args:                  cobra.RangeArgs(0, 1),
	RunE:                  contentRun,
	PreRunE:               preRunSetupRpcClient,
	DisableFlagsInUseLine: true,
}

var contentJsonFlag bool

func init() {
	contentCmd.Flags().BoolVarP(&contentJsonFlag, "json", "j", false, "pretty-print JSON output")
	contentCmd.Flags().BoolVarP(&contentJsonFlag, "pretty", "p", false, "pretty-print JSON output (alias for --json)")
	contentCmd.Flags().BoolVarP(&contentJsonFlag, "pretty-json", "P", false, "pretty-print JSON output")
	rootCmd.AddCommand(contentCmd)
}

func contentRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("content", rtnErr == nil)
	}()

	var blockId string
	if len(args) == 0 {
		fullORef, err := resolveBlockArg()
		if err != nil {
			return fmt.Errorf("resolving blockid: %w", err)
		}
		blockId = fullORef.OID
	} else {
		fullORef, err := resolveSimpleId(args[0])
		if err != nil {
			return fmt.Errorf("resolving blockid: %w", err)
		}
		blockId = fullORef.OID
	}

	content, err := wshclient.GetBlockContentCommand(RpcClient, blockId, &wshrpc.RpcOpts{
		Timeout: 5000,
	})
	if err != nil {
		return fmt.Errorf("getting block content: %w", err)
	}

	if contentJsonFlag {
		barr, err := json.MarshalIndent(content, "", "  ")
		if err != nil {
			return fmt.Errorf("json encoding: %w", err)
		}
		WriteStdout("%s\n", string(barr))
	} else {
		WriteStdout("Block:    %s\n", content.BlockId)
		WriteStdout("ViewType: %s\n", content.ViewType)

		switch content.ViewType {
		case "term":
			t := content.Terminal
			if t == nil {
				WriteStdout("  (no terminal data)\n")
				break
			}
			if t.Cwd != "" {
				WriteStdout("  Cwd:            %s\n", t.Cwd)
			}
			if t.RunningProcess != "" {
				WriteStdout("  Running:        %s\n", t.RunningProcess)
			}
			if t.ShellType != "" {
				WriteStdout("  Shell:          %s\n", t.ShellType)
			}
			if t.ControllerType != "" {
				WriteStdout("  Controller:     %s\n", t.ControllerType)
			}
			if t.ConnectionName != "" {
				WriteStdout("  Connection:     %s\n", t.ConnectionName)
			}
			WriteStdout("  ExitCode:       %d\n", t.ExitCode)
			WriteStdout("  ShellInteg:     %v\n", t.HasShellIntegration)
			if t.JobId != "" {
				WriteStdout("  JobId:          %s\n", t.JobId)
				WriteStdout("  JobRunning:     %v\n", t.JobRunning)
			}

		case "web":
			w := content.Web
			if w == nil {
				WriteStdout("  (no web data)\n")
				break
			}
			if w.Url != "" {
				WriteStdout("  Url:            %s\n", w.Url)
			}
			if w.Title != "" {
				WriteStdout("  Title:          %s\n", w.Title)
			}
			WriteStdout("  Loading:        %v\n", w.Loading)
			if w.PinnedUrl != "" {
				WriteStdout("  PinnedUrl:      %s\n", w.PinnedUrl)
			}

		case "editor", "edit":
			e := content.Editor
			if e == nil {
				WriteStdout("  (no editor data)\n")
				break
			}
			if e.FilePath != "" {
				WriteStdout("  File:           %s\n", e.FilePath)
			}
			if e.Language != "" {
				WriteStdout("  Language:       %s\n", e.Language)
			}
			WriteStdout("  Modified:       %v\n", e.Modified)
			if e.PreviewType != "" {
				WriteStdout("  Preview:        %s\n", e.PreviewType)
			}

		case "preview":
			p := content.Preview
			if p == nil {
				WriteStdout("  (no preview data)\n")
				break
			}
			if p.FilePath != "" {
				WriteStdout("  File:           %s\n", p.FilePath)
			}
			if p.MimeType != "" {
				WriteStdout("  MimeType:       %s\n", p.MimeType)
			}
			if p.FileSize > 0 {
				WriteStdout("  Size:           %d bytes\n", p.FileSize)
			}

		case "sandbox":
			s := content.Sandbox
			if s == nil {
				WriteStdout("  (no sandbox data)\n")
				break
			}
			if s.SandboxId != "" {
				WriteStdout("  SandboxId:      %s\n", s.SandboxId)
			}
			WriteStdout("  Running:        %v\n", s.Running)

		case "waveai", "ai":
			a := content.AI
			if a == nil {
				WriteStdout("  (no ai data)\n")
				break
			}
			if a.Model != "" {
				WriteStdout("  Model:          %s\n", a.Model)
			}
			if a.Provider != "" {
				WriteStdout("  Provider:       %s\n", a.Provider)
			}
			WriteStdout("  Messages:       %d\n", a.MessageCount)
		}
	}

	return nil
}
