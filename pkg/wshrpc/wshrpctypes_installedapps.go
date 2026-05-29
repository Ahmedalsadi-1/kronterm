// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package wshrpc

// installed apps types
type InstalledAppInfo struct {
	Name        string `json:"name"`
	AppId       string `json:"appid"`
	Path        string `json:"path"`
	ExecPath    string `json:"execpath,omitempty"`
	Icon        string `json:"icon,omitempty"`
	IconPath    string `json:"iconpath,omitempty"`
	Category    string `json:"category,omitempty"`
	Description string `json:"description,omitempty"`
	Source      string `json:"source"`
	BundleId    string `json:"bundleid,omitempty"`
}

type CommandLaunchInstalledAppData struct {
	AppId     string `json:"appid"`
	ExecPath  string `json:"execpath"`
	Workspace string `json:"workspace"`
	Terminal  bool   `json:"terminal"`
}
