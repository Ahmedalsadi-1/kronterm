// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package wshserver

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/wavetermdev/waveterm/pkg/wshrpc"
)

func TestScreenshotFromOpenComputerUse(t *testing.T) {
	output := []byte(`{"content":[{"type":"text","text":"state"},{"type":"image","data":"aGVsbG8=","mimeType":"image/png"}],"isError":false}`)
	screenshot, err := screenshotFromOpenComputerUse(output)
	if err != nil {
		t.Fatalf("expected screenshot, got error: %v", err)
	}
	if screenshot != "aGVsbG8=" {
		t.Fatalf("expected image data, got %q", screenshot)
	}
}

func TestScreenshotFromOpenComputerUseRequiresImage(t *testing.T) {
	output := []byte(`{"content":[{"type":"text","text":"state"}],"isError":false}`)
	if _, err := screenshotFromOpenComputerUse(output); err == nil {
		t.Fatal("expected missing screenshot error")
	}
}

func TestAppStreamCorsAllowsRendererRequests(t *testing.T) {
	request := httptest.NewRequest(http.MethodOptions, "/click", nil)
	response := httptest.NewRecorder()
	withAppStreamCors(http.NotFoundHandler()).ServeHTTP(response, request)

	if response.Code != http.StatusNoContent {
		t.Fatalf("expected preflight status %d, got %d", http.StatusNoContent, response.Code)
	}
	if origin := response.Header().Get("Access-Control-Allow-Origin"); origin != "*" {
		t.Fatalf("expected wildcard CORS origin, got %q", origin)
	}
}

func TestAppStreamCalculatorLive(t *testing.T) {
	if os.Getenv("KRON_COMPUTER_USE_LIVE_TEST") != "1" {
		t.Skip("set KRON_COMPUTER_USE_LIVE_TEST=1 to run against the local desktop")
	}

	server := &WshServer{}
	sessionId := fmt.Sprintf("appstream-live-%d", time.Now().UnixNano())
	response, err := server.AppStreamStartCommand(context.Background(), wshrpc.AppStreamStartRequest{
		SessionId: sessionId,
		AppName:   "Calculator",
		BundleId:  "com.apple.calculator",
	})
	if err != nil {
		t.Fatalf("failed to start stream: %v", err)
	}
	defer server.AppStreamStopCommand(context.Background(), wshrpc.AppStreamStopRequest{SessionId: sessionId})

	screenshotResponse, err := http.Get(response.StreamUrl + "/screenshot")
	if err != nil {
		t.Fatalf("failed to fetch stream frame: %v", err)
	}
	defer screenshotResponse.Body.Close()
	var screenshot appStreamScreenshotResponse
	if err := json.NewDecoder(screenshotResponse.Body).Decode(&screenshot); err != nil {
		t.Fatalf("failed to decode stream frame: %v", err)
	}
	if screenshot.Error != "" {
		t.Fatalf("stream frame failed: %s", screenshot.Error)
	}
	if screenshot.Image == "" {
		t.Fatal("expected streamed Calculator screenshot")
	}

	body, err := json.Marshal(appStreamActionRequest{Keys: "Escape"})
	if err != nil {
		t.Fatalf("failed to encode control action: %v", err)
	}
	actionResponse, err := http.Post(response.StreamUrl+"/press_key", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("failed to send control action: %v", err)
	}
	defer actionResponse.Body.Close()
	var action map[string]string
	if err := json.NewDecoder(actionResponse.Body).Decode(&action); err != nil {
		t.Fatalf("failed to decode control action: %v", err)
	}
	if action["status"] != "ok" {
		t.Fatalf("control action failed: %v", action)
	}
}
