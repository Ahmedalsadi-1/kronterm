// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/wavetermdev/waveterm/pkg/waveobj"
	"github.com/wavetermdev/waveterm/pkg/wshrpc"
	"github.com/wavetermdev/waveterm/pkg/wshrpc/wshclient"
)

var createBlockMagnified bool
var createBlockEphemeral bool
var createBlockTargetBlockId string
var createBlockTargetAction string

var createBlockCmd = &cobra.Command{
	Use:     "createblock viewname key=value ...",
	Short:   "create a new block",
	Args:    cobra.MinimumNArgs(1),
	RunE:    createBlockRun,
	PreRunE: preRunSetupRpcClient,
	Hidden:  true,
}

func init() {
	createBlockCmd.Flags().BoolVarP(&createBlockMagnified, "magnified", "m", false, "create block in magnified mode")
	createBlockCmd.Flags().BoolVar(&createBlockEphemeral, "ephemeral", false, "create block as an ephemeral overlay")
	createBlockCmd.Flags().StringVar(&createBlockTargetBlockId, "target-block", "", "target block id for split or replace")
	createBlockCmd.Flags().StringVar(&createBlockTargetAction, "target-action", "", "target action: replace, splitright, splitleft, splitup, or splitdown")
	rootCmd.AddCommand(createBlockCmd)
}

func createBlockRun(cmd *cobra.Command, args []string) error {
	viewName := args[0]
	var metaSetStrs []string
	if len(args) > 1 {
		metaSetStrs = args[1:]
	}
	tabId := getTabIdFromEnv()
	if tabId == "" {
		return fmt.Errorf("no WAVETERM_TABID env var set")
	}
	meta, err := parseMetaSets(metaSetStrs)
	if err != nil {
		return err
	}
	if (createBlockTargetBlockId == "") != (createBlockTargetAction == "") {
		return fmt.Errorf("--target-block and --target-action must be provided together")
	}
	meta["view"] = viewName
	data := wshrpc.CommandCreateBlockData{
		TabId:         tabId,
		TargetBlockId: createBlockTargetBlockId,
		TargetAction:  createBlockTargetAction,
		BlockDef: &waveobj.BlockDef{
			Meta: meta,
		},
		Magnified: createBlockMagnified,
		Ephemeral: createBlockEphemeral,
		Focused:   true,
	}
	oref, err := wshclient.CreateBlockCommand(RpcClient, data, nil)
	if err != nil {
		return fmt.Errorf("create block failed: %v", err)
	}
	fmt.Printf("created block %s\n", oref.OID)
	return nil
}
