// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package waveai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/wavetermdev/waveterm/pkg/panichandler"
	"github.com/wavetermdev/waveterm/pkg/wshrpc"
)

type KronosCodeBackend struct{}

var _ AIBackend = KronosCodeBackend{}

const KronosCodeDefaultPort = 4096
const KronosCodeDefaultURL = "http://localhost:4096"

// kronosSessionInfo maps the session create response
type kronosSessionInfo struct {
	ID string `json:"id"`
}

// kronosServerPart mirrors the kronoscode API part type
type kronosServerPart struct {
	ID        string `json:"id"`
	SessionID string `json:"sessionID,omitempty"`
	MessageID string `json:"messageID,omitempty"`
	Type      string `json:"type"`
	Text      string `json:"text,omitempty"`
}

// kronosServerMessage mirrors the kronoscode API message response
type kronosServerMessage struct {
	ID        string            `json:"id"`
	SessionID string            `json:"sessionID"`
	Role      string            `json:"role"`
	Parts     []kronosServerPart `json:"parts"`
	Created   int64             `json:"created"`
	Completed int64             `json:"completed,omitempty"`
}

// kronosGlobalEvent is the SSE event wrapper from /global/event
type kronosGlobalEvent struct {
	Payload struct {
		Type       string          `json:"type"`
		Properties json.RawMessage `json:"properties"`
	} `json:"payload"`
}

// kronosMessagePartDeltaEvent carries streaming text deltas
type kronosMessagePartDeltaEvent struct {
	SessionID string `json:"sessionID"`
	MessageID string `json:"messageID"`
	PartID    string `json:"partID"`
	Field     string `json:"field"`
	Delta     string `json:"delta"`
}

func applyKronosCodeAuth(req *http.Request, apiToken string) {
	if strings.TrimSpace(apiToken) == "" {
		return
	}
	authValue := base64.StdEncoding.EncodeToString([]byte("kronoscode:" + apiToken))
	req.Header.Set("Authorization", "Basic "+authValue)
}

// doKronosCodeJSON makes an HTTP request to the kronoscode API and unmarshals the JSON response
func doKronosCodeJSON(ctx context.Context, client *http.Client, endpoint string, apiToken string, method string, path string, body any, out any) error {
	var bodyReader io.Reader
	if body != nil {
		jsonBytes, err := json.Marshal(body)
		if err != nil {
			return err
		}
		bodyReader = bytes.NewReader(jsonBytes)
	}
	req, err := http.NewRequestWithContext(ctx, method, strings.TrimRight(endpoint, "/")+path, bodyReader)
	if err != nil {
		return err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	applyKronosCodeAuth(req, apiToken)
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("kronoscode request failed: %v", err)
	}
	defer resp.Body.Close()
	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		msg := strings.TrimSpace(string(respBytes))
		if msg == "" {
			msg = resp.Status
		}
		return fmt.Errorf("kronoscode %s %s failed: %s", method, path, msg)
	}
	if out != nil && len(respBytes) > 0 {
		if err := json.Unmarshal(respBytes, out); err != nil {
			return err
		}
	}
	return nil
}

// buildKronosCodeParts converts the AI prompt messages into kronoscode parts format
func buildKronosCodeParts(prompt []wshrpc.WaveAIPromptMessageType) []map[string]any {
	var parts []map[string]any
	for _, msg := range prompt {
		if msg.Role == "user" && msg.Content != "" {
			parts = append(parts, map[string]any{
				"type": "text",
				"text": msg.Content,
			})
		}
	}
	if len(parts) == 0 {
		// fallback: use the last message content regardless of role
		for i := len(prompt) - 1; i >= 0; i-- {
			if prompt[i].Content != "" {
				parts = append(parts, map[string]any{
					"type": "text",
					"text": prompt[i].Content,
				})
				break
			}
		}
	}
	return parts
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

		// Build parts from prompt
		parts := buildKronosCodeParts(request.Prompt)
		if len(parts) == 0 {
			rtn <- makeAIError(errors.New("no user message found in prompt"))
			return
		}

		// Create HTTP client
		client := &http.Client{
			Timeout: time.Duration(request.Opts.TimeoutMs) * time.Millisecond,
		}
		if request.Opts.TimeoutMs == 0 {
			client.Timeout = 2 * time.Minute
		}

		// Step 1: Create a session
		sessionInfo := &kronosSessionInfo{}
		if err := doKronosCodeJSON(ctx, client, baseURL, request.Opts.APIToken, http.MethodPost, "/session", map[string]any{}, sessionInfo); err != nil {
			rtn <- makeAIError(fmt.Errorf("kronoscode session creation failed: %v", err))
			return
		}
		if sessionInfo.ID == "" {
			rtn <- makeAIError(fmt.Errorf("kronoscode session response missing id"))
			return
		}
		sessionID := sessionInfo.ID

		// Step 2: Prepare message payload
		payload := map[string]any{
			"parts": parts,
		}
		if request.Opts.Model != "" {
			payload["agent"] = request.Opts.Model
		}

		// Step 3: Start SSE event stream in background (for text deltas)
		streamCtx, cancelStream := context.WithCancel(ctx)
		defer cancelStream()

		// channel to forward SSE text deltas
		deltaCh := make(chan string, 100)
		go func() {
			defer close(deltaCh)
			// Connect to SSE endpoint
			sseReq, err := http.NewRequestWithContext(streamCtx, http.MethodGet, strings.TrimRight(baseURL, "/")+"/global/event", nil)
			if err != nil {
				return
			}
			applyKronosCodeAuth(sseReq, request.Opts.APIToken)
			sseReq.Header.Set("Accept", "text/event-stream")
			sseResp, err := client.Do(sseReq)
			if err != nil {
				return
			}
			defer sseResp.Body.Close()
			if sseResp.StatusCode != http.StatusOK {
				return
			}

			scanner := bufio.NewScanner(sseResp.Body)
			scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
			for scanner.Scan() {
				line := scanner.Text()
				if !strings.HasPrefix(line, "data: ") {
					continue
				}
				data := strings.TrimPrefix(line, "data: ")
				data = strings.TrimSpace(data)

				var globalEvent kronosGlobalEvent
				if err := json.Unmarshal([]byte(data), &globalEvent); err != nil {
					continue
				}
				if globalEvent.Payload.Type != "message.part.delta" {
					continue
				}
				var deltaEvent kronosMessagePartDeltaEvent
				if err := json.Unmarshal(globalEvent.Payload.Properties, &deltaEvent); err != nil {
					continue
				}
				if deltaEvent.SessionID != sessionID || deltaEvent.Field != "text" {
					continue
				}
				if deltaEvent.Delta == "" {
					continue
				}
				select {
				case deltaCh <- deltaEvent.Delta:
				case <-streamCtx.Done():
					return
				}
			}
		}()

		// Step 4: Send the message (this blocks until the server finishes processing)
		respMsg := &kronosServerMessage{}
		msgPath := fmt.Sprintf("/session/%s/message", sessionID)
		if err := doKronosCodeJSON(ctx, client, baseURL, request.Opts.APIToken, http.MethodPost, msgPath, payload, respMsg); err != nil {
			rtn <- makeAIError(fmt.Errorf("kronoscode message failed: %v", err))
			return
		}
		cancelStream() // stop SSE goroutine

		// Step 5: Drain remaining deltas from SSE channel and combine with response
		var textBuilder strings.Builder
		done := false
		for !done {
			select {
			case delta, ok := <-deltaCh:
				if !ok {
					done = true
					continue
				}
				textBuilder.WriteString(delta)
				pk := MakeWaveAIPacket()
				pk.Text = delta
				rtn <- wshrpc.RespOrErrorUnion[wshrpc.WaveAIPacketType]{Response: *pk}
			default:
				done = true
			}
		}

		// Step 6: If the response message has text parts we didn't get from SSE, send them
		respText := extractTextFromMessage(respMsg)
		// Only send remaining text if we didn't get it via SSE
		drainedText := textBuilder.String()
		if len(respText) > len(drainedText) {
			remaining := respText[len(drainedText):]
			pk := MakeWaveAIPacket()
			pk.Text = remaining
			rtn <- wshrpc.RespOrErrorUnion[wshrpc.WaveAIPacketType]{Response: *pk}
		}

		// Step 7: Send finish packet
		pk := MakeWaveAIPacket()
		pk.FinishReason = "stop"
		rtn <- wshrpc.RespOrErrorUnion[wshrpc.WaveAIPacketType]{Response: *pk}
	}()

	return rtn
}

func extractTextFromMessage(msg *kronosServerMessage) string {
	if msg == nil {
		return ""
	}
	var b strings.Builder
	for _, part := range msg.Parts {
		if part.Type == "text" {
			b.WriteString(part.Text)
		}
	}
	return b.String()
}
