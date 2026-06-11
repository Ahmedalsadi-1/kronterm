// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package wshserver

import (
	"context"
	"encoding/base64"
	"os"
	"strings"
	"testing"

	"github.com/wavetermdev/waveterm/pkg/wavebase"
	"github.com/wavetermdev/waveterm/pkg/wshrpc"
)

func withCanvasTempDir(t *testing.T) {
	t.Helper()
	oldDataDir := wavebase.DataHome_VarCache
	dir := t.TempDir()
	wavebase.DataHome_VarCache = dir
	t.Cleanup(func() {
		wavebase.DataHome_VarCache = oldDataDir
	})
}

func TestCanvasSaveLoadAndSnapshot(t *testing.T) {
	withCanvasTempDir(t)
	ws := &WshServer{}
	doc := wshrpc.CanvasDocument{
		Version: 1,
		Nodes: []wshrpc.CanvasNode{
			{Id: "a", ShapeId: "shape:a", Type: "text", Title: "Prompt", Content: "hello"},
			{Id: "b", ShapeId: "shape:b", Type: "widget", Title: "Terminal", Status: "ready"},
		},
		Edges: []wshrpc.CanvasEdge{{Id: "e1", FromNode: "a", ToNode: "b"}},
	}
	err := ws.CanvasSaveCommand(context.Background(), wshrpc.CanvasSaveRequest{
		WorkspaceId: "workspace-1",
		BlockId:     "block-1",
		Document:    doc,
	})
	if err != nil {
		t.Fatalf("save failed: %v", err)
	}
	loaded, err := ws.CanvasLoadCommand(context.Background(), wshrpc.CanvasLoadRequest{
		WorkspaceId: "workspace-1",
		BlockId:     "block-1",
	})
	if err != nil {
		t.Fatalf("load failed: %v", err)
	}
	if len(loaded.Document.Nodes) != 2 {
		t.Fatalf("expected 2 nodes, got %d", len(loaded.Document.Nodes))
	}
	snapshot, err := ws.CanvasSnapshotCommand(context.Background(), wshrpc.CanvasSnapshotRequest{
		WorkspaceId:    "workspace-1",
		BlockId:        "block-1",
		IncludeContent: true,
	})
	if err != nil {
		t.Fatalf("snapshot failed: %v", err)
	}
	if !strings.Contains(snapshot.Summary, "Prompt -> Terminal") {
		t.Fatalf("expected edge summary, got %q", snapshot.Summary)
	}
	if !strings.Contains(snapshot.Summary, "hello") {
		t.Fatalf("expected content summary, got %q", snapshot.Summary)
	}
}

func TestCanvasAssetUploadSanitizesPath(t *testing.T) {
	withCanvasTempDir(t)
	ws := &WshServer{}
	resp, err := ws.CanvasAssetUploadCommand(context.Background(), wshrpc.CanvasAssetUploadRequest{
		WorkspaceId: "workspace",
		BlockId:     "block",
		FileName:    "../bad name.png",
		MimeType:    "image/png",
		Data64:      base64.StdEncoding.EncodeToString([]byte("png")),
	})
	if err != nil {
		t.Fatalf("upload failed: %v", err)
	}
	if strings.Contains(resp.FileName, "/") || strings.Contains(resp.FileName, " ") {
		t.Fatalf("filename was not sanitized: %q", resp.FileName)
	}
	if _, err := os.Stat(resp.Path); err != nil {
		t.Fatalf("expected uploaded file to exist: %v", err)
	}
	if !strings.HasPrefix(resp.DataUrl, "data:image/png;base64,") {
		t.Fatalf("expected data url, got %q", resp.DataUrl)
	}
}

func TestCanvasNodeMutationCommands(t *testing.T) {
	withCanvasTempDir(t)
	ws := &WshServer{}
	ctx := context.Background()
	workspaceId := "workspace-1"
	blockId := "block-1"
	first, err := ws.CanvasCreateNodeCommand(ctx, wshrpc.CanvasNodeMutationRequest{
		WorkspaceId: workspaceId,
		BlockId:     blockId,
		Node:        wshrpc.CanvasNode{Id: "prompt", ShapeId: "shape-prompt", Type: "text", Title: "Prompt"},
	})
	if err != nil {
		t.Fatalf("create first node failed: %v", err)
	}
	if first.WorkspaceId != workspaceId || first.BlockId != blockId {
		t.Fatalf("expected node workspace/block ids to be filled: %#v", first)
	}
	if _, err := ws.CanvasCreateNodeCommand(ctx, wshrpc.CanvasNodeMutationRequest{
		WorkspaceId: workspaceId,
		BlockId:     blockId,
		Node:        wshrpc.CanvasNode{Id: "app", ShapeId: "shape-app", Type: "appstream", Title: "Notes", Status: "idle"},
	}); err != nil {
		t.Fatalf("create app node failed: %v", err)
	}
	if _, err := ws.CanvasConnectNodesCommand(ctx, wshrpc.CanvasConnectNodesRequest{
		WorkspaceId: workspaceId,
		BlockId:     blockId,
		FromNode:    "prompt",
		ToNode:      "app",
	}); err != nil {
		t.Fatalf("connect nodes failed: %v", err)
	}
	launch, err := ws.CanvasLaunchNodeCommand(ctx, wshrpc.CanvasLaunchNodeRequest{
		WorkspaceId: workspaceId,
		BlockId:     blockId,
		NodeId:      "app",
	})
	if err != nil {
		t.Fatalf("launch node failed: %v", err)
	}
	if launch.Node.Status != "launched" {
		t.Fatalf("expected launched status, got %q", launch.Node.Status)
	}
	if err := ws.CanvasDeleteNodeCommand(ctx, wshrpc.CanvasNodeIdRequest{
		WorkspaceId: workspaceId,
		BlockId:     blockId,
		NodeId:      "prompt",
	}); err != nil {
		t.Fatalf("delete node failed: %v", err)
	}
	snapshot, err := ws.CanvasSnapshotCommand(ctx, wshrpc.CanvasSnapshotRequest{
		WorkspaceId: workspaceId,
		BlockId:     blockId,
	})
	if err != nil {
		t.Fatalf("snapshot failed: %v", err)
	}
	if len(snapshot.Nodes) != 1 {
		t.Fatalf("expected one remaining node, got %d", len(snapshot.Nodes))
	}
	if len(snapshot.Edges) != 0 {
		t.Fatalf("expected deleted node edges to be pruned, got %d", len(snapshot.Edges))
	}
}
