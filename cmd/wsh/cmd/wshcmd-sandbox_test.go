package cmd

import (
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/wavetermdev/waveterm/pkg/wshrpc"
)

func TestSandboxKrontermDesktopActionAcceptsEmptySuccessfulMutationResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/computer-use" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		w.WriteHeader(http.StatusCreated)
	}))
	defer server.Close()

	result, err := sandboxKrontermDesktopAction(
		wshrpc.SandboxStatusResponse{DesktopUrl: server.URL},
		map[string]any{"action": "click_mouse"},
	)
	if err != nil {
		t.Fatalf("expected mutation response to succeed: %v", err)
	}
	resultMap, ok := result.(map[string]any)
	if !ok || resultMap["success"] != true {
		t.Fatalf("expected synthetic success result, got %#v", result)
	}
}

func TestSandboxKrontermDesktopActionPreservesScreenshotResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"image":"pngdata"}`))
	}))
	defer server.Close()

	result, err := sandboxKrontermDesktopAction(
		wshrpc.SandboxStatusResponse{DesktopUrl: server.URL},
		map[string]any{"action": "screenshot"},
	)
	if err != nil {
		t.Fatalf("expected screenshot response to succeed: %v", err)
	}
	resultMap, ok := result.(map[string]any)
	if !ok || resultMap["image"] != "pngdata" {
		t.Fatalf("expected screenshot payload, got %#v", result)
	}
}

func TestSandboxKrontermDesktopActionUsesMcpUrl(t *testing.T) {
	var requestedPath atomic.Value
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestedPath.Store(r.URL.Path)
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	_, err := sandboxKrontermDesktopAction(
		wshrpc.SandboxStatusResponse{DesktopUrl: "http://example.invalid/novnc/vnc_lite.html", McpUrl: server.URL + "/custom-computer-use"},
		map[string]any{"action": "click_mouse"},
	)
	if err != nil {
		t.Fatalf("expected mcpUrl action to succeed: %v", err)
	}
	if path := requestedPath.Load(); path != "/custom-computer-use" {
		t.Fatalf("expected request to mcpUrl path, got %#v", path)
	}
}

func TestSandboxComputerUseURLFromPreviewURL(t *testing.T) {
	computerUseURL, err := sandboxComputerUseURL(wshrpc.SandboxStatusResponse{
		DesktopUrl: "http://localhost:9990/novnc/vnc_lite.html?scale=true",
	})
	if err != nil {
		t.Fatalf("expected preview URL to normalize: %v", err)
	}
	if computerUseURL != "http://localhost:9990/computer-use" {
		t.Fatalf("unexpected computer-use URL: %s", computerUseURL)
	}
}
