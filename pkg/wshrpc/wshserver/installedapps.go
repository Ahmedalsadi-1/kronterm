// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package wshserver

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"

	"github.com/wavetermdev/waveterm/pkg/wshrpc"
)

func (ws *WshServer) ListInstalledAppsCommand(ctx context.Context) ([]wshrpc.InstalledAppInfo, error) {
	switch runtime.GOOS {
	case "darwin":
		return listMacOSApps(ctx)
	case "linux":
		return listLinuxApps(ctx)
	default:
		return []wshrpc.InstalledAppInfo{}, nil
	}
}

func listMacOSApps(ctx context.Context) ([]wshrpc.InstalledAppInfo, error) {
	searchPaths := []struct {
		path   string
		source string
	}{
		{path: "/Applications", source: "Applications"},
		{path: filepath.Join(os.Getenv("HOME"), "Applications"), source: "User Applications"},
		{path: "/System/Applications", source: "macOS"},
		{path: "/System/Applications/Utilities", source: "macOS Utilities"},
	}

	var apps []wshrpc.InstalledAppInfo
	seen := make(map[string]bool)

	for _, searchPath := range searchPaths {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		if _, err := os.Stat(searchPath.path); os.IsNotExist(err) {
			continue
		}

		entries, err := os.ReadDir(searchPath.path)
		if err != nil {
			continue
		}

		for _, entry := range entries {
			if !strings.HasSuffix(entry.Name(), ".app") {
				continue
			}

			appPath := filepath.Join(searchPath.path, entry.Name())
			info := parseMacOSApp(ctx, appPath, searchPath.source)
			if info == nil {
				continue
			}
			if seen[info.BundleId] {
				continue
			}
			seen[info.BundleId] = true
			apps = append(apps, *info)
		}
	}

	sort.Slice(apps, func(i, j int) bool {
		return strings.ToLower(apps[i].Name) < strings.ToLower(apps[j].Name)
	})
	return apps, nil
}

func parseMacOSApp(ctx context.Context, appPath, source string) *wshrpc.InstalledAppInfo {
	plistPath := filepath.Join(appPath, "Contents", "Info.plist")
	if _, err := os.Stat(plistPath); err != nil {
		return nil
	}

	name := strings.TrimSuffix(filepath.Base(appPath), ".app")
	plist := readMacOSAppPlist(ctx, plistPath)
	bundleId := plist.BundleId
	displayName := plist.DisplayName
	category := plist.Category
	iconFile := plist.IconFile

	if displayName != "" {
		name = displayName
	}
	if bundleId == "" {
		bundleId = name
	}

	icon := ""
	if iconFile != "" {
		icon = extractMacOSAppIcon(appPath, iconFile)
	}

	category, description := macOSAppMetadata(name, bundleId, category)
	return &wshrpc.InstalledAppInfo{
		Name:        name,
		AppId:       bundleId,
		ExecPath:    appPath,
		Icon:        icon,
		BundleId:    bundleId,
		Category:    category,
		Source:      source,
		Description: description,
	}
}

type macOSAppPlist struct {
	BundleId    string `json:"CFBundleIdentifier"`
	DisplayName string `json:"CFBundleDisplayName"`
	Category    string `json:"LSApplicationCategoryType"`
	IconFile    string `json:"CFBundleIconFile"`
}

func readMacOSAppPlist(ctx context.Context, plistPath string) macOSAppPlist {
	cmd := exec.CommandContext(ctx, "plutil", "-convert", "json", "-o", "-", plistPath)
	out, err := cmd.Output()
	if err != nil {
		return macOSAppPlist{}
	}
	var plist macOSAppPlist
	if err := json.Unmarshal(out, &plist); err != nil {
		return macOSAppPlist{}
	}
	return plist
}

func extractMacOSAppIcon(appPath, iconFile string) string {
	if iconFile == "" {
		return "cube"
	}
	if !strings.HasSuffix(iconFile, ".icns") {
		iconFile = iconFile + ".icns"
	}

	iconPath := filepath.Join(appPath, "Contents", "Resources", iconFile)
	data, err := os.ReadFile(iconPath)
	if err != nil {
		return "cube"
	}
	if len(data) > 32000 {
		return "cube"
	}
	return "data:image/x-icns;base64," + base64.StdEncoding.EncodeToString(data)
}

func macOSAppMetadata(name, bundleId, category string) (string, string) {
	switch bundleId {
	case "com.browseros.BrowserOS":
		return "Browsers", "Browse with BrowserOS"
	case "com.apple.MobileSMS":
		return "Communication", "Send and receive messages"
	case "com.apple.Preview":
		return "Productivity", "View PDFs and images"
	case "com.googlecode.iterm2":
		return "Developer Tools", "Open an iTerm terminal"
	}

	switch strings.ToLower(name) {
	case "browseros":
		return "Browsers", "Browse with BrowserOS"
	case "iterm", "iterm2":
		return "Developer Tools", "Open an iTerm terminal"
	}

	switch strings.TrimPrefix(category, "public.app-category.") {
	case "developer-tools":
		return "Developer Tools", ""
	case "social-networking":
		return "Communication", ""
	case "utilities":
		return "Utilities", ""
	case "productivity":
		return "Productivity", ""
	case "graphics-design":
		return "Graphics & Design", ""
	case "music":
		return "Music", ""
	case "video":
		return "Video", ""
	case "games":
		return "Games", ""
	}
	return formatMacOSCategory(category), ""
}

func formatMacOSCategory(category string) string {
	category = strings.TrimPrefix(category, "public.app-category.")
	if category == "" {
		return "Other"
	}

	words := strings.Split(category, "-")
	for index, word := range words {
		if word == "" {
			continue
		}
		words[index] = strings.ToUpper(word[:1]) + word[1:]
	}
	return strings.Join(words, " ")
}

func listLinuxApps(ctx context.Context) ([]wshrpc.InstalledAppInfo, error) {
	searchPaths := []string{
		"/usr/share/applications",
		"/usr/local/share/applications",
		filepath.Join(os.Getenv("HOME"), ".local", "share", "applications"),
	}

	var apps []wshrpc.InstalledAppInfo
	seen := make(map[string]bool)

	for _, searchPath := range searchPaths {
		if _, err := os.Stat(searchPath); os.IsNotExist(err) {
			continue
		}

		entries, err := os.ReadDir(searchPath)
		if err != nil {
			continue
		}

		for _, entry := range entries {
			if !strings.HasSuffix(entry.Name(), ".desktop") {
				continue
			}

			desktopPath := filepath.Join(searchPath, entry.Name())
			info := parseDesktopFile(desktopPath)
			if info == nil {
				continue
			}
			if info.NoDisplay {
				continue
			}
			if seen[info.Info.Name+info.Info.ExecPath] {
				continue
			}
			seen[info.Info.Name+info.Info.ExecPath] = true
			apps = append(apps, info.Info)
		}
	}

	return apps, nil
}

type desktopFileResult struct {
	Info      wshrpc.InstalledAppInfo
	NoDisplay bool
}

func parseDesktopFile(desktopPath string) *desktopFileResult {
	data, err := os.ReadFile(desktopPath)
	if err != nil {
		return nil
	}

	content := string(data)
	if !strings.Contains(content, "[Desktop Entry]") {
		return nil
	}

	fields := parseDesktopContent(content)

	appType := fields["Type"]
	if appType != "Application" {
		return nil
	}

	name := fields["Name"]
	if name == "" {
		return nil
	}

	exec := fields["Exec"]
	if exec == "" {
		return nil
	}
	exec = strings.Fields(exec)[0]

	icon := fields["Icon"]
	if icon == "" {
		icon = "cube"
	}

	categories := fields["Categories"]
	comment := fields["Comment"]
	genericName := fields["GenericName"]
	noDisplay := fields["NoDisplay"] == "true"

	description := comment
	if description == "" {
		description = genericName
	}

	return &desktopFileResult{
		NoDisplay: noDisplay,
		Info: wshrpc.InstalledAppInfo{
			Name:        name,
			ExecPath:    exec,
			Icon:        icon,
			Category:    strings.Split(categories, ";")[0],
			Description: description,
			Source:      "desktop-files",
		},
	}
}

func parseDesktopContent(content string) map[string]string {
	result := make(map[string]string)
	lines := strings.Split(content, "\n")

	inDesktopEntry := false
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "[Desktop Entry]" {
			inDesktopEntry = true
			continue
		}
		if strings.HasPrefix(line, "[") {
			inDesktopEntry = false
			continue
		}
		if !inDesktopEntry {
			continue
		}
		if strings.Contains(line, "=") {
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				key := parts[0]
				if !strings.Contains(key, "[") && !strings.Contains(key, "(") {
					result[key] = parts[1]
				}
			}
		}
	}
	return result
}

func (ws *WshServer) LaunchInstalledAppCommand(ctx context.Context, data wshrpc.CommandLaunchInstalledAppData) error {
	if strings.TrimSpace(data.ExecPath) == "" {
		return fmt.Errorf("application path is required")
	}

	switch runtime.GOOS {
	case "darwin":
		cmd := exec.CommandContext(ctx, "open", "-a", data.ExecPath)
		return cmd.Start()
	case "linux":
		cmd := exec.CommandContext(ctx, "xdg-open", data.ExecPath)
		return cmd.Start()
	default:
		return fmt.Errorf("unsupported platform")
	}
}
