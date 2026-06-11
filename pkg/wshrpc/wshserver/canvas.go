// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package wshserver

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"mime"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/wavetermdev/waveterm/pkg/wavebase"
	"github.com/wavetermdev/waveterm/pkg/wshrpc"
)

const canvasDocumentFile = ".canvas.json"

var canvasSafeIdRe = regexp.MustCompile(`^[A-Za-z0-9._:-]+$`)

func (ws *WshServer) CanvasLoadCommand(ctx context.Context, data wshrpc.CanvasLoadRequest) (*wshrpc.CanvasLoadResponse, error) {
	dir, err := canvasStorageDir(data.WorkspaceId, data.BlockId)
	if err != nil {
		return nil, err
	}
	doc, err := readCanvasDocument(filepath.Join(dir, canvasDocumentFile))
	if err != nil {
		return nil, err
	}
	return &wshrpc.CanvasLoadResponse{Document: doc}, nil
}

func (ws *WshServer) CanvasSaveCommand(ctx context.Context, data wshrpc.CanvasSaveRequest) error {
	dir, err := canvasStorageDir(data.WorkspaceId, data.BlockId)
	if err != nil {
		return err
	}
	return writeCanvasDocument(dir, data.Document)
}

func (ws *WshServer) CanvasSnapshotCommand(ctx context.Context, data wshrpc.CanvasSnapshotRequest) (*wshrpc.CanvasSnapshotResponse, error) {
	dir, err := canvasStorageDir(data.WorkspaceId, data.BlockId)
	if err != nil {
		return nil, err
	}
	doc, err := readCanvasDocument(filepath.Join(dir, canvasDocumentFile))
	if err != nil {
		return nil, err
	}
	nodes := append([]wshrpc.CanvasNode(nil), doc.Nodes...)
	edges := append([]wshrpc.CanvasEdge(nil), doc.Edges...)
	sort.Slice(nodes, func(i, j int) bool {
		if nodes[i].ParentId != nodes[j].ParentId {
			return nodes[i].ParentId < nodes[j].ParentId
		}
		return strings.ToLower(nodes[i].Title) < strings.ToLower(nodes[j].Title)
	})
	sort.Slice(edges, func(i, j int) bool {
		if edges[i].FromNode != edges[j].FromNode {
			return edges[i].FromNode < edges[j].FromNode
		}
		return edges[i].ToNode < edges[j].ToNode
	})
	return &wshrpc.CanvasSnapshotResponse{
		Summary: renderCanvasSnapshot(nodes, edges, data.IncludeContent),
		Nodes:   nodes,
		Edges:   edges,
	}, nil
}

func (ws *WshServer) CanvasAssetUploadCommand(ctx context.Context, data wshrpc.CanvasAssetUploadRequest) (*wshrpc.CanvasAssetUploadResponse, error) {
	dir, err := canvasStorageDir(data.WorkspaceId, data.BlockId)
	if err != nil {
		return nil, err
	}
	assetDir := filepath.Join(dir, "assets")
	if err := os.MkdirAll(assetDir, 0700); err != nil {
		return nil, fmt.Errorf("creating canvas assets dir: %w", err)
	}
	fileName := sanitizeCanvasFileName(data.FileName, data.MimeType)
	raw, err := base64.StdEncoding.DecodeString(data.Data64)
	if err != nil {
		return nil, fmt.Errorf("decoding asset: %w", err)
	}
	path := filepath.Join(assetDir, fileName)
	path = uniqueCanvasAssetPath(path)
	if err := os.WriteFile(path, raw, 0600); err != nil {
		return nil, fmt.Errorf("writing asset: %w", err)
	}
	finalName := filepath.Base(path)
	mimeType := data.MimeType
	if mimeType == "" {
		mimeType = mime.TypeByExtension(filepath.Ext(finalName))
	}
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	return &wshrpc.CanvasAssetUploadResponse{
		FileName: finalName,
		Path:     path,
		MimeType: mimeType,
		DataUrl:  "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(raw),
	}, nil
}

func (ws *WshServer) CanvasCreateNodeCommand(ctx context.Context, data wshrpc.CanvasNodeMutationRequest) (*wshrpc.CanvasNode, error) {
	dir, doc, err := loadCanvasDocumentForMutation(data.WorkspaceId, data.BlockId)
	if err != nil {
		return nil, err
	}
	node := normalizeCanvasNode(data.Node, data.WorkspaceId, data.BlockId)
	if node.Id == "" {
		node.Id = fmt.Sprintf("node-%d", time.Now().UnixNano())
	}
	if node.ShapeId == "" {
		node.ShapeId = node.Id
	}
	for _, existing := range doc.Nodes {
		if existing.Id == node.Id {
			return nil, fmt.Errorf("canvas node already exists: %s", node.Id)
		}
	}
	doc.Nodes = append(doc.Nodes, node)
	if err := writeCanvasDocument(dir, doc); err != nil {
		return nil, err
	}
	return &node, nil
}

func (ws *WshServer) CanvasUpdateNodeCommand(ctx context.Context, data wshrpc.CanvasNodeMutationRequest) (*wshrpc.CanvasNode, error) {
	dir, doc, err := loadCanvasDocumentForMutation(data.WorkspaceId, data.BlockId)
	if err != nil {
		return nil, err
	}
	node := normalizeCanvasNode(data.Node, data.WorkspaceId, data.BlockId)
	if node.Id == "" {
		return nil, fmt.Errorf("nodeid is required")
	}
	for idx := range doc.Nodes {
		if doc.Nodes[idx].Id == node.Id {
			doc.Nodes[idx] = node
			if err := writeCanvasDocument(dir, doc); err != nil {
				return nil, err
			}
			return &node, nil
		}
	}
	return nil, fmt.Errorf("canvas node not found: %s", node.Id)
}

func (ws *WshServer) CanvasDeleteNodeCommand(ctx context.Context, data wshrpc.CanvasNodeIdRequest) error {
	dir, doc, err := loadCanvasDocumentForMutation(data.WorkspaceId, data.BlockId)
	if err != nil {
		return err
	}
	if data.NodeId == "" {
		return fmt.Errorf("nodeid is required")
	}
	nodes := doc.Nodes[:0]
	found := false
	for _, node := range doc.Nodes {
		if node.Id == data.NodeId {
			found = true
			continue
		}
		nodes = append(nodes, node)
	}
	if !found {
		return fmt.Errorf("canvas node not found: %s", data.NodeId)
	}
	edges := doc.Edges[:0]
	for _, edge := range doc.Edges {
		if edge.FromNode == data.NodeId || edge.ToNode == data.NodeId {
			continue
		}
		edges = append(edges, edge)
	}
	doc.Nodes = nodes
	doc.Edges = edges
	return writeCanvasDocument(dir, doc)
}

func (ws *WshServer) CanvasConnectNodesCommand(ctx context.Context, data wshrpc.CanvasConnectNodesRequest) (*wshrpc.CanvasEdge, error) {
	dir, doc, err := loadCanvasDocumentForMutation(data.WorkspaceId, data.BlockId)
	if err != nil {
		return nil, err
	}
	if data.FromNode == "" || data.ToNode == "" {
		return nil, fmt.Errorf("fromnode and tonode are required")
	}
	if !canvasDocumentHasNode(doc, data.FromNode) || !canvasDocumentHasNode(doc, data.ToNode) {
		return nil, fmt.Errorf("canvas connection references missing node")
	}
	edgeId := fmt.Sprintf("edge-%d", time.Now().UnixNano())
	edge := wshrpc.CanvasEdge{
		Id:       edgeId,
		ShapeId:  edgeId,
		FromNode: data.FromNode,
		ToNode:   data.ToNode,
		Label:    data.Label,
	}
	doc.Edges = append(doc.Edges, edge)
	if err := writeCanvasDocument(dir, doc); err != nil {
		return nil, err
	}
	return &edge, nil
}

func (ws *WshServer) CanvasLaunchNodeCommand(ctx context.Context, data wshrpc.CanvasLaunchNodeRequest) (*wshrpc.CanvasLaunchNodeResponse, error) {
	dir, doc, err := loadCanvasDocumentForMutation(data.WorkspaceId, data.BlockId)
	if err != nil {
		return nil, err
	}
	if data.NodeId == "" {
		return nil, fmt.Errorf("nodeid is required")
	}
	for idx := range doc.Nodes {
		if doc.Nodes[idx].Id == data.NodeId {
			if doc.Nodes[idx].Status == "" || doc.Nodes[idx].Status == "idle" || doc.Nodes[idx].Status == "ready" {
				doc.Nodes[idx].Status = "launched"
			}
			if err := writeCanvasDocument(dir, doc); err != nil {
				return nil, err
			}
			node := doc.Nodes[idx]
			return &wshrpc.CanvasLaunchNodeResponse{Node: node}, nil
		}
	}
	return nil, fmt.Errorf("canvas node not found: %s", data.NodeId)
}

func canvasStorageDir(workspaceId string, blockId string) (string, error) {
	if workspaceId == "" {
		return "", fmt.Errorf("workspaceid is required")
	}
	if blockId == "" {
		return "", fmt.Errorf("blockid is required")
	}
	if !canvasSafeIdRe.MatchString(workspaceId) || !canvasSafeIdRe.MatchString(blockId) {
		return "", fmt.Errorf("invalid canvas id")
	}
	return filepath.Join(wavebase.GetWaveDataDir(), "canvas", workspaceId, blockId), nil
}

func readCanvasDocument(path string) (wshrpc.CanvasDocument, error) {
	raw, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return wshrpc.CanvasDocument{Version: 1, Snapshot: map[string]any{}}, nil
	}
	if err != nil {
		return wshrpc.CanvasDocument{}, fmt.Errorf("reading canvas document: %w", err)
	}
	var doc wshrpc.CanvasDocument
	if err := json.Unmarshal(raw, &doc); err != nil {
		return wshrpc.CanvasDocument{}, fmt.Errorf("decoding canvas document: %w", err)
	}
	if doc.Version == 0 {
		doc.Version = 1
	}
	if doc.Snapshot == nil {
		doc.Snapshot = map[string]any{}
	}
	return doc, nil
}

func loadCanvasDocumentForMutation(workspaceId string, blockId string) (string, wshrpc.CanvasDocument, error) {
	dir, err := canvasStorageDir(workspaceId, blockId)
	if err != nil {
		return "", wshrpc.CanvasDocument{}, err
	}
	doc, err := readCanvasDocument(filepath.Join(dir, canvasDocumentFile))
	if err != nil {
		return "", wshrpc.CanvasDocument{}, err
	}
	return dir, doc, nil
}

func writeCanvasDocument(dir string, doc wshrpc.CanvasDocument) error {
	if err := os.MkdirAll(dir, 0700); err != nil {
		return fmt.Errorf("creating canvas dir: %w", err)
	}
	if doc.Version == 0 {
		doc.Version = 1
	}
	doc.UpdatedTs = time.Now().UnixMilli()
	raw, err := json.MarshalIndent(doc, "", "  ")
	if err != nil {
		return fmt.Errorf("encoding canvas document: %w", err)
	}
	if err := os.WriteFile(filepath.Join(dir, canvasDocumentFile), raw, 0600); err != nil {
		return fmt.Errorf("writing canvas document: %w", err)
	}
	return nil
}

func normalizeCanvasNode(node wshrpc.CanvasNode, workspaceId string, blockId string) wshrpc.CanvasNode {
	node.WorkspaceId = workspaceId
	node.BlockId = blockId
	if node.Type == "" {
		node.Type = "text"
	}
	if node.Title == "" {
		node.Title = node.Id
	}
	return node
}

func canvasDocumentHasNode(doc wshrpc.CanvasDocument, nodeId string) bool {
	for _, node := range doc.Nodes {
		if node.Id == nodeId {
			return true
		}
	}
	return false
}

func renderCanvasSnapshot(nodes []wshrpc.CanvasNode, edges []wshrpc.CanvasEdge, includeContent bool) string {
	var b strings.Builder
	b.WriteString(\"Canvas Graph:\\n\")
	if len(nodes) == 0 {
		b.WriteString(\"  (empty)\\n\")
	}

	incomingEdges := make(map[string][]string)
	nodeTitles := make(map[string]string)
	for _, node := range nodes {
		nodeTitles[node.Id] = node.Title
	}
	for _, edge := range edges {
		incomingEdges[edge.ToNode] = append(incomingEdges[edge.ToNode], edge.FromNode)
	}

	for _, node := range nodes {
		title := strings.TrimSpace(node.Title)
		if title == \"\" {
			title = node.Id
		}
		b.WriteString(fmt.Sprintf(\"  - [%s] %s\", node.Type, title))
		if node.Status != \"\" {
			b.WriteString(\" (\" + node.Status + \")\")
		}
		b.WriteString(\"\\n\")

		sources := incomingEdges[node.Id]
		if len(sources) > 0 {
			var sourceTitles []string
			for _, s := range sources {
				sourceTitles = append(sourceTitles, firstNonBlank(nodeTitles[s], s))
			}
			b.WriteString(fmt.Sprintf(\"      <- Receives context from: %s\\n\", strings.Join(sourceTitles, \", \")))
		}

		if includeContent && strings.TrimSpace(node.Content) != \"\" {
			for _, line := range strings.Split(node.Content, \"\\n\") {
				b.WriteString(\"      \" + line + \"\\n\")
			}
		}
	}
	if len(edges) > 0 {
		b.WriteString(\"Connections:\\n\")
		for _, edge := range edges {
			from := firstNonBlank(nodeTitles[edge.FromNode], edge.FromNode)
			to := firstNonBlank(nodeTitles[edge.ToNode], edge.ToNode)
			b.WriteString(fmt.Sprintf(\"  %s -> %s\", from, to))
			if edge.Label != \"\" {
				b.WriteString(\" : \" + edge.Label)
			}
			b.WriteString(\"\\n\")
		}
	}
	return b.String()
}

func firstNonBlank(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func sanitizeCanvasFileName(fileName string, mimeType string) string {
	name := filepath.Base(fileName)
	name = strings.TrimSpace(name)
	if name == "." || name == "" {
		name = "asset"
	}
	name = strings.Map(func(r rune) rune {
		if r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r == '.' || r == '-' || r == '_' {
			return r
		}
		return '-'
	}, name)
	if filepath.Ext(name) == "" {
		if exts, _ := mime.ExtensionsByType(mimeType); len(exts) > 0 {
			name += exts[0]
		}
	}
	return name
}

func uniqueCanvasAssetPath(path string) string {
	if _, err := os.Stat(path); os.IsNotExist(err) {
		return path
	}
	ext := filepath.Ext(path)
	base := strings.TrimSuffix(path, ext)
	for idx := 1; ; idx++ {
		nextPath := fmt.Sprintf("%s-%d%s", base, idx, ext)
		if _, err := os.Stat(nextPath); os.IsNotExist(err) {
			return nextPath
		}
	}
}
