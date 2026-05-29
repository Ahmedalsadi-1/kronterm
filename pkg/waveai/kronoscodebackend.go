// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package waveai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/wavetermdev/waveterm/pkg/panichandler"
	"github.com/wavetermdev/waveterm/pkg/wshrpc"
)

type KronosCodeBackend struct{}

var _ AIBackend = KronosCodeBackend{}

const KronosCodeDefaultPort = 4096
const KronosCodeDefaultURL = "http://localhost:4096"

// KronosCode request/response types
type KronosCodeMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type KronosCodeSessionCreateRequest struct {
	Title     string `json:"title,omitempty"`
	Objective string `json:"objective,omitempty"`
}

type KronosCodeSessionCreateResponse struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Objective string `json:"objective"`
	CreatedAt int64  `json:"created_at"`
}

type KronosCodeChatRequest struct {
	Input  string                    `json:"input"`
	Agent  string                    `json:"agent,omitempty"`
	Stream bool                      `json:"stream,omitempty"`
	Tools  []KronosCodeTool          `json:"tools,omitempty"`
	Opts   *wshrpc.WaveAIOptsType    `json:"opts,omitempty"`
}

type KronosCodeTool struct {
	Type     string          `json:"type"`
	Function KronosCodeFunction `json:"function"`
}

type KronosCodeFunction struct {
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	Parameters  json.RawMessage `json:"parameters,omitempty"`
}

type KronosCodeStreamResponse struct {
	ID      string                  `json:"id"`
	Type    string                  `json:"type"`
	Content *KronosCodeStreamChunk  `json:"content,omitempty"`
	Error   string                  `json:"error,omitempty"`
}

type KronosCodeStreamChunk struct {
	Text        string                     `json:"text,omitempty"`
	ToolCall    *KronosCodeToolCall        `json:"tool_call,omitempty"`
	ToolResult  *KronosCodeToolResult      `json:"tool_result,omitempty"`
	Finish      bool                       `json:"finish,omitempty"`
}

type KronosCodeToolCall struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
}

type KronosCodeToolResult struct {
	ToolCallID string `json:"tool_call_id"`
	Result     string `json:"result"`
	Status     string `json:"status"`
}

func (KronosCodeBackend) StreamCompletion(ctx context.Context, request wshrpc.WaveAIStreamRequest) chan wshrpc.RespOrErrorUnion[wshrpc.WaveAIPacketType] {
	rtn := make(chan wshrpc.RespOrErrorUnion[wshrpc.WaveAIPacketType])
	go func() {
		defer func() {
			panicErr := panichandler.PanicHandler("KronosCodeBackend.StreamCompletion", recover())
			if panicErr != nil {
				rtn <- makeAIError(panicErr)
			}
			close(rtn)
		}()

		if request.Opts == nil {
			rtn <- makeAIError(errors.New("no kronoscode opts found"))
			return
		}

		baseURL := request.Opts.BaseURL
		if baseURL == "" {
			baseURL = KronosCodeDefaultURL
		}

		// Build the last user message from prompt
		var userMessage string
		for _, msg := range request.Prompt {
			if msg.Role == "user" {
				userMessage = msg.Content
			}
		}

		if userMessage == "" {
			rtn <- makeAIError(errors.New("no user message found in prompt"))
			return
		}

		// Create HTTP client with timeout
		client := &http.Client{
			Timeout: time.Duration(request.Opts.TimeoutMs) * time.Millisecond,
		}
		if request.Opts.TimeoutMs == 0 {
			client.Timeout = 2 * time.Minute
		}

		// Prepare chat request
		chatReq := KronosCodeChatRequest{
			Input:  userMessage,
			Stream: true,
			Agent:  request.Opts.Model, // Use model as agent name
			Opts:   request.Opts,
		}

		// Send chat request to KronosCode
		reqBody, err := json.Marshal(chatReq)
		if err != nil {
			rtn <- makeAIError(fmt.Errorf("failed to marshal chat request: %v", err))
			return
		}

		chatURL := fmt.Sprintf("%s/v1/session/chat", baseURL)
		httpReq, err := http.NewRequestWithContext(ctx, "POST", chatURL, bytes.NewReader(reqBody))
		if err != nil {
			rtn <- makeAIError(fmt.Errorf("failed to create request: %v", err))
			return
		}

		httpReq.Header.Set("Content-Type", "application/json")
		if request.Opts.APIToken != "" {
			httpReq.Header.Set("Authorization", "Bearer "+request.Opts.APIToken)
		}

		resp, err := client.Do(httpReq)
		if err != nil {
			rtn <- makeAIError(fmt.Errorf("kronoscode request failed: %v", err))
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			rtn <- makeAIError(fmt.Errorf("kronoscode returned status %d: %s", resp.StatusCode, string(body)))
			return
		}

		// Stream processing
		reader := bufio.NewReader(resp.Body)
		sentHeader := false

		for {
			line, err := reader.ReadBytes('\n')
			if err == io.EOF {
				break
			}
			if err != nil {
				rtn <- makeAIError(fmt.Errorf("error reading stream: %v", err))
				return
			}

			// Skip empty lines
			if len(bytes.TrimSpace(line)) == 0 {
				continue
			}

			// Parse SSE format (data: {...})
			if !bytes.HasPrefix(line, []byte("data: ")) {
				continue
			}

			data := bytes.TrimPrefix(line, []byte("data: "))
			data = bytes.TrimSpace(data)

			// Check for stream end
			if string(data) == "[DONE]" {
				break
			}

			var streamResp KronosCodeStreamResponse
			if err := json.Unmarshal(data, &streamResp); err != nil {
				// Try to parse as raw text if JSON fails
				pk := MakeWaveAIPacket()
				pk.Text = string(data)
				rtn <- wshrpc.RespOrErrorUnion[wshrpc.WaveAIPacketType]{Response: *pk}
				continue
			}

			// Send header packet with model info
			if !sentHeader && streamResp.ID != "" {
				pk := MakeWaveAIPacket()
				pk.Model = request.Opts.Model
				if pk.Model == "" {
					pk.Model = "kronoscode"
				}
				pk.Created = time.Now().Unix()
				rtn <- wshrpc.RespOrErrorUnion[wshrpc.WaveAIPacketType]{Response: *pk}
				sentHeader = true
			}

			// Handle error from stream
			if streamResp.Error != "" {
				rtn <- makeAIError(fmt.Errorf("kronoscode error: %s", streamResp.Error))
				return
			}

			if streamResp.Content == nil {
				continue
			}

			// Send text content
			if streamResp.Content.Text != "" {
				pk := MakeWaveAIPacket()
				pk.Text = streamResp.Content.Text
				rtn <- wshrpc.RespOrErrorUnion[wshrpc.WaveAIPacketType]{Response: *pk}
			}

			// Handle tool calls
			if streamResp.Content.ToolCall != nil {
				// KronosCode doesn't use OpenAI function format natively
				// We format tool calls as text for now
				pk := MakeWaveAIPacket()
				pk.Text = fmt.Sprintf("\n[Tool Call: %s]\n", streamResp.Content.ToolCall.Name)
				rtn <- wshrpc.RespOrErrorUnion[wshrpc.WaveAIPacketType]{Response: *pk}
			}

			// Handle tool results
			if streamResp.Content.ToolResult != nil {
				pk := MakeWaveAIPacket()
				pk.Text = fmt.Sprintf("\n[Tool Result: %s]\n%s\n", 
					streamResp.Content.ToolResult.ToolCallID,
					streamResp.Content.ToolResult.Result)
				rtn <- wshrpc.RespOrErrorUnion[wshrpc.WaveAIPacketType]{Response: *pk}
			}

			// Check for finish
			if streamResp.Content.Finish {
				pk := MakeWaveAIPacket()
				pk.FinishReason = "stop"
				rtn <- wshrpc.RespOrErrorUnion[wshrpc.WaveAIPacketType]{Response: *pk}
			}
		}

		// Send final packet
		pk := MakeWaveAIPacket()
		pk.FinishReason = "stop"
		rtn <- wshrpc.RespOrErrorUnion[wshrpc.WaveAIPacketType]{Response: *pk}
	}()

	return rtn
}
