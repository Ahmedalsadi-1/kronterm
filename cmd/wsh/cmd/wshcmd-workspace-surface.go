// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/spf13/cobra"
	"github.com/wavetermdev/waveterm/pkg/wshrpc"
	"github.com/wavetermdev/waveterm/pkg/wshrpc/wshclient"
)

var workspaceSurfaceControlData wshrpc.CommandWorkspaceSurfaceControlData
var workspaceSurfaceSize float64
var workspaceSurfaceX float64
var workspaceSurfaceY float64
var workspaceSurfaceWidth float64
var workspaceSurfaceHeight float64

var workspaceSurfaceCmd = &cobra.Command{
	Use:               "workspace-surface",
	Short:             "Inspect and control the active widgets, tabs, or canvas presentation",
	PersistentPreRunE: preRunSetupRpcClient,
}

var workspaceSurfaceSnapshotCmd = &cobra.Command{
	Use:   "snapshot",
	Short: "Return ordered widget identity, appearance, geometry, and presentation context as JSON",
	Args:  cobra.NoArgs,
	RunE:  workspaceSurfaceSnapshotRun,
}

var workspaceSurfaceScreenshotCmd = &cobra.Command{
	Use:   "screenshot",
	Short: "Capture the complete active workspace presentation",
	Args:  cobra.NoArgs,
	RunE:  workspaceSurfaceScreenshotRun,
}

var workspaceSurfaceControlCmd = &cobra.Command{
	Use:   "control [action]",
	Short: "Apply a presentation-aware workspace action",
	Args:  cobra.ExactArgs(1),
	RunE:  workspaceSurfaceControlRun,
}

func init() {
	rootCmd.AddCommand(workspaceSurfaceCmd)
	workspaceSurfaceCmd.AddCommand(workspaceSurfaceSnapshotCmd, workspaceSurfaceScreenshotCmd, workspaceSurfaceControlCmd)
	flags := workspaceSurfaceControlCmd.Flags()
	flags.StringVar(&workspaceSurfaceControlData.Presentation, "presentation", "", "target presentation: widgets, tabs, or canvas")
	flags.StringVar(&workspaceSurfaceControlData.BlockId, "block", "", "widget block id")
	flags.StringVar(&workspaceSurfaceControlData.TargetBlockId, "target-block", "", "target widget for move or swap")
	flags.StringVar(&workspaceSurfaceControlData.Position, "position", "", "relative position: before or after")
	flags.StringVar(&workspaceSurfaceControlData.Direction, "direction", "", "direction: up, right, down, or left")
	flags.Float64Var(&workspaceSurfaceSize, "size", 0, "widget split size percentage (10-90)")
	flags.Float64Var(&workspaceSurfaceX, "x", 0, "canvas world x coordinate")
	flags.Float64Var(&workspaceSurfaceY, "y", 0, "canvas world y coordinate")
	flags.Float64Var(&workspaceSurfaceWidth, "width", 0, "canvas widget width")
	flags.Float64Var(&workspaceSurfaceHeight, "height", 0, "canvas widget height")
	flags.StringVar(&workspaceSurfaceControlData.ObjectId, "object", "", "canvas whiteboard object id")
	flags.StringVar(&workspaceSurfaceControlData.FromObjectId, "from-object", "", "source canvas object id")
	flags.StringVar(&workspaceSurfaceControlData.ToObjectId, "to-object", "", "destination canvas object id")
	flags.StringVar(&workspaceSurfaceControlData.Text, "text", "", "canvas sticky-note text")
	flags.StringVar(&workspaceSurfaceControlData.Color, "color", "", "canvas object color")
}

func workspaceSurfaceSnapshotRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("workspace-surface:snapshot", rtnErr == nil) }()
	result, err := wshclient.WorkspaceSurfaceSnapshotCommand(RpcClient, getTabRouteOpts())
	if err != nil {
		return fmt.Errorf("workspace surface snapshot: %w", err)
	}
	WriteStdout("%s\n", result)
	return nil
}

func workspaceSurfaceScreenshotRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("workspace-surface:screenshot", rtnErr == nil) }()
	result, err := wshclient.WorkspaceSurfaceScreenshotCommand(RpcClient, getTabRouteOpts())
	if err != nil {
		return fmt.Errorf("workspace surface screenshot: %w", err)
	}
	WriteStdout("%s\n", result)
	return nil
}

func workspaceSurfaceControlRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("workspace-surface:control", rtnErr == nil) }()
	workspaceSurfaceControlData.Action = args[0]
	if cmd.Flags().Changed("size") {
		workspaceSurfaceControlData.Size = &workspaceSurfaceSize
	}
	if cmd.Flags().Changed("x") {
		workspaceSurfaceControlData.X = &workspaceSurfaceX
	}
	if cmd.Flags().Changed("y") {
		workspaceSurfaceControlData.Y = &workspaceSurfaceY
	}
	if cmd.Flags().Changed("width") {
		workspaceSurfaceControlData.Width = &workspaceSurfaceWidth
	}
	if cmd.Flags().Changed("height") {
		workspaceSurfaceControlData.Height = &workspaceSurfaceHeight
	}
	result, err := wshclient.WorkspaceSurfaceControlCommand(RpcClient, workspaceSurfaceControlData, getTabRouteOpts())
	if err != nil {
		return fmt.Errorf("workspace surface control: %w", err)
	}
	if !json.Valid([]byte(result)) {
		return fmt.Errorf("workspace surface returned invalid JSON")
	}
	WriteStdout("%s\n", result)
	return nil
}
