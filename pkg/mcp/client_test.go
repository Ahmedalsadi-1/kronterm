package mcp

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
)

type fakeTransport struct {
	calls         []string
	notifications []string
}

func (t *fakeTransport) Connect(ctx context.Context) error {
	t.calls = append(t.calls, "connect")
	return nil
}

func (t *fakeTransport) Send(ctx context.Context, method string, params interface{}) (json.RawMessage, error) {
	t.calls = append(t.calls, method)
	switch method {
	case "initialize":
		return json.RawMessage(`{"protocolVersion":"2025-06-18","capabilities":{"tools":{}},"serverInfo":{"name":"test","version":"1.2.3"}}`), nil
	case "tools/list":
		return json.RawMessage(`{"tools":[{"name":"demo","description":"Demo tool","inputSchema":{"type":"object"}}]}`), nil
	case "tools/call":
		return json.RawMessage(`{"content":[{"type":"text","text":"ok"}]}`), nil
	default:
		return nil, nil
	}
}

func (t *fakeTransport) Notify(ctx context.Context, method string, params interface{}) error {
	t.notifications = append(t.notifications, method)
	return nil
}

func (t *fakeTransport) Close() error {
	t.calls = append(t.calls, "close")
	return nil
}

func TestConnectServerDiscoversTools(t *testing.T) {
	transport := &fakeTransport{}
	manager := &MCPClientManager{Servers: map[string]*MCPServer{
		"test": {
			Name:   "test",
			Config: MCPConfig{Type: "local"},
			Status: ServerStatusDisconnected,
			client: &MCPClient{Name: "test", Transport: transport},
		},
	}}

	if err := manager.ConnectServer(context.Background(), "test"); err != nil {
		t.Fatalf("connect server: %v", err)
	}
	server, ok := manager.GetServer("test")
	if !ok {
		t.Fatal("expected server snapshot")
	}
	if server.Status != ServerStatusConnected {
		t.Fatalf("expected connected status, got %q", server.Status)
	}
	if server.Info == nil || server.Info.Version != "1.2.3" {
		t.Fatalf("expected discovered server info, got %#v", server.Info)
	}
	if len(server.Tools) != 1 || server.Tools[0].Name != "demo" {
		t.Fatalf("expected discovered tools, got %#v", server.Tools)
	}
	if !reflect.DeepEqual(transport.notifications, []string{"notifications/initialized"}) {
		t.Fatalf("expected initialized notification, got %#v", transport.notifications)
	}
}

func TestSyncServersTracksConfiguredHealth(t *testing.T) {
	enabled := true
	disabled := false
	manager := &MCPClientManager{Servers: make(map[string]*MCPServer)}
	if err := manager.SyncServers(map[string]MCPConfig{
		"ready":    {Enabled: &enabled, Type: "local", Command: []string{"demo"}},
		"disabled": {Enabled: &disabled, Type: "local", Command: []string{"demo"}},
	}); err != nil {
		t.Fatalf("sync servers: %v", err)
	}

	if got := manager.ListServers(); !reflect.DeepEqual(got, []string{"disabled", "ready"}) {
		t.Fatalf("expected sorted configured servers, got %#v", got)
	}
	server, ok := manager.GetServer("disabled")
	if !ok || server.Status != ServerStatusDisabled {
		t.Fatalf("expected disabled health, got %#v", server)
	}
}

func TestHTTPTransportTracksStreamableHTTPSession(t *testing.T) {
	var methods []string
	var followupSessionID string
	var followupProtocolVersion string
	var deleteSessionID string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "DELETE" {
			deleteSessionID = r.Header.Get("Mcp-Session-Id")
			w.WriteHeader(http.StatusNoContent)
			return
		}
		body, _ := io.ReadAll(r.Body)
		var request struct {
			Method string `json:"method"`
		}
		_ = json.Unmarshal(body, &request)
		methods = append(methods, request.Method)
		if request.Method == "initialize" {
			w.Header().Set("Mcp-Session-Id", "session-1")
			w.Header().Set("Content-Type", "text/event-stream")
			_, _ = w.Write([]byte("event: message\ndata: {\"jsonrpc\":\"2.0\",\"id\":1,\"result\":{\"protocolVersion\":\"2025-06-18\"}}\n\n"))
			return
		}
		followupSessionID = r.Header.Get("Mcp-Session-Id")
		followupProtocolVersion = r.Header.Get("MCP-Protocol-Version")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"jsonrpc":"2.0","id":1,"result":{"tools":[]}}`))
	}))
	defer server.Close()

	transport := NewHTTPTransport(server.URL, nil).(*HTTPTransport)
	if err := transport.Connect(context.Background()); err != nil {
		t.Fatalf("connect HTTP transport: %v", err)
	}
	if _, err := transport.Send(context.Background(), "initialize", InitializeRequest{}); err != nil {
		t.Fatalf("initialize HTTP transport: %v", err)
	}
	if _, err := transport.Send(context.Background(), "tools/list", ListToolsRequest{}); err != nil {
		t.Fatalf("list HTTP tools: %v", err)
	}
	if err := transport.Close(); err != nil {
		t.Fatalf("close HTTP transport: %v", err)
	}

	if !reflect.DeepEqual(methods, []string{"initialize", "tools/list"}) {
		t.Fatalf("unexpected HTTP methods: %#v", methods)
	}
	if followupSessionID != "session-1" {
		t.Fatalf("expected session header replay, got %q", followupSessionID)
	}
	if followupProtocolVersion != "2025-06-18" {
		t.Fatalf("expected protocol header replay, got %q", followupProtocolVersion)
	}
	if deleteSessionID != "session-1" {
		t.Fatalf("expected session delete header, got %q", deleteSessionID)
	}
}

func TestLegacySSETransportFailsExplicitly(t *testing.T) {
	server, err := makeMCPServer("legacy", MCPConfig{Type: "sse", URL: "http://localhost:1234"})
	if err != nil {
		t.Fatalf("make legacy SSE server: %v", err)
	}
	err = server.client.Transport.Connect(context.Background())
	if err == nil || !strings.Contains(err.Error(), "use streamable-http") {
		t.Fatalf("expected explicit legacy SSE migration error, got %v", err)
	}
}
