// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/spf13/cobra"
	"github.com/wavetermdev/waveterm/pkg/waveobj"
	"github.com/wavetermdev/waveterm/pkg/wps"
	"github.com/wavetermdev/waveterm/pkg/wshrpc"
	"github.com/wavetermdev/waveterm/pkg/wshrpc/wshclient"
)

var agentActivityCmd = &cobra.Command{
	Use:     "agentactivity <json>",
	Short:   "publish a visible agent surface activity event",
	Args:    cobra.ExactArgs(1),
	RunE:    agentActivityRun,
	PreRunE: preRunSetupRpcClient,
}

func init() {
	rootCmd.AddCommand(agentActivityCmd)
}

func agentActivityRun(_ *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("agentactivity", rtnErr == nil) }()

	var data wps.AgentSurfaceActivityData
	if err := json.Unmarshal([]byte(args[0]), &data); err != nil {
		return fmt.Errorf("parsing activity payload: %v", err)
	}
	if data.Source == "" || data.Phase == "" || data.Surface == "" || data.Action == "" {
		return fmt.Errorf("activity requires source, phase, surface, and action")
	}

	var scopes []string
	if data.BlockId != "" {
		scopes = []string{waveobj.MakeORef(waveobj.OType_Block, data.BlockId).String()}
	}
	event := wps.WaveEvent{
		Event:  wps.Event_AgentSurfaceActivity,
		Scopes: scopes,
		Data:   data,
	}
	if err := wshclient.EventPublishCommand(RpcClient, event, &wshrpc.RpcOpts{NoResponse: true}); err != nil {
		return fmt.Errorf("publishing agent surface activity event: %v", err)
	}
	return nil
}
