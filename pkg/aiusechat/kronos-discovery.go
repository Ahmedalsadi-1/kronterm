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
	"github.com/wavetermdev/waveterm/pkg/waveobj"
)

type KronosModeSnapshot struct {
	Mode                string                            `json:"mode"`
	Endpoint            string                            `json:"endpoint,omitempty"`
	Model               string                            `json:"model,omitempty"`
	Agent               string                            `json:"agent,omitempty"`
	ToolRouting         string                            `json:"toolRouting,omitempty"`
	PermissionMode      string                            `json:"permissionMode,omitempty"`
	AuthConfigured      bool                              `json:"authConfigured"`
	Connected           bool                              `json:"connected"`
	SelectedProviderID  string                            `json:"selectedProviderId,omitempty"`
	SelectedModelID     string                            `json:"selectedModelId,omitempty"`
	NativeWaveConnector KronosNativeWaveConnectorSnapshot `json:"nativeWaveConnector"`
	Providers           []KronosProviderSnapshot          `json:"providers,omitempty"`
	ToolCapabilities    []KronosToolCapabilitySnapshot    `json:"toolCapabilities,omitempty"`
	SelectedTools       []KronosToolDefinitionSnapshot    `json:"selectedTools,omitempty"`
	Errors              []string                          `json:"errors,omitempty"`
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

type KronosNativeWaveConnectorSnapshot struct {
	Available bool   `json:"available"`
	Connector string `json:"connector,omitempty"`
	Status    string `json:"status"`
	Reason    string `json:"reason,omitempty"`
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
	if !isKronosAIConfig(config) {
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
		NativeWaveConnector: KronosNativeWaveConnectorSnapshot{
			Status: "xml-bridge",
			Reason: "Kronos has not exposed a native Wave connector yet.",
		},
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
	_, aiOptsErr := getWaveAISettings(shouldUsePremium(), waveobj.ObjRTInfo{}, aiMode)
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
	snapshot.NativeWaveConnector = detectKronosNativeWaveConnector(snapshot.ToolCapabilities, snapshot.SelectedTools)

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

func detectKronosNativeWaveConnector(capabilities []KronosToolCapabilitySnapshot, tools []KronosToolDefinitionSnapshot) KronosNativeWaveConnectorSnapshot {
	for _, capability := range capabilities {
		if isKronosNativeWaveConnectorRef(capability.ID, capability.Connector) {
			return KronosNativeWaveConnectorSnapshot{
				Available: true,
				Connector: firstNonEmpty(capability.Connector, capability.ID),
				Status:    "native-ready",
			}
		}
	}
	for _, tool := range tools {
		if isKronosNativeWaveConnectorRef(tool.ID, tool.Connector) {
			return KronosNativeWaveConnectorSnapshot{
				Available: true,
				Connector: firstNonEmpty(tool.Connector, tool.ID),
				Status:    "native-ready",
			}
		}
	}
	return KronosNativeWaveConnectorSnapshot{
		Status: "xml-bridge",
		Reason: "Kronos has not exposed a native Wave connector yet.",
	}
}

func isKronosNativeWaveConnectorRef(values ...string) bool {
	for _, value := range values {
		normalized := strings.ToLower(strings.TrimSpace(value))
		if normalized == "" {
			continue
		}
		if normalized == "wave" || strings.Contains(normalized, "waveterm") || strings.Contains(normalized, "kronterm") || strings.Contains(normalized, "wave-native") {
			return true
		}
	}
	return false
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
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

type KronosCatalogInstallSnapshot struct {
	Manager string   `json:"manager,omitempty"`
	Command []string `json:"command,omitempty"`
	Note    string   `json:"note,omitempty"`
	DocsURL string   `json:"docsUrl,omitempty"`
}

type KronosCatalogAgentSnapshot struct {
	ID             string                        `json:"id"`
	Name           string                        `json:"name"`
	Kind           string                        `json:"kind"`
	Status         string                        `json:"status"`
	Available      bool                          `json:"available"`
	Icon           string                        `json:"icon,omitempty"`
	CLICommand     string                        `json:"cliCommand,omitempty"`
	DefaultCLIPath string                        `json:"defaultCliPath,omitempty"`
	ACPArgs        []string                      `json:"acpArgs,omitempty"`
	SkillsDirs     []string                      `json:"skillsDirs,omitempty"`
	AuthRequired   bool                          `json:"authRequired,omitempty"`
	Install        *KronosCatalogInstallSnapshot `json:"install,omitempty"`
	Description    string                        `json:"description,omitempty"`
	Reason         string                        `json:"reason,omitempty"`
}

type KronosCatalogResponseSnapshot struct {
	GeneratedAt int64                        `json:"generatedAt"`
	Agents      []KronosCatalogAgentSnapshot `json:"agents"`
}

type KronosBytebotStatusSnapshot struct {
	MCPURL        string `json:"mcpUrl"`
	DesktopURL    string `json:"desktopUrl"`
	MCPStatus     string `json:"mcpStatus"`
	DesktopStatus string `json:"desktopStatus"`
	Error         string `json:"error,omitempty"`
}

type KronosChatHubSnapshot struct {
	Mode    string                         `json:"mode"`
	Catalog *KronosCatalogResponseSnapshot `json:"catalog,omitempty"`
	Kronos  *KronosModeSnapshot            `json:"kronos,omitempty"`
	Bytebot KronosBytebotStatusSnapshot    `json:"bytebot"`
	Errors  []string                       `json:"errors,omitempty"`
}

type KronosAgentInstallResult struct {
	Success bool                       `json:"success"`
	Output  string                     `json:"output,omitempty"`
	Agent   KronosCatalogAgentSnapshot `json:"agent,omitempty"`
}

const defaultBytebotMCPURL = "http://localhost:9990/mcp"
const defaultBytebotDesktopURL = "http://localhost:9990/novnc/vnc_lite.html?scale=true"

func checkHTTPReady(ctx context.Context, target string) (string, string) {
	if strings.TrimSpace(target) == "" {
		return "missing", "missing URL"
	}
	ctx, cancel := context.WithTimeout(ctx, 3_000_000_000)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return "error", err.Error()
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "error", err.Error()
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 200 && resp.StatusCode < 400 {
		return "connected", ""
	}
	return "error", resp.Status
}

func GetKronosChatHubSnapshot(ctx context.Context, aiMode string) (*KronosChatHubSnapshot, error) {
	if strings.TrimSpace(aiMode) == "" {
		return nil, fmt.Errorf("mode parameter is required")
	}
	config, err := getAIModeConfig(aiMode)
	if err != nil {
		return nil, err
	}
	if !isKronosAIConfig(config) {
		return nil, fmt.Errorf("AI mode %q is not configured for Kronos", aiMode)
	}
	apiToken, _, tokenErr := resolveConfiguredAPIToken(*config, false)
	client, clientErr := aiutil.MakeHTTPClient(config.ProxyURL)

	mcpStatus, mcpErr := checkHTTPReady(ctx, defaultBytebotMCPURL)
	desktopStatus, desktopErr := checkHTTPReady(ctx, defaultBytebotDesktopURL)
	snapshot := &KronosChatHubSnapshot{
		Mode: aiMode,
		Bytebot: KronosBytebotStatusSnapshot{
			MCPURL:        defaultBytebotMCPURL,
			DesktopURL:    defaultBytebotDesktopURL,
			MCPStatus:     mcpStatus,
			DesktopStatus: desktopStatus,
		},
	}
	if mcpErr != "" {
		snapshot.Bytebot.Error = mcpErr
	}
	if snapshot.Bytebot.Error == "" && desktopErr != "" {
		snapshot.Bytebot.Error = desktopErr
	}
	if tokenErr != nil {
		snapshot.Errors = append(snapshot.Errors, tokenErr.Error())
	}
	if clientErr != nil {
		snapshot.Errors = append(snapshot.Errors, clientErr.Error())
		return snapshot, nil
	}
	var catalog KronosCatalogResponseSnapshot
	if err := doKronosJSON(ctx, client, config.Endpoint, apiToken, http.MethodGet, "/agent/catalog", nil, &catalog); err != nil {
		snapshot.Errors = append(snapshot.Errors, err.Error())
	} else {
		snapshot.Catalog = &catalog
	}
	kronosSnapshot, err := GetKronosModeSnapshot(ctx, aiMode)
	if err != nil {
		snapshot.Errors = append(snapshot.Errors, err.Error())
	} else {
		snapshot.Kronos = kronosSnapshot
	}
	return snapshot, nil
}

func InstallKronosCatalogAgent(ctx context.Context, aiMode string, id string) (*KronosAgentInstallResult, error) {
	config, err := getAIModeConfig(aiMode)
	if err != nil {
		return nil, err
	}
	if !isKronosAIConfig(config) {
		return nil, fmt.Errorf("AI mode %q is not configured for Kronos", aiMode)
	}
	apiToken, _, tokenErr := resolveConfiguredAPIToken(*config, false)
	if tokenErr != nil {
		return nil, tokenErr
	}
	client, err := aiutil.MakeHTTPClient(config.ProxyURL)
	if err != nil {
		return nil, err
	}
	var result KronosAgentInstallResult
	path := fmt.Sprintf("/agent/catalog/%s/install", url.PathEscape(id))
	if err := doKronosJSON(ctx, client, config.Endpoint, apiToken, http.MethodPost, path, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

func PatchKronosConfig(ctx context.Context, aiMode string, patch map[string]any) (map[string]any, error) {
	config, err := getAIModeConfig(aiMode)
	if err != nil {
		return nil, err
	}
	if !isKronosAIConfig(config) {
		return nil, fmt.Errorf("AI mode %q is not configured for Kronos", aiMode)
	}
	apiToken, _, tokenErr := resolveConfiguredAPIToken(*config, false)
	if tokenErr != nil {
		return nil, tokenErr
	}
	client, err := aiutil.MakeHTTPClient(config.ProxyURL)
	if err != nil {
		return nil, err
	}
	var result map[string]any
	if err := doKronosJSON(ctx, client, config.Endpoint, apiToken, http.MethodPatch, "/config", patch, &result); err != nil {
		return nil, err
	}
	return result, nil
}
