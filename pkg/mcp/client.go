// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os/exec"
	"sync"
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
	Name   string
	Config MCPConfig
	Status ServerStatus
	Info   *ServerInfo
	Tools  []MCPTool
	client *MCPClient
	mu     sync.RWMutex
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
	cmd     *exec.Cmd
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
	return nil, fmt.Errorf("not implemented - need proper stdio handling")
}

func (t *StdioTransport) Close() error {
	if t.cmd != nil && t.cmd.Process != nil {
		return t.cmd.Process.Kill()
	}
	return nil
}

func NewHTTPTransport(url string, headers map[string]string) Transport {
	return &HTTPTransport{
		URL:     url,
		Headers: headers,
	}
}

type HTTPTransport struct {
	URL     string
	Headers map[string]string
}

func (t *HTTPTransport) Connect(ctx context.Context) error {
	return nil
}

func (t *HTTPTransport) Send(ctx context.Context, method string, params interface{}) (json.RawMessage, error) {
	return nil, fmt.Errorf("not implemented - need proper HTTP handling")
}

func (t *HTTPTransport) Close() error {
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

	server := &MCPServer{
		Name:   name,
		Config: config,
		Status: ServerStatusDisconnected,
	}

	var transport Transport
	if config.Type == "local" {
		transport = NewStdioTransport(config.Command, config.Env)
	} else if config.Type == "remote" {
		transport = NewHTTPTransport(config.URL, config.Headers)
	} else {
		return fmt.Errorf("unknown MCP server type: %s", config.Type)
	}

	server.client = &MCPClient{
		Name:      name,
		Transport: transport,
	}

	m.Servers[name] = server
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

	err := server.client.Transport.Connect(ctx)
	if err != nil {
		server.Status = ServerStatusError
		return err
	}

	server.Status = ServerStatusConnected
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
		server.client.Transport.Close()
	}

	server.Status = ServerStatusDisconnected
	log.Printf("[mcp] server disconnected: %s\n", name)
	return nil
}

func (m *MCPClientManager) GetServerStatus(name string) ServerStatus {
	m.mu.RLock()
	defer m.mu.RUnlock()
	if server, ok := m.Servers[name]; ok {
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
	return names
}

func (m *MCPClientManager) ListTools(name string) ([]MCPTool, error) {
	m.mu.RLock()
	server, ok := m.Servers[name]
	m.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("server not found: %s", name)
	}

	if server.Status != ServerStatusConnected {
		return nil, fmt.Errorf("server not connected: %s", name)
	}

	return server.Tools, nil
}

func (m *MCPClientManager) CallTool(serverName string, toolName string, args map[string]interface{}) (interface{}, error) {
	m.mu.RLock()
	server, ok := m.Servers[serverName]
	m.mu.RUnlock()

	if !ok {
		return nil, fmt.Errorf("server not found: %s", serverName)
	}

	if server.Status != ServerStatusConnected {
		return nil, fmt.Errorf("server not connected: %s", serverName)
	}

	if server.client == nil || server.client.Transport == nil {
		return nil, fmt.Errorf("server not initialized: %s", serverName)
	}

	result, err := server.client.Transport.Send(context.Background(), "tools/call", map[string]interface{}{
		"name":      toolName,
		"arguments": args,
	})

	if err != nil {
		return nil, err
	}

	return result, nil
}
