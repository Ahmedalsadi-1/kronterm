// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package wshserver

import (
	"context"
	"runtime"
	"testing"
)

func TestListMacOSAppsFindsPreview(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("macOS app discovery requires darwin")
	}

	apps, err := listMacOSApps(context.Background())
	if err != nil {
		t.Fatalf("failed to list installed apps: %v", err)
	}
	if len(apps) == 0 {
		t.Fatal("expected installed apps")
	}
	for _, app := range apps {
		if app.AppId == "" {
			t.Fatalf("expected app id for %q", app.Name)
		}
		if app.BundleId == "com.apple.Preview" {
			if app.AppId != app.BundleId {
				t.Fatalf("expected Preview app id %q, got %q", app.BundleId, app.AppId)
			}
			return
		}
	}
	t.Fatal("expected Preview in installed apps")
}
