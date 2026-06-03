package cmd

import (
	"net/http"
	"net/http/httptest"
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
