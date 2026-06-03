package wshserver

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"github.com/wavetermdev/waveterm/pkg/wshrpc"
)

type appStreamSession struct {
	server  *http.Server
	cancel  context.CancelFunc
	appName string
	port    int
}

var appStreamSessions sync.Map

func (ws *WshServer) AppStreamStartCommand(ctx context.Context, data wshrpc.AppStreamStartRequest) (wshrpc.AppStreamStartResponse, error) {
	if data.SessionId == "" {
		return wshrpc.AppStreamStartResponse{Status: "error", Error: "sessionId is required"}, fmt.Errorf("sessionId is required")
	}
	appName := data.AppName
	if appName == "" {
		appName = data.BundleId
	}
	if appName == "" {
		appName = "Unknown"
	}
	if _, loaded := appStreamSessions.Load(data.SessionId); loaded {
		return wshrpc.AppStreamStartResponse{
			Status: "error",
			Error:  fmt.Sprintf("session %s is already running", data.SessionId),
		}, fmt.Errorf("session %s already running", data.SessionId)
	}
	launchCmd := exec.CommandContext(ctx, "open", "-a", appName)
	if err := launchCmd.Start(); err != nil {
		return wshrpc.AppStreamStartResponse{
			Status: "error",
			Error:  fmt.Sprintf("failed to launch app: %v", err),
		}, fmt.Errorf("failed to launch app %q: %w", appName, err)
	}
	go func() {
		launchCmd.Wait()
	}()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return wshrpc.AppStreamStartResponse{
			Status: "error",
			Error:  fmt.Sprintf("failed to find available port: %v", err),
		}, fmt.Errorf("failed to listen: %w", err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	streamCtx, cancel := context.WithCancel(context.Background())
	mux := http.NewServeMux()
	mux.HandleFunc("/screenshot", func(w http.ResponseWriter, r *http.Request) {
		handleAppStreamScreenshot(streamCtx, appName, w)
	})
	mux.HandleFunc("/click", func(w http.ResponseWriter, r *http.Request) {
		handleAppStreamClick(streamCtx, appName, w, r)
	})
	mux.HandleFunc("/type", func(w http.ResponseWriter, r *http.Request) {
		handleAppStreamType(streamCtx, appName, w, r)
	})
	mux.HandleFunc("/press_key", func(w http.ResponseWriter, r *http.Request) {
		handleAppStreamPressKey(streamCtx, appName, w, r)
	})
	mux.HandleFunc("/scroll", func(w http.ResponseWriter, r *http.Request) {
		handleAppStreamScroll(streamCtx, appName, w, r)
	})
	server := &http.Server{
		Handler: withAppStreamCors(mux),
	}
	appStreamSessions.Store(data.SessionId, &appStreamSession{
		server:  server,
		cancel:  cancel,
		appName: appName,
		port:    port,
	})
	go func() {
		if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
			log.Printf("[appstream] server error for session %s: %v", data.SessionId, err)
		}
	}()
	go func() {
		<-streamCtx.Done()
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer shutdownCancel()
		server.Shutdown(shutdownCtx)
		listener.Close()
		appStreamSessions.Delete(data.SessionId)
	}()
	streamUrl := fmt.Sprintf("http://127.0.0.1:%d", port)
	return wshrpc.AppStreamStartResponse{
		SessionId: data.SessionId,
		StreamUrl: streamUrl,
		Status:    "running",
	}, nil
}

func withAppStreamCors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (ws *WshServer) AppStreamStopCommand(ctx context.Context, data wshrpc.AppStreamStopRequest) error {
	if data.SessionId == "" {
		return fmt.Errorf("sessionId is required")
	}
	sessionVal, ok := appStreamSessions.Load(data.SessionId)
	if !ok {
		return nil
	}
	session := sessionVal.(*appStreamSession)
	session.cancel()
	return nil
}

func (ws *WshServer) AppStreamActionCommand(ctx context.Context, data wshrpc.AppStreamActionRequest) error {
	if data.SessionId == "" {
		return fmt.Errorf("sessionId is required")
	}
	sessionVal, ok := appStreamSessions.Load(data.SessionId)
	if !ok {
		return fmt.Errorf("session %s not found", data.SessionId)
	}
	session := sessionVal.(*appStreamSession)
	streamUrl := fmt.Sprintf("http://127.0.0.1:%d", session.port)
	switch data.Action {
	case "click":
		body, _ := json.Marshal(map[string]interface{}{
			"x":      data.X,
			"y":      data.Y,
			"button": data.Button,
		})
		http.Post(streamUrl+"/click", "application/json", bytes.NewReader(body))
	case "type":
		body, _ := json.Marshal(map[string]interface{}{
			"text": data.Text,
		})
		http.Post(streamUrl+"/type", "application/json", bytes.NewReader(body))
	case "press_key":
		body, _ := json.Marshal(map[string]interface{}{
			"keys": data.Keys,
		})
		http.Post(streamUrl+"/press_key", "application/json", bytes.NewReader(body))
	case "scroll":
		body, _ := json.Marshal(map[string]interface{}{
			"direction":   data.Direction,
			"scrollCount": data.ScrollCount,
		})
		http.Post(streamUrl+"/scroll", "application/json", bytes.NewReader(body))
	}
	return nil
}

type appStreamScreenshotResponse struct {
	Image string `json:"image,omitempty"`
	Error string `json:"error,omitempty"`
}

func callOpenComputerUse(ctx context.Context, args ...string) ([]byte, error) {
	cmd := exec.CommandContext(ctx, resolveOpenComputerUseBin(), args...)
	output, err := cmd.Output()
	if err != nil {
		if exitErr, ok := err.(*exec.ExitError); ok {
			return nil, fmt.Errorf("open-computer-use failed: %w, stderr: %s", err, string(exitErr.Stderr))
		}
		return nil, fmt.Errorf("open-computer-use failed: %w", err)
	}
	return output, nil
}

func resolveOpenComputerUseBin() string {
	if configured := os.Getenv("KRON_COMPUTER_USE_BIN"); configured != "" {
		return configured
	}
	if resolved, err := exec.LookPath("open-computer-use"); err == nil {
		return resolved
	}
	versionsDir := filepath.Join(os.Getenv("HOME"), ".nvm", "versions", "node")
	versions, err := os.ReadDir(versionsDir)
	if err == nil {
		sort.Slice(versions, func(i, j int) bool {
			return versions[i].Name() > versions[j].Name()
		})
		for _, version := range versions {
			binary := filepath.Join(versionsDir, version.Name(), "bin", "open-computer-use")
			if info, err := os.Stat(binary); err == nil && info.Mode()&0111 != 0 {
				return binary
			}
		}
	}
	return "open-computer-use"
}

func callOpenComputerUseTool(ctx context.Context, tool string, args map[string]any) ([]byte, error) {
	if len(args) == 0 {
		output, err := callOpenComputerUse(ctx, "call", tool)
		return output, openComputerUseResultError(output, err)
	}
	argsJSON, err := json.Marshal(args)
	if err != nil {
		return nil, fmt.Errorf("failed to encode %s args: %w", tool, err)
	}
	output, err := callOpenComputerUse(ctx, "call", tool, "--args", string(argsJSON))
	return output, openComputerUseResultError(output, err)
}

func openComputerUseResultError(output []byte, callErr error) error {
	if callErr != nil {
		return callErr
	}
	var result struct {
		Content []struct {
			Type string `json:"type"`
			Text string `json:"text"`
		} `json:"content"`
		IsError bool `json:"isError"`
	}
	if err := json.Unmarshal(output, &result); err != nil || !result.IsError {
		return nil
	}
	for _, content := range result.Content {
		if content.Type == "text" && content.Text != "" {
			return fmt.Errorf("open-computer-use returned an error: %s", content.Text)
		}
	}
	return fmt.Errorf("open-computer-use returned an error")
}

func screenshotFromOpenComputerUse(output []byte) (string, error) {
	var result struct {
		Content []struct {
			Type string `json:"type"`
			Data string `json:"data"`
		} `json:"content"`
		IsError bool `json:"isError"`
	}
	if err := json.Unmarshal(output, &result); err != nil {
		return "", fmt.Errorf("failed to parse output: %w", err)
	}
	if result.IsError {
		return "", fmt.Errorf("open-computer-use returned an error")
	}
	for _, content := range result.Content {
		if content.Type == "image" && content.Data != "" {
			return content.Data, nil
		}
	}
	return "", fmt.Errorf("no screenshot in response")
}

func handleAppStreamScreenshot(ctx context.Context, appName string, w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	callCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	output, err := callOpenComputerUseTool(callCtx, "get_app_state", map[string]any{"app": appName})
	if err != nil {
		resp := appStreamScreenshotResponse{Error: err.Error()}
		json.NewEncoder(w).Encode(resp)
		return
	}
	screenshot, err := screenshotFromOpenComputerUse(output)
	if err != nil {
		resp := appStreamScreenshotResponse{Error: err.Error()}
		json.NewEncoder(w).Encode(resp)
		return
	}
	json.NewEncoder(w).Encode(appStreamScreenshotResponse{Image: screenshot})
}

type appStreamActionRequest struct {
	X           int    `json:"x,omitempty"`
	Y           int    `json:"y,omitempty"`
	Button      string `json:"button,omitempty"`
	Text        string `json:"text,omitempty"`
	Keys        string `json:"keys,omitempty"`
	Direction   string `json:"direction,omitempty"`
	ScrollCount int    `json:"scrollCount,omitempty"`
}

func readActionBody(r *http.Request) ([]byte, error) {
	data, err := io.ReadAll(r.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read body: %w", err)
	}
	return data, nil
}

func handleAppStreamClick(ctx context.Context, appName string, w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	body, err := readActionBody(r)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	var req appStreamActionRequest
	if err := json.Unmarshal(body, &req); err != nil {
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid JSON"})
		return
	}
	args := map[string]any{"app": appName, "x": req.X, "y": req.Y}
	if req.Button != "" && req.Button != "left" {
		args["mouse_button"] = req.Button
	}
	callCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if _, err := callOpenComputerUseTool(callCtx, "click", args); err != nil {
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func handleAppStreamType(ctx context.Context, appName string, w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	body, err := readActionBody(r)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	var req appStreamActionRequest
	if err := json.Unmarshal(body, &req); err != nil {
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid JSON"})
		return
	}
	callCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if _, err := callOpenComputerUseTool(callCtx, "type_text", map[string]any{"app": appName, "text": req.Text}); err != nil {
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func handleAppStreamPressKey(ctx context.Context, appName string, w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	body, err := readActionBody(r)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	var req appStreamActionRequest
	if err := json.Unmarshal(body, &req); err != nil {
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid JSON"})
		return
	}
	keys := req.Keys
	if keys == "" {
		keys = "Enter"
	}
	callCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	if _, err := callOpenComputerUseTool(callCtx, "press_key", map[string]any{"app": appName, "key": keys}); err != nil {
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func handleAppStreamScroll(ctx context.Context, appName string, w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	body, err := readActionBody(r)
	if err != nil {
		json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}
	var req appStreamActionRequest
	if err := json.Unmarshal(body, &req); err != nil {
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid JSON"})
		return
	}
	direction := req.Direction
	if direction == "" {
		direction = "down"
	}
	scrollCount := req.ScrollCount
	if scrollCount <= 0 {
		scrollCount = 3
	}
	callCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	key := map[string]string{"up": "Page_Up", "down": "Page_Down", "left": "Left", "right": "Right"}[direction]
	if key == "" {
		json.NewEncoder(w).Encode(map[string]string{"error": fmt.Sprintf("unsupported scroll direction %q", direction)})
		return
	}
	for range scrollCount {
		if _, err := callOpenComputerUseTool(callCtx, "press_key", map[string]any{"app": appName, "key": key}); err != nil {
			json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
			return
		}
	}
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
