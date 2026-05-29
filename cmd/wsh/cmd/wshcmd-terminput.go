// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package cmd

import (
	"encoding/base64"
	"fmt"

	"github.com/spf13/cobra"
	"github.com/wavetermdev/waveterm/pkg/wshrpc"
	"github.com/wavetermdev/waveterm/pkg/wshrpc/wshclient"
	"github.com/wavetermdev/waveterm/pkg/wshutil"
)

var termInputSubmit bool

var termInputCmd = &cobra.Command{
	Use:     "terminput <text>",
	Short:   "Send input to an existing terminal block",
	Args:    cobra.ExactArgs(1),
	RunE:    termInputRun,
	PreRunE: preRunSetupRpcClient,
}

func init() {
	termInputCmd.Flags().BoolVar(&termInputSubmit, "submit", false, "append Enter after sending input")
	rootCmd.AddCommand(termInputCmd)
}

func termInputRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("terminput", rtnErr == nil)
	}()

	fullORef, err := resolveBlockArg()
	if err != nil {
		return err
	}

	input := args[0]
	if termInputSubmit {
		input += "\n"
	}
	err = wshclient.ControllerInputCommand(
		RpcClient,
		wshrpc.CommandBlockInputData{
			BlockId:     fullORef.OID,
			InputData64: base64.StdEncoding.EncodeToString([]byte(input)),
		},
		&wshrpc.RpcOpts{Route: wshutil.MakeFeBlockRouteId(fullORef.OID), Timeout: 5000},
	)
	if err != nil {
		return fmt.Errorf("sending terminal input: %w", err)
	}
	WriteStdout("terminal input sent\n")
	return nil
}
