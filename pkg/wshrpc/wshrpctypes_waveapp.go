// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

// WaveApp-related types for wsh rpc calls
package wshrpc

type AppInfo struct {
	AppId    string       `json:"appid"`
	ModTime  int64        `json:"modtime"`
	Manifest *AppManifest `json:"manifest,omitempty"`
}

type CommandListAllAppFilesData struct {
	AppId string `json:"appid"`
}

type CommandListAllAppFilesRtnData struct {
	Path         string        `json:"path"`
	AbsolutePath string        `json:"absolutepath"`
	ParentDir    string        `json:"parentdir,omitempty"`
	Entries      []DirEntryOut `json:"entries"`
	EntryCount   int           `json:"entrycount"`
	TotalEntries int           `json:"totalentries"`
	Truncated    bool          `json:"truncated,omitempty"`
}

type DirEntryOut struct {
	Name         string `json:"name"`
	Dir          bool   `json:"dir,omitempty"`
	Symlink      bool   `json:"symlink,omitempty"`
	Size         int64  `json:"size,omitempty"`
	Mode         string `json:"mode"`
	Modified     string `json:"modified"`
	ModifiedTime string `json:"modifiedtime"`
}

type CommandReadAppFileData struct {
	AppId    string `json:"appid"`
	FileName string `json:"filename"`
}

type CommandReadAppFileRtnData struct {
	Data64   string `json:"data64"`
	NotFound bool   `json:"notfound,omitempty"`
	ModTs    int64  `json:"modts,omitempty"`
}

type CommandWriteAppFileData struct {
	AppId    string `json:"appid"`
	FileName string `json:"filename"`
	Data64   string `json:"data64"`
}

type CommandWriteAppGoFileData struct {
	AppId  string `json:"appid"`
	Data64 string `json:"data64"`
}

type CommandWriteAppGoFileRtnData struct {
	Data64 string `json:"data64"`
}

type CommandDeleteAppFileData struct {
	AppId    string `json:"appid"`
	FileName string `json:"filename"`
}

type CommandRenameAppFileData struct {
	AppId        string `json:"appid"`
	FromFileName string `json:"fromfilename"`
	ToFileName   string `json:"tofilename"`
}

type CommandWriteAppSecretBindingsData struct {
	AppId    string            `json:"appid"`
	Bindings map[string]string `json:"bindings"`
}

type AppMeta struct {
	Title     string `json:"title"`
	ShortDesc string `json:"shortdesc"`
	Icon      string `json:"icon"`
	IconColor string `json:"iconcolor"`
}

type SecretMeta struct {
	Desc     string `json:"desc"`
	Optional bool   `json:"optional"`
}

type AppManifest struct {
	AppMeta      AppMeta               `json:"appmeta"`
	ConfigSchema map[string]any        `json:"configschema"`
	DataSchema   map[string]any        `json:"dataschema"`
	Secrets      map[string]SecretMeta `json:"secrets"`
}

type CommandCheckGoVersionRtnData struct {
	GoStatus    string `json:"gostatus"`
	GoPath      string `json:"gopath"`
	GoVersion   string `json:"goversion"`
	ErrorString string `json:"errorstring,omitempty"`
}

type CommandPublishAppData struct {
	AppId string `json:"appid"`
}

type CommandPublishAppRtnData struct {
	PublishedAppId string `json:"publishedappid"`
}

type CommandMakeDraftFromLocalData struct {
	LocalAppId string `json:"localappid"`
}

type CommandMakeDraftFromLocalRtnData struct {
	DraftAppId string `json:"draftappid"`
}
