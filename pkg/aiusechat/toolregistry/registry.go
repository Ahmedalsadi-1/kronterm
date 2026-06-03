// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package toolregistry

import (
	"errors"
	"fmt"
	"sort"
	"sync"
)

var (
	ErrInvalidCapability = errors.New("invalid capability")
	ErrCapabilityExists  = errors.New("capability already registered")
)

type Registry struct {
	mu           sync.RWMutex
	capabilities map[string]Capability
}

func MakeRegistry() *Registry {
	return &Registry{
		capabilities: make(map[string]Capability),
	}
}

func (r *Registry) Register(capability Capability) error {
	capability = normalizeCapability(capability)
	if err := validateCapability(capability); err != nil {
		return err
	}

	capability = cloneCapability(capability)

	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.capabilities[capability.ID]; exists {
		return fmt.Errorf("%w: %q", ErrCapabilityExists, capability.ID)
	}

	r.capabilities[capability.ID] = capability
	return nil
}

func normalizeCapability(capability Capability) Capability {
	if capability.Availability == "" {
		capability.Availability = ToolAvailabilityUnknown
	}
	if capability.Verification == "" {
		capability.Verification = ToolVerificationResult
	}
	return capability
}

func (r *Registry) Lookup(id string) (Capability, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	capability, exists := r.capabilities[id]
	if !exists {
		return Capability{}, false
	}
	return cloneCapability(capability), true
}

func (r *Registry) List() []Capability {
	r.mu.RLock()
	defer r.mu.RUnlock()

	capabilities := make([]Capability, 0, len(r.capabilities))
	for _, capability := range r.capabilities {
		capabilities = append(capabilities, cloneCapability(capability))
	}
	sortCapabilities(capabilities)
	return capabilities
}

func (r *Registry) ListByPack(pack ToolPack) []Capability {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var capabilities []Capability
	for _, capability := range r.capabilities {
		if hasPack(capability, pack) {
			capabilities = append(capabilities, cloneCapability(capability))
		}
	}
	sortCapabilities(capabilities)
	return capabilities
}

func (r *Registry) ListBySource(source ToolSource) []Capability {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var capabilities []Capability
	for _, capability := range r.capabilities {
		if capability.Source == source {
			capabilities = append(capabilities, cloneCapability(capability))
		}
	}
	sortCapabilities(capabilities)
	return capabilities
}

func (r *Registry) ListByAvailability(availability ToolAvailability) []Capability {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var capabilities []Capability
	for _, capability := range r.capabilities {
		if capability.Availability == availability {
			capabilities = append(capabilities, cloneCapability(capability))
		}
	}
	sortCapabilities(capabilities)
	return capabilities
}

func (r *Registry) ListByConnector(connectorID string) []Capability {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var capabilities []Capability
	for _, capability := range r.capabilities {
		if capability.ConnectorID == connectorID {
			capabilities = append(capabilities, cloneCapability(capability))
		}
	}
	sortCapabilities(capabilities)
	return capabilities
}

func validateCapability(capability Capability) error {
	if capability.ID == "" {
		return fmt.Errorf("%w: id is required", ErrInvalidCapability)
	}
	if capability.Name == "" {
		return fmt.Errorf("%w: name is required", ErrInvalidCapability)
	}
	if capability.Source == "" {
		return fmt.Errorf("%w: source is required", ErrInvalidCapability)
	}
	if capability.Risk == "" {
		return fmt.Errorf("%w: risk is required", ErrInvalidCapability)
	}
	if len(capability.Packs) == 0 {
		return fmt.Errorf("%w: at least one pack is required", ErrInvalidCapability)
	}
	for _, pack := range capability.Packs {
		if pack == "" {
			return fmt.Errorf("%w: pack values cannot be empty", ErrInvalidCapability)
		}
	}
	return nil
}

func cloneCapability(capability Capability) Capability {
	capability.Packs = append([]ToolPack(nil), capability.Packs...)
	capability.FallbackIDs = append([]string(nil), capability.FallbackIDs...)
	return capability
}

func hasPack(capability Capability, pack ToolPack) bool {
	for _, capabilityPack := range capability.Packs {
		if capabilityPack == pack {
			return true
		}
	}
	return false
}

func sortCapabilities(capabilities []Capability) {
	sort.Slice(capabilities, func(i int, j int) bool {
		return capabilities[i].ID < capabilities[j].ID
	})
}
