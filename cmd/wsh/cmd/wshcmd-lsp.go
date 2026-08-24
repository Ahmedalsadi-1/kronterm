// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/wavetermdev/waveterm/pkg/wshrpc"
	"github.com/wavetermdev/waveterm/pkg/wshrpc/wshclient"
	"github.com/wavetermdev/waveterm/pkg/wshutil"
)

const lspCommandTimeout = 15000

var lspLine int
var lspCharacter int
var lspMaxResults int

var lspCmd = &cobra.Command{
	Use:               "lsp <workspace-path> <file-path> <language> <query>",
	Short:             "run a scoped read-only language-server query",
	Args:              cobra.ExactArgs(4),
	ValidArgsFunction: cobra.NoFileCompletions,
	PersistentPreRunE: preRunSetupRpcClient,
	RunE:              lspRun,
}

func init() {
	lspCmd.Flags().IntVar(&lspLine, "line", 0, "zero-based line for positional queries")
	lspCmd.Flags().IntVar(&lspCharacter, "character", 0, "zero-based UTF-16 character for positional queries")
	lspCmd.Flags().IntVar(&lspMaxResults, "max-results", 100, "maximum top-level results (1-200)")
	rootCmd.AddCommand(lspCmd)
}

func lspRun(_ *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("lsp:"+args[3], rtnErr == nil) }()
	request := wshrpc.CommandLspQueryData{
		WorkspacePath: args[0],
		FilePath:      args[1],
		Language:      args[2],
		Query:         args[3],
		Line:          lspLine,
		Character:     lspCharacter,
		MaxResults:    lspMaxResults,
	}
	result, err := wshclient.LspQueryCommand(RpcClient, request, &wshrpc.RpcOpts{
		Timeout: lspCommandTimeout,
		Route:   wshutil.ElectronRoute,
	})
	if err != nil {
		return fmt.Errorf("running LSP query: %w", err)
	}
	WriteStdout("%s\n", result.ResultJson)
	return nil
}
