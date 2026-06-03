// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package mcp

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"reflect"
	"sort"
	"strings"
	"sync"
	"time"
)

type MCPConfig struct {
	Enabled *bool             `json:"enabled,omitempty"`
	Type    string            `json:"type"`
	Command []string          `json:"command,omitempty"`
	URL     string            `json:"url,omitempty"`
	Headers map[string]string `json:"headers,omitempty"`
	Timeout int64             `json:"timeout,omitempty"`
	Env     map[string]string `json:"env,omitempty"`
}

type MCPTool struct {
	Name        string
	Description string
	InputSchema map[string]interface{}
}

type MCPServer struct {
	Name      string
	Config    MCPConfig
	Status    ServerStatus
	LastError string
	Info      *ServerInfo
	Tools     []MCPTool
	client    *MCPClient
	mu        sync.RWMutex
}

type MCPClient struct {
	Name       string
	Transport  Transport
	ServerInfo *ServerInfo
	Tools      []MCPTool
}

func NewStdioTransport(command []string, env map[string]string) Transport {
	return &StdioTransport{
		Command: command,
		Env:     env,
	}
}

type StdioTransport struct {
	Command []string
	Env     map[string]string
	mu      sync.Mutex
	cmd     *exec.Cmd
	stdin   io.WriteCloser
	stdout  io.ReadCloser
	ctx     context.Context
}

func (t *StdioTransport) Connect(ctx context.Context) error {
	if len(t.Command) == 0 {
		return fmt.Errorf("no command specified")
	}
	t.ctx = ctx
	return nil
}

func (t *StdioTransport) Send(ctx context.Context, method string, params interface{}) (json.RawMessage, error) {
	t.mu.Lock()
	defer t.mu.Unlock()

	if t.cmd == nil || t.cmd.Process == nil {
		cmd := exec.CommandContext(ctx, t.Command[0], t.Command[1:]...)
		if len(t.Env) > 0 {
			env := os.Environ()
			for k, v := range t.Env {
				env = append(env, k+"="+v)
			}
			cmd.Env = env
		}
		stdin, err := cmd.StdinPipe()
		if err != nil {
			return nil, fmt.Errorf("failed to create stdin pipe: %v", err)
		}
		stdout, err := cmd.StdoutPipe()
		if err != nil {
			return nil, fmt.Errorf("failed to create stdout pipe: %v", err)
		}
		cmd.Stderr = nil
		if err := cmd.Start(); err != nil {
			return nil, fmt.Errorf("failed to start subprocess: %v", err)
		}
		t.cmd = cmd
		t.stdin = stdin
		t.stdout = stdout
	}

	request := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  method,
		"params":  params,
	}
	requestBytes, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %v", err)
	}
	requestBytes = append(requestBytes, '\n')

	if _, err := t.stdin.Write(requestBytes); err != nil {
		return nil, fmt.Errorf("failed to write to subprocess stdin: %v", err)
	}

	responseBytes, err := readLine(t.stdout)
	if err != nil {
		return nil, fmt.Errorf("failed to read response from subprocess: %v", err)
	}

	var response struct {
		JSONRPC string          `json:"jsonrpc"`
		ID      int             `json:"id"`
		Result  json.RawMessage `json:"result"`
		Error   *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error,omitempty"`
	}
	if err := json.Unmarshal(responseBytes, &response); err != nil {
		return nil, fmt.Errorf("failed to parse JSON-RPC response: %v, raw: %s", err, string(responseBytes))
	}
	if response.Error != nil {
		return nil, fmt.Errorf("JSON-RPC error (code %d): %s", response.Error.Code, response.Error.Message)
	}

	return response.Result, nil
}

func (t *StdioTransport) Notify(ctx context.Context, method string, params interface{}) error {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.stdin == nil {
		return fmt.Errorf("subprocess is not connected")
	}
	requestBytes, err := json.Marshal(map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  method,
		"params":  params,
	})
	if err != nil {
		return fmt.Errorf("failed to marshal notification: %v", err)
	}
	requestBytes = append(requestBytes, '\n')
	if _, err := t.stdin.Write(requestBytes); err != nil {
		return fmt.Errorf("failed to write subprocess notification: %v", err)
	}
	return nil
}

func readLine(r io.Reader) ([]byte, error) {
	var buf bytes.Buffer
	tmp := make([]byte, 1)
	for {
		n, err := r.Read(tmp)
		if n > 0 {
			if tmp[0] == '\n' {
				break
			}
			buf.WriteByte(tmp[0])
		}
		if err != nil {
			if err == io.EOF && buf.Len() > 0 {
				return buf.Bytes(), nil
			}
			return nil, err
		}
	}
	return buf.Bytes(), nil
}

func (t *StdioTransport) Close() error {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.cmd != nil && t.cmd.Process != nil {
		if t.stdin != nil {
			t.stdin.Close()
		}
		return t.cmd.Process.Kill()
	}
	return nil
}

func NewHTTPTransport(url string, headers map[string]string) Transport {
	return &HTTPTransport{
		URL:     url,
		Headers: headers,
		client:  &http.Client{Timeout: 30 * time.Second},
	}
}

type HTTPTransport struct {
	URL             string
	Headers         map[string]string
	SessionID       string
	ProtocolVersion string
	client          *http.Client
	mu              sync.RWMutex
}

func (t *HTTPTransport) Connect(ctx context.Context) error {
	parsedURL, err := url.Parse(t.URL)
	if err != nil {
		return fmt.Errorf("invalid MCP HTTP URL: %v", err)
	}
	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return fmt.Errorf("invalid MCP HTTP URL scheme: %s", parsedURL.Scheme)
	}
	if parsedURL.Host == "" {
		return fmt.Errorf("invalid MCP HTTP URL: host is required")
	}
	return nil
}

func (t *HTTPTransport) Send(ctx context.Context, method string, params interface{}) (json.RawMessage, error) {
	request := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      1,
		"method":  method,
		"params":  params,
	}
	requestBytes, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %v", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", t.URL, bytes.NewReader(requestBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %v", err)
	}
	t.setRequestHeaders(req, "application/json, text/event-stream")

	resp, err := t.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("HTTP request failed: %v", err)
	}
	defer resp.Body.Close()
	t.captureResponseHeaders(resp, method)

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read HTTP response: %v", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("HTTP error (status %d): %s", resp.StatusCode, string(body))
	}
	if strings.HasPrefix(resp.Header.Get("Content-Type"), "text/event-stream") {
		body, err = firstSSEResponse(body)
		if err != nil {
			return nil, err
		}
	}

	var response struct {
		JSONRPC string          `json:"jsonrpc"`
		ID      int             `json:"id"`
		Result  json.RawMessage `json:"result"`
		Error   *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error,omitempty"`
	}
	if err := json.Unmarshal(body, &response); err != nil {
		return nil, fmt.Errorf("failed to parse JSON-RPC response: %v, raw: %s", err, string(body))
	}
	if response.Error != nil {
		return nil, fmt.Errorf("JSON-RPC error (code %d): %s", response.Error.Code, response.Error.Message)
	}

	return response.Result, nil
}

func (t *HTTPTransport) Notify(ctx context.Context, method string, params interface{}) error {
	requestBytes, err := json.Marshal(map[string]interface{}{
		"jsonrpc": "2.0",
		"method":  method,
		"params":  params,
	})
	if err != nil {
		return fmt.Errorf("failed to marshal notification: %v", err)
	}
	req, err := http.NewRequestWithContext(ctx, "POST", t.URL, bytes.NewReader(requestBytes))
	if err != nil {
		return fmt.Errorf("failed to create HTTP notification: %v", err)
	}
	t.setRequestHeaders(req, "application/json, text/event-stream")
	resp, err := t.client.Do(req)
	if err != nil {
		return fmt.Errorf("HTTP notification failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("HTTP notification error (status %d): %s", resp.StatusCode, string(body))
	}
	return nil
}

func (t *HTTPTransport) Close() error {
	t.mu.RLock()
	sessionID := t.SessionID
	t.mu.RUnlock()
	if sessionID == "" {
		return nil
	}
	req, err := http.NewRequestWithContext(context.Background(), "DELETE", t.URL, nil)
	if err != nil {
		return fmt.Errorf("failed to create MCP session close request: %v", err)
	}
	t.setRequestHeaders(req, "application/json, text/event-stream")
	resp, err := t.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to close MCP HTTP session: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusMethodNotAllowed && (resp.StatusCode < 200 || resp.StatusCode >= 300) {
		return fmt.Errorf("failed to close MCP HTTP session: status %d", resp.StatusCode)
	}
	t.mu.Lock()
	t.SessionID = ""
	t.mu.Unlock()
	return nil
}

func (t *HTTPTransport) setRequestHeaders(req *http.Request, accept string) {
	req.Header.Set("Accept", accept)
	if req.Method == "POST" {
		req.Header.Set("Content-Type", "application/json")
	}
	for k, v := range t.Headers {
		req.Header.Set(k, v)
	}
	t.mu.RLock()
	defer t.mu.RUnlock()
	if t.SessionID != "" {
		req.Header.Set("Mcp-Session-Id", t.SessionID)
	}
	if t.ProtocolVersion != "" {
		req.Header.Set("MCP-Protocol-Version", t.ProtocolVersion)
	}
}

func (t *HTTPTransport) captureResponseHeaders(resp *http.Response, method string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	if sessionID := resp.Header.Get("Mcp-Session-Id"); sessionID != "" {
		t.SessionID = sessionID
	}
	if method == "initialize" {
		t.ProtocolVersion = "2025-06-18"
	}
}

func firstSSEResponse(body []byte) ([]byte, error) {
	scanner := bufio.NewScanner(bytes.NewReader(body))
	scanner.Buffer(make([]byte, 64*1024), 1024*1024)
	var data []string
	for scanner.Scan() {
		line := scanner.Text()
		if line == "" {
			if response := validSSEResponse(data); response != nil {
				return response, nil
			}
			data = nil
			continue
		}
		if strings.HasPrefix(line, "data:") {
			data = append(data, strings.TrimSpace(strings.TrimPrefix(line, "data:")))
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("failed to read MCP SSE response: %v", err)
	}
	if response := validSSEResponse(data); response != nil {
		return response, nil
	}
	return nil, fmt.Errorf("MCP SSE response did not include a JSON-RPC response")
}

func validSSEResponse(data []string) []byte {
	if len(data) == 0 {
		return nil
	}
	response := []byte(strings.Join(data, "\n"))
	var envelope struct {
		ID interface{} `json:"id"`
	}
	if json.Unmarshal(response, &envelope) != nil || envelope.ID == nil {
		return nil
	}
	return response
}

type UnsupportedTransport struct {
	Reason string
}

func (t *UnsupportedTransport) Connect(ctx context.Context) error {
	return fmt.Errorf("%s", t.Reason)
}

func (t *UnsupportedTransport) Send(ctx context.Context, method string, params interface{}) (json.RawMessage, error) {
	return nil, fmt.Errorf("%s", t.Reason)
}

func (t *UnsupportedTransport) Notify(ctx context.Context, method string, params interface{}) error {
	return fmt.Errorf("%s", t.Reason)
}

func (t *UnsupportedTransport) Close() error {
	return nil
}

type MCPClientManager struct {
	mu      sync.RWMutex
	Servers map[string]*MCPServer
}

var globalMCPManager *MCPClientManager

func GetMCPManager() *MCPClientManager {
	if globalMCPManager == nil {
		globalMCPManager = &MCPClientManager{
			Servers: make(map[string]*MCPServer),
		}
	}
	return globalMCPManager
}

func (m *MCPClientManager) AddServer(name string, config MCPConfig) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	server, err := makeMCPServer(name, config)
	if err != nil {
		return err
	}
	m.Servers[name] = server
	return nil
}

func makeMCPServer(name string, config MCPConfig) (*MCPServer, error) {
	status := ServerStatusDisconnected
	if config.Enabled != nil && !*config.Enabled {
		status = ServerStatusDisabled
	}
	server := &MCPServer{Name: name, Config: config, Status: status}
	var transport Transport
	if config.Type == "local" {
		transport = NewStdioTransport(config.Command, config.Env)
	} else if config.Type == "remote" || config.Type == "http" || config.Type == "streamable-http" {
		transport = NewHTTPTransport(config.URL, config.Headers)
	} else if config.Type == "sse" {
		transport = &UnsupportedTransport{Reason: "legacy MCP SSE transport is not supported; use streamable-http"}
	} else {
		return nil, fmt.Errorf("unknown MCP server type: %s", config.Type)
	}

	server.client = &MCPClient{
		Name:      name,
		Transport: transport,
	}
	return server, nil
}

func (m *MCPClientManager) SyncServers(configs map[string]MCPConfig) error {
	nextServers := make(map[string]*MCPServer, len(configs))
	var transportsToClose []Transport

	m.mu.Lock()
	for name, config := range configs {
		current := m.Servers[name]
		if current != nil && reflect.DeepEqual(current.Config, config) {
			nextServers[name] = current
			continue
		}
		server, err := makeMCPServer(name, config)
		if err != nil {
			m.mu.Unlock()
			return err
		}
		nextServers[name] = server
		if current != nil && current.client != nil && current.client.Transport != nil {
			transportsToClose = append(transportsToClose, current.client.Transport)
		}
	}
	for name, current := range m.Servers {
		if _, exists := nextServers[name]; !exists && current.client != nil && current.client.Transport != nil {
			transportsToClose = append(transportsToClose, current.client.Transport)
		}
	}
	m.Servers = nextServers
	m.mu.Unlock()
	for _, transport := range transportsToClose {
		_ = transport.Close()
	}
	return nil
}

func (m *MCPClientManager) ConnectServer(ctx context.Context, name string) error {
	m.mu.RLock()
	server, ok := m.Servers[name]
	m.mu.RUnlock()

	if !ok {
		return fmt.Errorf("server not found: %s", name)
	}

	if server.client == nil {
		return fmt.Errorf("server not initialized: %s", name)
	}
	if server.Config.Enabled != nil && !*server.Config.Enabled {
		return fmt.Errorf("server disabled: %s", name)
	}

	server.mu.Lock()
	server.Status = ServerStatusConnecting
	server.LastError = ""
	server.mu.Unlock()

	err := server.client.Transport.Connect(ctx)
	if err != nil {
		server.mu.Lock()
		server.Status = ServerStatusError
		server.LastError = err.Error()
		server.mu.Unlock()
		return err
	}

	var initializeResult InitializeResult
	result, err := server.client.Transport.Send(ctx, "initialize", InitializeRequest{
		ProtocolVersion: "2025-06-18",
		Capabilities:    ServerCapabilities{},
		ClientInfo: ClientInfo{
			Name:    "kronterm",
			Version: "0.14.3",
		},
	})
	if err == nil {
		err = json.Unmarshal(result, &initializeResult)
	}
	if err != nil {
		server.mu.Lock()
		server.Status = ServerStatusError
		server.LastError = err.Error()
		server.mu.Unlock()
		return fmt.Errorf("failed to initialize MCP server %s: %w", name, err)
	}
	if err := server.client.Transport.Notify(ctx, "notifications/initialized", map[string]interface{}{}); err != nil {
		server.mu.Lock()
		server.Status = ServerStatusError
		server.LastError = err.Error()
		server.mu.Unlock()
		return fmt.Errorf("failed to finish MCP server initialization for %s: %w", name, err)
	}

	var listToolsResult ListToolsResult
	result, err = server.client.Transport.Send(ctx, "tools/list", ListToolsRequest{})
	if err == nil {
		err = json.Unmarshal(result, &listToolsResult)
	}
	if err != nil {
		server.mu.Lock()
		server.Status = ServerStatusError
		server.LastError = err.Error()
		server.mu.Unlock()
		return fmt.Errorf("failed to list MCP tools for %s: %w", name, err)
	}
	tools := make([]MCPTool, 0, len(listToolsResult.Tools))
	for _, tool := range listToolsResult.Tools {
		var inputSchema map[string]interface{}
		if len(tool.InputSchema) > 0 {
			_ = json.Unmarshal(tool.InputSchema, &inputSchema)
		}
		tools = append(tools, MCPTool{Name: tool.Name, Description: tool.Description, InputSchema: inputSchema})
	}

	server.mu.Lock()
	server.Info = &initializeResult.ServerInfo
	server.Tools = tools
	server.Status = ServerStatusConnected
	server.LastError = ""
	server.mu.Unlock()
	log.Printf("[mcp] server connected: %s\n", name)
	return nil
}

func (m *MCPClientManager) DisconnectServer(name string) error {
	m.mu.RLock()
	server, ok := m.Servers[name]
	m.mu.RUnlock()

	if !ok {
		return fmt.Errorf("server not found: %s", name)
	}

	if server.client != nil && server.client.Transport != nil {
		_ = server.client.Transport.Close()
	}

	server.mu.Lock()
	defer server.mu.Unlock()
	server.Status = ServerStatusDisconnected
	server.LastError = ""
	log.Printf("[mcp] server disconnected: %s\n", name)
	return nil
}

func (m *MCPClientManager) GetServerStatus(name string) ServerStatus {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if server, ok := m.Servers[name]; ok {
		server.mu.RLock()
		defer server.mu.RUnlock()
		return server.Status
	}
	return ServerStatusDisconnected
}

func (m *MCPClientManager) ListServers() []string {
	m.mu.RLock()
	defer m.mu.RUnlock()

	names := make([]string, 0, len(m.Servers))
	for name := range m.Servers {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

func (m *MCPClientManager) GetServer(name string) (MCPServer, bool) {
	m.mu.RLock()
	server, ok := m.Servers[name]
	m.mu.RUnlock()
	if !ok {
		return MCPServer{}, false
	}
	server.mu.RLock()
	defer server.mu.RUnlock()
	return MCPServer{
		Name:      server.Name,
		Config:    server.Config,
		Status:    server.Status,
		LastError: server.LastError,
		Info:      server.Info,
		Tools:     append([]MCPTool(nil), server.Tools...),
	}, true
}

func (m *MCPClientManager) ListTools(name string) ([]MCPTool, error) {
	m.mu.RLock()
	server, ok := m.Servers[name]
	m.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("server not found: %s", name)
	}

	server.mu.RLock()
	defer server.mu.RUnlock()
	if server.Status != ServerStatusConnected {
		return nil, fmt.Errorf("server not connected: %s", name)
	}

	return append([]MCPTool(nil), server.Tools...), nil
}

func (m *MCPClientManager) CallTool(ctx context.Context, serverName string, toolName string, args map[string]interface{}) (interface{}, error) {
	m.mu.RLock()
	server, ok := m.Servers[serverName]
	m.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("server not found: %s", serverName)
	}

	server.mu.RLock()
	status := server.Status
	server.mu.RUnlock()
	if status != ServerStatusConnected {
		return nil, fmt.Errorf("server not connected: %s", serverName)
	}

	if server.client == nil || server.client.Transport == nil {
		return nil, fmt.Errorf("server not initialized: %s", serverName)
	}

	result, err := server.client.Transport.Send(ctx, "tools/call", map[string]interface{}{
		"name":      toolName,
		"arguments": args,
	})

	if err != nil {
		return nil, err
	}

	return result, nil
}
