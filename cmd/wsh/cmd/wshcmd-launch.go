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

var magnifyBlock bool
var listWidgetsJSON bool

var launchCmd = &cobra.Command{
	Use:     "launch",
	Short:   "launch a widget by its ID",
	Args:    cobra.ExactArgs(1),
	RunE:    launchRun,
	PreRunE: preRunSetupRpcClient,
}

var listWidgetsCmd = &cobra.Command{
	Use:     "widgets",
	Short:   "list configured widgets",
	Args:    cobra.NoArgs,
	RunE:    listWidgetsRun,
	PreRunE: preRunSetupRpcClient,
}

func init() {
	launchCmd.Flags().BoolVarP(&magnifyBlock, "magnify", "m", false, "start the widget in magnified mode")
	listWidgetsCmd.Flags().BoolVar(&listWidgetsJSON, "json", false, "output as JSON")
	rootCmd.AddCommand(launchCmd)
	rootCmd.AddCommand(listWidgetsCmd)
}

func listWidgetsRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("widgets", rtnErr == nil)
	}()
	config, err := wshclient.GetFullConfigCommand(RpcClient, &wshrpc.RpcOpts{Timeout: 2000})
	if err != nil {
		return fmt.Errorf("getting configuration: %w", err)
	}
	widgets := map[string]interface{}{
		"widgets":        config.Widgets,
		"defaultwidgets": config.DefaultWidgets,
	}
	if listWidgetsJSON {
		barr, err := json.MarshalIndent(widgets, "", "  ")
		if err != nil {
			return fmt.Errorf("encoding widgets: %w", err)
		}
		WriteStdout("%s\n", string(barr))
		return nil
	}
	for widgetId := range config.DefaultWidgets {
		WriteStdout("%s\n", widgetId)
	}
	for widgetId := range config.Widgets {
		WriteStdout("%s\n", widgetId)
	}
	return nil
}

func launchRun(cmd *cobra.Command, args []string) (rtnErr error) {
	defer func() {
		sendActivity("launch", rtnErr == nil)
	}()

	widgetId := args[0]

	// Get the full configuration
	config, err := wshclient.GetFullConfigCommand(RpcClient, &wshrpc.RpcOpts{Timeout: 2000})
	if err != nil {
		return fmt.Errorf("getting configuration: %w", err)
	}

	// Look for widget in both widgets and defaultwidgets
	widget, ok := config.Widgets[widgetId]
	if !ok {
		widget, ok = config.DefaultWidgets[widgetId]
		if !ok {
			return fmt.Errorf("widget %q not found in configuration", widgetId)
		}
	}

	tabId := getTabIdFromEnv()
	if tabId == "" {
		return fmt.Errorf("no WAVETERM_TABID env var set")
	}

	// Create block data from widget config
	createBlockData := wshrpc.CommandCreateBlockData{
		TabId:     tabId,
		BlockDef:  &widget.BlockDef,
		Magnified: magnifyBlock || widget.Magnified,
		Focused:   true,
	}

	// Create the block
	oref, err := wshclient.CreateBlockCommand(RpcClient, createBlockData, nil)
	if err != nil {
		return fmt.Errorf("creating widget block: %w", err)
	}

	WriteStdout("launched widget %q: %s\n", widgetId, oref)
	return nil
}
