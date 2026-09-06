// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package cmd

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"mime"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
	"github.com/wavetermdev/waveterm/pkg/wshrpc"
	"github.com/wavetermdev/waveterm/pkg/wshrpc/wshclient"
)

const canvasCommandTimeout = 5000
const canvasMaxAssetBytes = 8 * 1024 * 1024

var canvasIncludeContent bool
var canvasAssetMimeType string

var canvasCmd = &cobra.Command{Use: "canvas [command]", Short: "inspect and mutate a KronTerm canvas graph", PersistentPreRunE: preRunSetupRpcClient}
var canvasLoadCmd = &cobra.Command{Use: "load <workspace-id> <block-id>", Short: "load a canvas document", Args: cobra.ExactArgs(2), RunE: canvasLoadRun}
var canvasSnapshotCmd = &cobra.Command{Use: "snapshot <workspace-id> <block-id>", Short: "return a stable canvas graph snapshot", Args: cobra.ExactArgs(2), RunE: canvasSnapshotRun}
var canvasSaveCmd = &cobra.Command{Use: "save <workspace-id> <block-id> <document-json>", Short: "replace a canvas document", Args: cobra.ExactArgs(3), RunE: canvasSaveRun}
var canvasCreateNodeCmd = &cobra.Command{Use: "create-node <workspace-id> <block-id> <node-json>", Short: "create a canvas node", Args: cobra.ExactArgs(3), RunE: canvasCreateNodeRun}
var canvasUpdateNodeCmd = &cobra.Command{Use: "update-node <workspace-id> <block-id> <node-json>", Short: "update a canvas node", Args: cobra.ExactArgs(3), RunE: canvasUpdateNodeRun}
var canvasDeleteNodeCmd = &cobra.Command{Use: "delete-node <workspace-id> <block-id> <node-id>", Short: "delete a canvas node and its edges", Args: cobra.ExactArgs(3), RunE: canvasDeleteNodeRun}
var canvasConnectNodesCmd = &cobra.Command{Use: "connect <workspace-id> <block-id> <from-node> <to-node> [label]", Short: "connect two canvas nodes", Args: cobra.RangeArgs(4, 5), RunE: canvasConnectNodesRun}
var canvasLaunchNodeCmd = &cobra.Command{Use: "launch-node <workspace-id> <block-id> <node-id> <tab-id>", Short: "launch a canvas node as a live block", Args: cobra.ExactArgs(4), RunE: canvasLaunchNodeRun}
var canvasAssetUploadCmd = &cobra.Command{Use: "upload-asset <workspace-id> <block-id> <path>", Short: "copy a local asset into canvas storage", Args: cobra.ExactArgs(3), RunE: canvasAssetUploadRun}

func init() {
	canvasSnapshotCmd.Flags().BoolVar(&canvasIncludeContent, "include-content", false, "include node content")
	canvasAssetUploadCmd.Flags().StringVar(&canvasAssetMimeType, "mime-type", "", "override the detected MIME type")
	canvasCmd.AddCommand(canvasLoadCmd, canvasSnapshotCmd, canvasSaveCmd, canvasCreateNodeCmd, canvasUpdateNodeCmd, canvasDeleteNodeCmd, canvasConnectNodesCmd, canvasLaunchNodeCmd, canvasAssetUploadCmd)
	rootCmd.AddCommand(canvasCmd)
}

func writeCanvasJSON(value any) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return fmt.Errorf("encoding canvas response: %w", err)
	}
	WriteStdout("%s\n", raw)
	return nil
}

func decodeCanvasJSON(raw string, value any) error {
	if err := json.Unmarshal([]byte(raw), value); err != nil {
		return fmt.Errorf("parsing canvas JSON: %w", err)
	}
	return nil
}

func canvasLoadRun(_ *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("canvas:load", rtnErr == nil) }()
	result, err := wshclient.CanvasLoadCommand(RpcClient, wshrpc.CanvasLoadRequest{WorkspaceId: args[0], BlockId: args[1]}, &wshrpc.RpcOpts{Timeout: canvasCommandTimeout})
	if err != nil {
		return fmt.Errorf("loading canvas: %w", err)
	}
	return writeCanvasJSON(result)
}

func canvasSnapshotRun(_ *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("canvas:snapshot", rtnErr == nil) }()
	request := wshrpc.CanvasSnapshotRequest{WorkspaceId: args[0], BlockId: args[1], IncludeContent: canvasIncludeContent}
	result, err := wshclient.CanvasSnapshotCommand(RpcClient, request, &wshrpc.RpcOpts{Timeout: canvasCommandTimeout})
	if err != nil {
		return fmt.Errorf("snapshotting canvas: %w", err)
	}
	return writeCanvasJSON(result)
}

func canvasSaveRun(_ *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("canvas:save", rtnErr == nil) }()
	var document wshrpc.CanvasDocument
	if err := decodeCanvasJSON(args[2], &document); err != nil {
		return err
	}
	request := wshrpc.CanvasSaveRequest{WorkspaceId: args[0], BlockId: args[1], Document: document}
	if err := wshclient.CanvasSaveCommand(RpcClient, request, &wshrpc.RpcOpts{Timeout: canvasCommandTimeout}); err != nil {
		return fmt.Errorf("saving canvas: %w", err)
	}
	WriteStdout("saved\n")
	return nil
}

func canvasCreateNodeRun(_ *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("canvas:create-node", rtnErr == nil) }()
	return canvasMutateNode(args, false)
}

func canvasUpdateNodeRun(_ *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("canvas:update-node", rtnErr == nil) }()
	return canvasMutateNode(args, true)
}

func canvasMutateNode(args []string, update bool) error {
	var node wshrpc.CanvasNode
	if err := decodeCanvasJSON(args[2], &node); err != nil {
		return err
	}
	request := wshrpc.CanvasNodeMutationRequest{WorkspaceId: args[0], BlockId: args[1], Node: node}
	if update {
		result, err := wshclient.CanvasUpdateNodeCommand(RpcClient, request, &wshrpc.RpcOpts{Timeout: canvasCommandTimeout})
		if err != nil {
			return fmt.Errorf("updating canvas node: %w", err)
		}
		return writeCanvasJSON(result)
	}
	result, err := wshclient.CanvasCreateNodeCommand(RpcClient, request, &wshrpc.RpcOpts{Timeout: canvasCommandTimeout})
	if err != nil {
		return fmt.Errorf("creating canvas node: %w", err)
	}
	return writeCanvasJSON(result)
}

func canvasDeleteNodeRun(_ *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("canvas:delete-node", rtnErr == nil) }()
	request := wshrpc.CanvasNodeIdRequest{WorkspaceId: args[0], BlockId: args[1], NodeId: args[2]}
	if err := wshclient.CanvasDeleteNodeCommand(RpcClient, request, &wshrpc.RpcOpts{Timeout: canvasCommandTimeout}); err != nil {
		return fmt.Errorf("deleting canvas node: %w", err)
	}
	WriteStdout("deleted\n")
	return nil
}

func canvasConnectNodesRun(_ *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("canvas:connect", rtnErr == nil) }()
	request := wshrpc.CanvasConnectNodesRequest{WorkspaceId: args[0], BlockId: args[1], FromNode: args[2], ToNode: args[3]}
	if len(args) == 5 {
		request.Label = args[4]
	}
	result, err := wshclient.CanvasConnectNodesCommand(RpcClient, request, &wshrpc.RpcOpts{Timeout: canvasCommandTimeout})
	if err != nil {
		return fmt.Errorf("connecting canvas nodes: %w", err)
	}
	return writeCanvasJSON(result)
}

func canvasLaunchNodeRun(_ *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("canvas:launch-node", rtnErr == nil) }()
	request := wshrpc.CanvasLaunchNodeRequest{WorkspaceId: args[0], BlockId: args[1], NodeId: args[2], TabId: args[3]}
	result, err := wshclient.CanvasLaunchNodeCommand(RpcClient, request, &wshrpc.RpcOpts{Timeout: canvasCommandTimeout})
	if err != nil {
		return fmt.Errorf("launching canvas node: %w", err)
	}
	return writeCanvasJSON(result)
}

func canvasAssetUploadRun(_ *cobra.Command, args []string) (rtnErr error) {
	defer func() { sendActivity("canvas:upload-asset", rtnErr == nil) }()
	info, err := os.Stat(args[2])
	if err != nil {
		return fmt.Errorf("inspecting canvas asset: %w", err)
	}
	if info.Size() > canvasMaxAssetBytes {
		return fmt.Errorf("canvas asset exceeds %d byte limit", canvasMaxAssetBytes)
	}
	raw, err := os.ReadFile(args[2])
	if err != nil {
		return fmt.Errorf("reading canvas asset: %w", err)
	}
	mimeType := canvasAssetMimeType
	if mimeType == "" {
		mimeType = mime.TypeByExtension(filepath.Ext(args[2]))
	}
	request := wshrpc.CanvasAssetUploadRequest{
		WorkspaceId: args[0],
		BlockId:     args[1],
		FileName:    filepath.Base(args[2]),
		MimeType:    mimeType,
		Data64:      base64.StdEncoding.EncodeToString(raw),
	}
	result, err := wshclient.CanvasAssetUploadCommand(RpcClient, request, &wshrpc.RpcOpts{Timeout: canvasCommandTimeout})
	if err != nil {
		return fmt.Errorf("uploading canvas asset: %w", err)
	}
	result.DataUrl = ""
	return writeCanvasJSON(result)
}
