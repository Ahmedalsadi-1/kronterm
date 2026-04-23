// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package aiusechat

import (
	"testing"

	"github.com/wavetermdev/waveterm/pkg/aiusechat/uctypes"
	"github.com/wavetermdev/waveterm/pkg/wconfig"
)

func TestApplyProviderDefaultsGroq(t *testing.T) {
	config := wconfig.AIModeConfigType{
		Provider: uctypes.AIProvider_Groq,
	}
	applyProviderDefaults(&config)
	if config.APIType != uctypes.APIType_OpenAIChat {
		t.Fatalf("expected API type %q, got %q", uctypes.APIType_OpenAIChat, config.APIType)
	}
	if config.Endpoint != GroqChatEndpoint {
		t.Fatalf("expected endpoint %q, got %q", GroqChatEndpoint, config.Endpoint)
	}
	if config.APITokenSecretName != GroqAPITokenSecretName {
		t.Fatalf("expected API token secret name %q, got %q", GroqAPITokenSecretName, config.APITokenSecretName)
	}
}

func TestApplyProviderDefaultsKeepsProxyURL(t *testing.T) {
	config := wconfig.AIModeConfigType{
		Provider: uctypes.AIProvider_OpenAI,
		Model:    "gpt-5-mini",
		ProxyURL: "http://localhost:8080",
	}
	applyProviderDefaults(&config)
	if config.ProxyURL != "http://localhost:8080" {
		t.Fatalf("expected proxy URL to be preserved, got %q", config.ProxyURL)
	}
}

func TestApplyProviderDefaultsKronos(t *testing.T) {
	config := wconfig.AIModeConfigType{
		Provider: uctypes.AIProvider_Kronos,
	}
	applyProviderDefaults(&config)
	if config.APIType != uctypes.APIType_KronosSession {
		t.Fatalf("expected API type %q, got %q", uctypes.APIType_KronosSession, config.APIType)
	}
	if config.Endpoint != KronosSessionEndpoint {
		t.Fatalf("expected endpoint %q, got %q", KronosSessionEndpoint, config.Endpoint)
	}
	if config.APITokenSecretName != KronosServerPasswordSecretName {
		t.Fatalf("expected API token secret name %q, got %q", KronosServerPasswordSecretName, config.APITokenSecretName)
	}
	if config.Agent != "coder" {
		t.Fatalf("expected default agent %q, got %q", "coder", config.Agent)
	}
	if config.KronosToolRouting != "hybrid" {
		t.Fatalf("expected default tool routing %q, got %q", "hybrid", config.KronosToolRouting)
	}
	if config.KronosPermissionMode != "always" {
		t.Fatalf("expected default permission mode %q, got %q", "always", config.KronosPermissionMode)
	}
}
