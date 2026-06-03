// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package toolregistry

import (
	"errors"
	"reflect"
	"testing"
)

func TestRegisterLookupAndCopyIsolation(t *testing.T) {
	registry := MakeRegistry()
	capability := Capability{
		ID:          "widget_click",
		Name:        "Widget Click",
		Description: "Clicks a widget element.",
		Source:      ToolSourceBuiltin,
		Risk:        ToolRiskWrite,
		Packs:       []ToolPack{ToolPackWidget},
		FallbackIDs: []string{"desktop_click"},
	}

	if err := registry.Register(capability); err != nil {
		t.Fatalf("register capability: %v", err)
	}

	capability.Packs[0] = ToolPackDesktop

	stored, exists := registry.Lookup("widget_click")
	if !exists {
		t.Fatal("expected registered capability")
	}
	if !reflect.DeepEqual(stored.Packs, []ToolPack{ToolPackWidget}) {
		t.Fatalf("expected stored packs to be isolated, got %#v", stored.Packs)
	}

	stored.Packs[0] = ToolPackBrowser
	stored.FallbackIDs[0] = "browser_open"
	storedAgain, _ := registry.Lookup("widget_click")
	if !reflect.DeepEqual(storedAgain.Packs, []ToolPack{ToolPackWidget}) {
		t.Fatalf("expected lookup result to be isolated, got %#v", storedAgain.Packs)
	}
	if !reflect.DeepEqual(storedAgain.FallbackIDs, []string{"desktop_click"}) {
		t.Fatalf("expected fallback ids to be isolated, got %#v", storedAgain.FallbackIDs)
	}
}

func TestRegisterRejectsInvalidAndDuplicateCapabilities(t *testing.T) {
	registry := MakeRegistry()

	if err := registry.Register(Capability{}); !errors.Is(err, ErrInvalidCapability) {
		t.Fatalf("expected invalid capability error, got %v", err)
	}

	capability := makeCapability("term_run", ToolSourceBuiltin, ToolRiskWrite, ToolPackCore)
	if err := registry.Register(capability); err != nil {
		t.Fatalf("register first capability: %v", err)
	}
	if err := registry.Register(capability); !errors.Is(err, ErrCapabilityExists) {
		t.Fatalf("expected duplicate capability error, got %v", err)
	}
}

func TestListByPackAndSourceAreSorted(t *testing.T) {
	registry := MakeRegistry()
	for _, capability := range []Capability{
		makeCapability("widget_click", ToolSourceBuiltin, ToolRiskWrite, ToolPackWidget),
		makeCapability("browser_open", ToolSourcePlugin, ToolRiskWrite, ToolPackBrowser),
		makeCapability("widget_snapshot", ToolSourceBuiltin, ToolRiskRead, ToolPackWidget, ToolPackBrowser),
	} {
		if err := registry.Register(capability); err != nil {
			t.Fatalf("register %q: %v", capability.ID, err)
		}
	}

	if got := capabilityIDs(registry.ListByPack(ToolPackWidget)); !reflect.DeepEqual(got, []string{"widget_click", "widget_snapshot"}) {
		t.Fatalf("unexpected widget pack list: %#v", got)
	}
	if got := capabilityIDs(registry.ListBySource(ToolSourceBuiltin)); !reflect.DeepEqual(got, []string{"widget_click", "widget_snapshot"}) {
		t.Fatalf("unexpected builtin source list: %#v", got)
	}
}

func TestListByAvailabilityAndConnectorAreSorted(t *testing.T) {
	registry := MakeRegistry()
	for _, capability := range []Capability{
		{ID: "mcp:demo:write", Name: "write", Source: ToolSourceMCP, Risk: ToolRiskSensitive, Packs: []ToolPack{ToolPackCore}, Availability: ToolAvailabilityReady, ConnectorID: "demo"},
		{ID: "mcp:demo:read", Name: "read", Source: ToolSourceMCP, Risk: ToolRiskSensitive, Packs: []ToolPack{ToolPackCore}, Availability: ToolAvailabilityOffline, ConnectorID: "demo"},
		{ID: "widget_click", Name: "click", Source: ToolSourceBuiltin, Risk: ToolRiskWrite, Packs: []ToolPack{ToolPackWidget}, Availability: ToolAvailabilityReady},
	} {
		if err := registry.Register(capability); err != nil {
			t.Fatalf("register %q: %v", capability.ID, err)
		}
	}

	if got := capabilityIDs(registry.ListByAvailability(ToolAvailabilityReady)); !reflect.DeepEqual(got, []string{"mcp:demo:write", "widget_click"}) {
		t.Fatalf("unexpected ready list: %#v", got)
	}
	if got := capabilityIDs(registry.ListByConnector("demo")); !reflect.DeepEqual(got, []string{"mcp:demo:read", "mcp:demo:write"}) {
		t.Fatalf("unexpected connector list: %#v", got)
	}
}

func TestSummaryIncludesManifestAndScorecard(t *testing.T) {
	registry := MakeRegistry()
	for _, capability := range []Capability{
		makeCapability("desktop_click", ToolSourceRuntime, ToolRiskSensitive, ToolPackDesktop),
		makeCapability("widget_snapshot", ToolSourceBuiltin, ToolRiskRead, ToolPackWidget, ToolPackBrowser),
		makeCapability("widget_click", ToolSourceBuiltin, ToolRiskWrite, ToolPackWidget),
	} {
		if err := registry.Register(capability); err != nil {
			t.Fatalf("register %q: %v", capability.ID, err)
		}
	}

	summary := registry.Summary()
	if got := capabilityIDs(summary.Manifest.Capabilities); !reflect.DeepEqual(got, []string{"desktop_click", "widget_click", "widget_snapshot"}) {
		t.Fatalf("unexpected manifest order: %#v", got)
	}
	if summary.Scorecard.Total != 3 {
		t.Fatalf("expected total 3, got %d", summary.Scorecard.Total)
	}
	if summary.Scorecard.ByPack[ToolPackWidget] != 2 {
		t.Fatalf("expected 2 widget capabilities, got %d", summary.Scorecard.ByPack[ToolPackWidget])
	}
	if summary.Scorecard.BySource[ToolSourceBuiltin] != 2 {
		t.Fatalf("expected 2 builtin capabilities, got %d", summary.Scorecard.BySource[ToolSourceBuiltin])
	}
	if summary.Scorecard.ByRisk[ToolRiskSensitive] != 1 {
		t.Fatalf("expected 1 sensitive capability, got %d", summary.Scorecard.ByRisk[ToolRiskSensitive])
	}
	if summary.Scorecard.ByAvailability[ToolAvailabilityUnknown] != 3 {
		t.Fatalf("expected 3 unknown availability capabilities, got %d", summary.Scorecard.ByAvailability[ToolAvailabilityUnknown])
	}
	if summary.Scorecard.ByVerification[ToolVerificationResult] != 3 {
		t.Fatalf("expected 3 result verification capabilities, got %d", summary.Scorecard.ByVerification[ToolVerificationResult])
	}
}

func makeCapability(id string, source ToolSource, risk ToolRisk, packs ...ToolPack) Capability {
	return Capability{
		ID:     id,
		Name:   id,
		Source: source,
		Risk:   risk,
		Packs:  packs,
	}
}

func capabilityIDs(capabilities []Capability) []string {
	ids := make([]string, 0, len(capabilities))
	for _, capability := range capabilities {
		ids = append(ids, capability.ID)
	}
	return ids
}
