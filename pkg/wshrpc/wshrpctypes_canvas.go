// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package wshrpc

type CanvasLoadRequest struct {
	WorkspaceId string `json:"workspaceid"`
	BlockId     string `json:"blockid"`
}

type CanvasLoadResponse struct {
	Document CanvasDocument `json:"document"`
}

type CanvasSaveRequest struct {
	WorkspaceId string         `json:"workspaceid"`
	BlockId     string         `json:"blockid"`
	Document    CanvasDocument `json:"document"`
}

type CanvasSnapshotRequest struct {
	WorkspaceId    string `json:"workspaceid"`
	BlockId        string `json:"blockid"`
	IncludeContent bool   `json:"includecontent,omitempty"`
}

type CanvasAssetUploadRequest struct {
	WorkspaceId string `json:"workspaceid"`
	BlockId     string `json:"blockid"`
	FileName    string `json:"filename"`
	MimeType    string `json:"mimetype"`
	Data64      string `json:"data64"`
}

type CanvasAssetUploadResponse struct {
	FileName string `json:"filename"`
	Path     string `json:"path"`
	MimeType string `json:"mimetype"`
	DataUrl  string `json:"dataurl"`
}

type CanvasNodeMutationRequest struct {
	WorkspaceId string     `json:"workspaceid"`
	BlockId     string     `json:"blockid"`
	Node        CanvasNode `json:"node"`
}

type CanvasNodeIdRequest struct {
	WorkspaceId string `json:"workspaceid"`
	BlockId     string `json:"blockid"`
	NodeId      string `json:"nodeid"`
}

type CanvasConnectNodesRequest struct {
	WorkspaceId string `json:"workspaceid"`
	BlockId     string `json:"blockid"`
	FromNode    string `json:"fromnode"`
	ToNode      string `json:"tonode"`
	Label       string `json:"label,omitempty"`
}

type CanvasLaunchNodeRequest struct {
	WorkspaceId string `json:"workspaceid"`
	BlockId     string `json:"blockid"`
	NodeId      string `json:"nodeid"`
}

type CanvasDocument struct {
	Version     int               `json:"version"`
	Snapshot    map[string]any    `json:"snapshot,omitempty"`
	ShapeToNode map[string]string `json:"shapetonode,omitempty"`
	Nodes       []CanvasNode      `json:"nodes,omitempty"`
	Edges       []CanvasEdge      `json:"edges,omitempty"`
	UpdatedTs   int64             `json:"updatedts,omitempty"`
}

type CanvasNode struct {
	Id          string         `json:"id"`
	ShapeId     string         `json:"shapeid"`
	Type        string         `json:"type"`
	Title       string         `json:"title"`
	Path        string         `json:"path,omitempty"`
	Content     string         `json:"content,omitempty"`
	ParentId    string         `json:"parentid,omitempty"`
	WorkspaceId string         `json:"workspaceid,omitempty"`
	BlockId     string         `json:"blockid,omitempty"`
	AppId       string         `json:"appid,omitempty"`
	AppName     string         `json:"appname,omitempty"`
	SessionId   string         `json:"sessionid,omitempty"`
	Status      string         `json:"status,omitempty"`
	Meta        map[string]any `json:"meta,omitempty"`
}

type CanvasEdge struct {
	Id       string `json:"id"`
	ShapeId  string `json:"shapeid,omitempty"`
	FromNode string `json:"fromnode"`
	ToNode   string `json:"tonode"`
	Label    string `json:"label,omitempty"`
}

type CanvasSnapshotResponse struct {
	Summary string       `json:"summary"`
	Nodes   []CanvasNode `json:"nodes"`
	Edges   []CanvasEdge `json:"edges"`
}

type CanvasLaunchNodeResponse struct {
	Node CanvasNode `json:"node"`
}
