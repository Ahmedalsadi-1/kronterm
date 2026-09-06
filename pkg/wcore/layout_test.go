// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package wcore

import (
	"testing"

	"github.com/wavetermdev/waveterm/pkg/waveobj"
)

func TestDefaultLayoutsOpenBrowser(t *testing.T) {
	for name, layout := range map[string]PortableLayout{
		"starter": GetStarterLayout(),
		"new tab": GetNewTabLayout(),
	} {
		if len(layout) != 1 {
			t.Fatalf("%s layout has %d blocks, want 1", name, len(layout))
		}
		if got := layout[0].BlockDef.Meta[waveobj.MetaKey_View]; got != "web" {
			t.Fatalf("%s layout opens %v, want web", name, got)
		}
		if !layout[0].Focused {
			t.Fatalf("%s browser is not focused", name)
		}
	}
}
