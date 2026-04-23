// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package aiusechat

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"

	"github.com/wavetermdev/waveterm/pkg/aiusechat/aiutil"
	"github.com/wavetermdev/waveterm/pkg/aiusechat/uctypes"
	"github.com/wavetermdev/waveterm/pkg/waveobj"
)

type KronosModeSnapshot struct {
	Mode               string                         `json:"mode"`
	Endpoint           string                         `json:"endpoint,omitempty"`
	Model              string                         `json:"model,omitempty"`
	Agent              string                         `json:"agent,omitempty"`
	ToolRouting        string                         `json:"toolRouting,omitempty"`
	PermissionMode     string                         `json:"permissionMode,omitempty"`
	AuthConfigured     bool                           `json:"authConfigured"`
	Connected          bool                           `json:"connected"`
	SelectedProviderID string                         `json:"selectedProviderId,omitempty"`
	SelectedModelID    string                         `json:"selectedModelId,omitempty"`
	Providers          []KronosProviderSnapshot       `json:"providers,omitempty"`
	ToolCapabilities   []KronosToolCapabilitySnapshot `json:"toolCapabilities,omitempty"`
	SelectedTools      []KronosToolDefinitionSnapshot `json:"selectedTools,omitempty"`
	Errors             []string                       `json:"errors,omitempty"`
}

type KronosProviderSnapshot struct {
	ID             string                `json:"id"`
	Name           string                `json:"name"`
	Connected      bool                  `json:"connected"`
	DefaultModelID string                `json:"defaultModelId,omitempty"`
	Models         []KronosModelSnapshot `json:"models,omitempty"`
}

type KronosModelSnapshot struct {
	ID               string   `json:"id"`
	Name             string   `json:"name,omitempty"`
	ToolCall         bool     `json:"toolCall"`
	Reasoning        bool     `json:"reasoning"`
	Attachment       bool     `json:"attachment"`
	Status           string   `json:"status,omitempty"`
	InputModalities  []string `json:"inputModalities,omitempty"`
	OutputModalities []string `json:"outputModalities,omitempty"`
}

type KronosToolCapabilitySnapshot struct {
	ID          string   `json:"id"`
	Connector   string   `json:"connector,omitempty"`
	RiskLevel   string   `json:"riskLevel,omitempty"`
	Interactive bool     `json:"interactive"`
	Fallback    []string `json:"fallback,omitempty"`
}

type KronosToolDefinitionSnapshot struct {
	ID          string         `json:"id"`
	Description string         `json:"description,omitempty"`
	Connector   string         `json:"connector,omitempty"`
	RiskLevel   string         `json:"riskLevel,omitempty"`
	Interactive bool           `json:"interactive"`
	Fallback    []string       `json:"fallback,omitempty"`
	Parameters  map[string]any `json:"parameters,omitempty"`
}

type kronosProviderListResponse struct {
	All       []kronosProviderInfo `json:"all"`
	Default   map[string]string    `json:"default"`
	Connected []string             `json:"connected"`
}

type kronosProviderInfo struct {
	ID     string                     `json:"id"`
	Name   string                     `json:"name"`
	Models map[string]kronosModelInfo `json:"models"`
}

type kronosModelInfo struct {
	ID           string                    `json:"id"`
	Name         string                    `json:"name"`
	Capabilities kronosModelCapabilityInfo `json:"capabilities"`
	Status       string                    `json:"status,omitempty"`
}

type kronosModelCapabilityInfo struct {
	Reasoning  bool                    `json:"reasoning"`
	Attachment bool                    `json:"attachment"`
	ToolCall   bool                    `json:"toolcall"`
	Input      kronosModelModalityInfo `json:"input"`
	Output     kronosModelModalityInfo `json:"output"`
}

type kronosModelModalityInfo struct {
	Text  bool `json:"text"`
	Audio bool `json:"audio"`
	Image bool `json:"image"`
	Video bool `json:"video"`
	PDF   bool `json:"pdf"`
}

type kronosToolCapabilityInfo struct {
	ID          string   `json:"id"`
	Connector   string   `json:"connector"`
	RiskLevel   string   `json:"risk_level"`
	Interactive bool     `json:"interactive"`
	Fallback    []string `json:"fallback"`
}

type kronosToolDefinitionInfo struct {
	ID          string         `json:"id"`
	Description string         `json:"description"`
	Parameters  map[string]any `json:"parameters"`
	Connector   string         `json:"connector"`
	RiskLevel   string         `json:"risk_level"`
	Interactive bool           `json:"interactive"`
	Fallback    []string       `json:"fallback"`
}

func GetKronosModeSnapshot(ctx context.Context, aiMode string) (*KronosModeSnapshot, error) {
	config, err := getAIModeConfig(aiMode)
	if err != nil {
		return nil, err
	}
	if config.Provider != uctypes.AIProvider_Kronos {
		return nil, fmt.Errorf("AI mode %q is not configured for Kronos", aiMode)
	}

	apiToken, authConfigured, tokenErr := resolveConfiguredAPIToken(*config, false)
	snapshot := &KronosModeSnapshot{
		Mode:           aiMode,
		Endpoint:       config.Endpoint,
		Model:          config.Model,
		Agent:          config.Agent,
		ToolRouting:    config.KronosToolRouting,
		PermissionMode: config.KronosPermissionMode,
		AuthConfigured: authConfigured,
	}
	if providerID, modelID, ok := parseKronosModel(config.Model); ok {
		snapshot.SelectedProviderID = providerID
		snapshot.SelectedModelID = modelID
	} else if strings.TrimSpace(config.Model) != "" {
		snapshot.Errors = append(snapshot.Errors, fmt.Sprintf("Configured model %q must use provider/model format.", config.Model))
	}
	if tokenErr != nil {
		snapshot.Errors = append(snapshot.Errors, tokenErr.Error())
	}

	// Reuse the normal AI-mode resolution path so local proxy/prod settings stay consistent.
	_, aiOptsErr := getWaveAISettings(shouldUsePremium(), false, waveobj.ObjRTInfo{}, aiMode)
	if aiOptsErr != nil {
		snapshot.Errors = append(snapshot.Errors, aiOptsErr.Error())
	}

	httpClient, err := aiutil.MakeHTTPClient(config.ProxyURL)
	if err != nil {
		snapshot.Errors = append(snapshot.Errors, err.Error())
		return snapshot, nil
	}

	var providersResp kronosProviderListResponse
	if err := doKronosJSON(ctx, httpClient, config.Endpoint, apiToken, http.MethodGet, "/provider", nil, &providersResp); err != nil {
		snapshot.Errors = append(snapshot.Errors, err.Error())
		return snapshot, nil
	}
	snapshot.Connected = true
	snapshot.Providers = makeKronosProviderSnapshots(providersResp)

	var toolCapabilities []kronosToolCapabilityInfo
	if err := doKronosJSON(ctx, httpClient, config.Endpoint, apiToken, http.MethodGet, "/experimental/tool/capabilities", nil, &toolCapabilities); err != nil {
		snapshot.Errors = append(snapshot.Errors, err.Error())
	} else {
		snapshot.ToolCapabilities = makeKronosToolCapabilitySnapshots(toolCapabilities)
	}

	if snapshot.SelectedProviderID != "" && snapshot.SelectedModelID != "" {
		path := fmt.Sprintf(
			"/experimental/tool?provider=%s&model=%s",
			url.QueryEscape(snapshot.SelectedProviderID),
			url.QueryEscape(snapshot.SelectedModelID),
		)
		var selectedTools []kronosToolDefinitionInfo
		if err := doKronosJSON(ctx, httpClient, config.Endpoint, apiToken, http.MethodGet, path, nil, &selectedTools); err != nil {
			snapshot.Errors = append(snapshot.Errors, err.Error())
		} else {
			snapshot.SelectedTools = makeKronosToolDefinitionSnapshots(selectedTools)
		}
	}

	return snapshot, nil
}

func makeKronosProviderSnapshots(resp kronosProviderListResponse) []KronosProviderSnapshot {
	connectedSet := make(map[string]bool)
	for _, providerID := range resp.Connected {
		connectedSet[providerID] = true
	}
	providers := make([]KronosProviderSnapshot, 0, len(resp.All))
	for _, provider := range resp.All {
		models := make([]KronosModelSnapshot, 0, len(provider.Models))
		for modelID, model := range provider.Models {
			resolvedID := strings.TrimSpace(model.ID)
			if resolvedID == "" {
				resolvedID = modelID
			}
			models = append(models, KronosModelSnapshot{
				ID:               resolvedID,
				Name:             strings.TrimSpace(model.Name),
				ToolCall:         model.Capabilities.ToolCall,
				Reasoning:        model.Capabilities.Reasoning,
				Attachment:       model.Capabilities.Attachment,
				Status:           strings.TrimSpace(model.Status),
				InputModalities:  kronosModalitiesToList(model.Capabilities.Input),
				OutputModalities: kronosModalitiesToList(model.Capabilities.Output),
			})
		}
		sort.Slice(models, func(i, j int) bool {
			left := models[i].Name
			if left == "" {
				left = models[i].ID
			}
			right := models[j].Name
			if right == "" {
				right = models[j].ID
			}
			return strings.ToLower(left) < strings.ToLower(right)
		})
		providers = append(providers, KronosProviderSnapshot{
			ID:             provider.ID,
			Name:           provider.Name,
			Connected:      connectedSet[provider.ID],
			DefaultModelID: strings.TrimSpace(resp.Default[provider.ID]),
			Models:         models,
		})
	}
	sort.Slice(providers, func(i, j int) bool {
		left := providers[i].Name
		if left == "" {
			left = providers[i].ID
		}
		right := providers[j].Name
		if right == "" {
			right = providers[j].ID
		}
		return strings.ToLower(left) < strings.ToLower(right)
	})
	return providers
}

func makeKronosToolCapabilitySnapshots(items []kronosToolCapabilityInfo) []KronosToolCapabilitySnapshot {
	snapshots := make([]KronosToolCapabilitySnapshot, 0, len(items))
	for _, item := range items {
		snapshots = append(snapshots, KronosToolCapabilitySnapshot{
			ID:          item.ID,
			Connector:   item.Connector,
			RiskLevel:   item.RiskLevel,
			Interactive: item.Interactive,
			Fallback:    item.Fallback,
		})
	}
	sort.Slice(snapshots, func(i, j int) bool {
		return strings.ToLower(snapshots[i].ID) < strings.ToLower(snapshots[j].ID)
	})
	return snapshots
}

func makeKronosToolDefinitionSnapshots(items []kronosToolDefinitionInfo) []KronosToolDefinitionSnapshot {
	snapshots := make([]KronosToolDefinitionSnapshot, 0, len(items))
	for _, item := range items {
		snapshots = append(snapshots, KronosToolDefinitionSnapshot{
			ID:          item.ID,
			Description: item.Description,
			Connector:   item.Connector,
			RiskLevel:   item.RiskLevel,
			Interactive: item.Interactive,
			Fallback:    item.Fallback,
			Parameters:  item.Parameters,
		})
	}
	sort.Slice(snapshots, func(i, j int) bool {
		return strings.ToLower(snapshots[i].ID) < strings.ToLower(snapshots[j].ID)
	})
	return snapshots
}

func kronosModalitiesToList(info kronosModelModalityInfo) []string {
	var modalities []string
	if info.Text {
		modalities = append(modalities, "text")
	}
	if info.Audio {
		modalities = append(modalities, "audio")
	}
	if info.Image {
		modalities = append(modalities, "image")
	}
	if info.Video {
		modalities = append(modalities, "video")
	}
	if info.PDF {
		modalities = append(modalities, "pdf")
	}
	return modalities
}
