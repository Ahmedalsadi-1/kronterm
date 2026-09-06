// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package toolregistry

type Manifest struct {
	Capabilities []Capability
}

type Scorecard struct {
	Total          int
	ByPack         map[ToolPack]int
	BySource       map[ToolSource]int
	ByRisk         map[ToolRisk]int
	ByAvailability map[ToolAvailability]int
	ByVerification map[ToolVerification]int
}

type Summary struct {
	Manifest  Manifest
	Scorecard Scorecard
}

func (r *Registry) Manifest() Manifest {
	return Manifest{
		Capabilities: r.List(),
	}
}

func (r *Registry) Scorecard() Scorecard {
	capabilities := r.List()
	scorecard := Scorecard{
		Total:          len(capabilities),
		ByPack:         make(map[ToolPack]int),
		BySource:       make(map[ToolSource]int),
		ByRisk:         make(map[ToolRisk]int),
		ByAvailability: make(map[ToolAvailability]int),
		ByVerification: make(map[ToolVerification]int),
	}

	for _, capability := range capabilities {
		scorecard.BySource[capability.Source]++
		scorecard.ByRisk[capability.Risk]++
		scorecard.ByAvailability[capability.Availability]++
		scorecard.ByVerification[capability.Verification]++
		for _, pack := range capability.Packs {
			scorecard.ByPack[pack]++
		}
	}

	return scorecard
}

func (r *Registry) Summary() Summary {
	return Summary{
		Manifest:  r.Manifest(),
		Scorecard: r.Scorecard(),
	}
}
