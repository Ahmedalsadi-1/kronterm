package aiusechat

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"sync"

	"github.com/google/uuid"
	"github.com/launchdarkly/eventsource"
	"github.com/wavetermdev/waveterm/pkg/aiusechat/aiutil"
	"github.com/wavetermdev/waveterm/pkg/aiusechat/chatstore"
	"github.com/wavetermdev/waveterm/pkg/aiusechat/uctypes"
	"github.com/wavetermdev/waveterm/pkg/web/sse"
)

const (
	kronosWaveToolRequestOpenTag  = "<wave_tool_request>"
	kronosWaveToolRequestCloseTag = "</wave_tool_request>"
	kronosWaveToolResultOpenTag   = "<wave_tool_result>"
	kronosWaveToolResultCloseTag  = "</wave_tool_result>"

	kronosToolRoutingHybrid     = "hybrid"
	kronosToolRoutingWaveOnly   = "wave-only"
	kronosToolRoutingKronosOnly = "kronos-only"
)

type kronosSessionBackend struct{}

type KronosChatMessage struct {
	MessageId    string           `json:"messageid"`
	Role         string           `json:"role"`
	Parts        []KronosChatPart `json:"parts,omitempty"`
	Usage        *uctypes.AIUsage `json:"usage,omitempty"`
	Hidden       bool             `json:"hidden,omitempty"`
	RemoteSynced bool             `json:"remotesynced,omitempty"`
}

func (m *KronosChatMessage) GetMessageId() string {
	if m == nil {
		return ""
	}
	return m.MessageId
}

func (m *KronosChatMessage) GetUsage() *uctypes.AIUsage {
	if m == nil {
		return nil
	}
	return m.Usage
}

func (m *KronosChatMessage) GetRole() string {
	if m == nil {
		return ""
	}
	return m.Role
}

type KronosChatPart struct {
	Type            string                        `json:"type"`
	ID              string                        `json:"id,omitempty"`
	Text            string                        `json:"text,omitempty"`
	Ignored         bool                          `json:"ignored,omitempty"`
	Synthetic       bool                          `json:"synthetic,omitempty"`
	Metadata        map[string]any                `json:"metadata,omitempty"`
	Mime            string                        `json:"mime,omitempty"`
	Filename        string                        `json:"filename,omitempty"`
	URL             string                        `json:"url,omitempty"`
	CallID          string                        `json:"callid,omitempty"`
	Tool            string                        `json:"tool,omitempty"`
	ToolSource      string                        `json:"toolsource,omitempty"`
	ActsOnWidgets   bool                          `json:"actsonwidgets,omitempty"`
	State           *kronosToolState              `json:"state,omitempty"`
	WaveToolUseData *uctypes.UIMessageDataToolUse `json:"wavetoolusedata,omitempty"`
	WaveToolResult  *kronosWaveToolResult         `json:"wavetoolresult,omitempty"`
}

type kronosWaveToolResult struct {
	ToolUseID string `json:"tooluseid"`
	ToolName  string `json:"toolname"`
	Text      string `json:"text,omitempty"`
	ErrorText string `json:"errortext,omitempty"`
}

type kronosToolState struct {
	Status      string             `json:"status"`
	Input       map[string]any     `json:"input,omitempty"`
	Raw         string             `json:"raw,omitempty"`
	Output      string             `json:"output,omitempty"`
	Error       string             `json:"error,omitempty"`
	Title       string             `json:"title,omitempty"`
	Metadata    map[string]any     `json:"metadata,omitempty"`
	History     []string           `json:"history,omitempty"`
	Time        *kronosPartTime    `json:"time,omitempty"`
	Attachments []kronosServerPart `json:"attachments,omitempty"`
}

type kronosPartTime struct {
	Start     int64 `json:"start,omitempty"`
	End       int64 `json:"end,omitempty"`
	Created   int64 `json:"created,omitempty"`
	Completed int64 `json:"completed,omitempty"`
}

type kronosServerMessage struct {
	Info  kronosServerMessageInfo `json:"info"`
	Parts []kronosServerPart      `json:"parts"`
}

type kronosServerMessageInfo struct {
	ID         string            `json:"id"`
	SessionID  string            `json:"sessionID"`
	Role       string            `json:"role"`
	Time       kronosMessageTime `json:"time"`
	ParentID   string            `json:"parentID,omitempty"`
	ModelID    string            `json:"modelID,omitempty"`
	ProviderID string            `json:"providerID,omitempty"`
	Agent      string            `json:"agent,omitempty"`
	Finish     string            `json:"finish,omitempty"`
	Tokens     *kronosTokenUsage `json:"tokens,omitempty"`
	Error      *kronosNamedError `json:"error,omitempty"`
}

type kronosMessageTime struct {
	Created   int64 `json:"created"`
	Completed int64 `json:"completed,omitempty"`
}

type kronosTokenUsage struct {
	Total     int `json:"total,omitempty"`
	Input     int `json:"input,omitempty"`
	Output    int `json:"output,omitempty"`
	Reasoning int `json:"reasoning,omitempty"`
	Cache     struct {
		Read  int `json:"read,omitempty"`
		Write int `json:"write,omitempty"`
	} `json:"cache,omitempty"`
}

type kronosNamedError struct {
	Name    string `json:"name,omitempty"`
	Message string `json:"message,omitempty"`
}

type kronosServerPart struct {
	ID        string            `json:"id"`
	SessionID string            `json:"sessionID,omitempty"`
	MessageID string            `json:"messageID,omitempty"`
	Type      string            `json:"type"`
	Text      string            `json:"text,omitempty"`
	Ignored   bool              `json:"ignored,omitempty"`
	Synthetic bool              `json:"synthetic,omitempty"`
	Metadata  map[string]any    `json:"metadata,omitempty"`
	Time      *kronosPartTime   `json:"time,omitempty"`
	Mime      string            `json:"mime,omitempty"`
	Filename  string            `json:"filename,omitempty"`
	URL       string            `json:"url,omitempty"`
	CallID    string            `json:"callID,omitempty"`
	Tool      string            `json:"tool,omitempty"`
	State     *kronosToolState  `json:"state,omitempty"`
	Reason    string            `json:"reason,omitempty"`
	Snapshot  string            `json:"snapshot,omitempty"`
	Cost      float64           `json:"cost,omitempty"`
	Tokens    *kronosTokenUsage `json:"tokens,omitempty"`
}

type kronosSessionInfo struct {
	ID string `json:"id"`
}

type kronosGlobalEvent struct {
	Directory string `json:"directory,omitempty"`
	Payload   struct {
		Type       string          `json:"type"`
		Properties json.RawMessage `json:"properties"`
	} `json:"payload"`
}

type kronosMessageUpdatedEvent struct {
	Info kronosServerMessageInfo `json:"info"`
}

type kronosMessagePartUpdatedEvent struct {
	Part kronosServerPart `json:"part"`
}

type kronosMessagePartDeltaEvent struct {
	SessionID string `json:"sessionID"`
	MessageID string `json:"messageID"`
	PartID    string `json:"partID"`
	Field     string `json:"field"`
	Delta     string `json:"delta"`
}

type kronosPermissionAskedEvent struct {
	ID        string   `json:"id"`
	SessionID string   `json:"sessionID"`
	Patterns  []string `json:"patterns"`
}

type kronosWaveToolRequest struct {
	ID    string         `json:"id"`
	Name  string         `json:"name"`
	Input map[string]any `json:"input"`
}

type kronosStreamState struct {
	lock               sync.Mutex
	assistantMessageID string
	messageStarted     bool
	textParts          map[string]*kronosTextStreamState
}

type kronosTextStreamState struct {
	RawSeen   int
	Buffer    string
	InsideTag bool
	Started   bool
	Ended     bool
}

func (b *kronosSessionBackend) RunChatStep(
	ctx context.Context,
	sseHandler *sse.SSEHandlerCh,
	chatOpts uctypes.WaveChatOpts,
	cont *uctypes.WaveContinueResponse,
) (*uctypes.WaveStopReason, []uctypes.GenAIMessage, *uctypes.RateLimitInfo, error) {
	if cont == nil {
		if err := sseHandler.SetupSSE(); err != nil {
			return nil, nil, nil, err
		}
	}
	_ = sseHandler.AiMsgStartStep()

	httpClient, err := aiutil.MakeHTTPClient(chatOpts.Config.ProxyURL)
	if err != nil {
		return nil, nil, nil, err
	}

	sessionID, err := ensureKronosSession(ctx, httpClient, chatOpts)
	if err != nil {
		return nil, nil, nil, err
	}

	streamState := &kronosStreamState{
		textParts: make(map[string]*kronosTextStreamState),
	}
	streamCtx, cancelStream := context.WithCancel(ctx)
	defer cancelStream()
	go streamKronosEvents(streamCtx, httpClient, chatOpts, sessionID, streamState, sseHandler)

	respMsg, promptErr := postKronosPrompt(ctx, httpClient, chatOpts, sessionID)
	cancelStream()
	if promptErr != nil {
		_ = sseHandler.AiMsgError(promptErr.Error())
		_ = sseHandler.AiMsgFinishStep()
		_ = sseHandler.AiMsgFinish("", nil)
		return &uctypes.WaveStopReason{
			Kind:      uctypes.StopKindError,
			ErrorType: "kronos",
			ErrorText: promptErr.Error(),
		}, nil, nil, nil
	}

	assistantMsg, stopReason, err := convertKronosAssistantMessage(respMsg, chatOpts)
	if err != nil {
		_ = sseHandler.AiMsgError(err.Error())
		_ = sseHandler.AiMsgFinishStep()
		_ = sseHandler.AiMsgFinish("", nil)
		return &uctypes.WaveStopReason{
			Kind:      uctypes.StopKindError,
			ErrorType: "kronos-convert",
			ErrorText: err.Error(),
		}, nil, nil, nil
	}

	flushKronosAssistantToSSE(streamState, assistantMsg, sseHandler)
	if stopReason != nil && stopReason.Kind == uctypes.StopKindError && stopReason.ErrorText != "" {
		_ = sseHandler.AiMsgError(stopReason.ErrorText)
	}
	_ = sseHandler.AiMsgFinishStep()
	if stopReason == nil || stopReason.Kind != uctypes.StopKindToolUse {
		_ = sseHandler.AiMsgFinish("", nil)
	}

	messages := []uctypes.GenAIMessage{assistantMsg}
	return stopReason, messages, nil, nil
}

func (b *kronosSessionBackend) UpdateToolUseData(chatId string, toolCallId string, toolUseData uctypes.UIMessageDataToolUse) error {
	return chatstore.DefaultChatStore.MutateChat(chatId, func(chat *uctypes.AIChat) error {
		for _, nativeMsg := range chat.NativeMessages {
			msg, ok := nativeMsg.(*KronosChatMessage)
			if !ok {
				continue
			}
			for i := range msg.Parts {
				part := &msg.Parts[i]
				if part.Type != "tool" || part.CallID != toolCallId || part.ToolSource != "wave" {
					continue
				}
				copyData := toolUseData
				part.WaveToolUseData = &copyData
				return nil
			}
		}
		return fmt.Errorf("wave tool call not found: %s", toolCallId)
	})
}

func (b *kronosSessionBackend) RemoveToolUseCall(chatId string, toolCallId string) error {
	return chatstore.DefaultChatStore.MutateChat(chatId, func(chat *uctypes.AIChat) error {
		for _, nativeMsg := range chat.NativeMessages {
			msg, ok := nativeMsg.(*KronosChatMessage)
			if !ok {
				continue
			}
			filtered := msg.Parts[:0]
			removed := false
			for _, part := range msg.Parts {
				if part.Type == "tool" && part.CallID == toolCallId && part.ToolSource == "wave" {
					removed = true
					continue
				}
				filtered = append(filtered, part)
			}
			if removed {
				msg.Parts = filtered
				return nil
			}
		}
		return nil
	})
}

func (b *kronosSessionBackend) ConvertToolResultsToNativeChatMessage(toolResults []uctypes.AIToolResult) ([]uctypes.GenAIMessage, error) {
	if len(toolResults) == 0 {
		return nil, nil
	}
	msg := &KronosChatMessage{
		MessageId:    uuid.New().String(),
		Role:         "user",
		Hidden:       true,
		RemoteSynced: false,
	}
	for _, result := range toolResults {
		copyResult := result
		msg.Parts = append(msg.Parts, KronosChatPart{
			Type: "wave-tool-result",
			ID:   uuid.New().String(),
			WaveToolResult: &kronosWaveToolResult{
				ToolUseID: copyResult.ToolUseID,
				ToolName:  copyResult.ToolName,
				Text:      copyResult.Text,
				ErrorText: copyResult.ErrorText,
			},
		})
	}
	return []uctypes.GenAIMessage{msg}, nil
}

func (b *kronosSessionBackend) ConvertAIMessageToNativeChatMessage(message uctypes.AIMessage) (uctypes.GenAIMessage, error) {
	if err := message.Validate(); err != nil {
		return nil, err
	}
	msg := &KronosChatMessage{
		MessageId:    message.MessageId,
		Role:         "user",
		RemoteSynced: false,
	}
	for _, part := range message.Parts {
		switch part.Type {
		case uctypes.AIMessagePartTypeText:
			msg.Parts = append(msg.Parts, KronosChatPart{
				Type: "text",
				ID:   uuid.New().String(),
				Text: part.Text,
			})
		case uctypes.AIMessagePartTypeFile:
			fileURL := part.URL
			if fileURL == "" {
				fileURL = makeDataURL(part.MimeType, part.Data)
			}
			msg.Parts = append(msg.Parts, KronosChatPart{
				Type:     "file",
				ID:       uuid.New().String(),
				Mime:     part.MimeType,
				Filename: part.FileName,
				URL:      fileURL,
			})
		default:
			return nil, fmt.Errorf("unsupported Kronos message part type: %s", part.Type)
		}
	}
	return msg, nil
}

func (b *kronosSessionBackend) GetFunctionCallInputByToolCallId(aiChat uctypes.AIChat, toolCallId string) *uctypes.AIFunctionCallInput {
	for _, nativeMsg := range aiChat.NativeMessages {
		msg, ok := nativeMsg.(*KronosChatMessage)
		if !ok {
			continue
		}
		for _, part := range msg.Parts {
			if part.Type != "tool" || part.CallID != toolCallId || part.ToolSource != "wave" {
				continue
			}
			args, _ := json.Marshal(part.State.Input)
			return &uctypes.AIFunctionCallInput{
				CallId:      toolCallId,
				Name:        part.Tool,
				Arguments:   string(args),
				ToolUseData: part.WaveToolUseData,
			}
		}
	}
	return nil
}

func (b *kronosSessionBackend) ConvertAIChatToUIChat(aiChat uctypes.AIChat) (*uctypes.UIChat, error) {
	uiChat := &uctypes.UIChat{
		ChatId:     aiChat.ChatId,
		APIType:    aiChat.APIType,
		Model:      aiChat.Model,
		APIVersion: aiChat.APIVersion,
	}
	waveToolResults := make(map[string]kronosWaveToolResult)
	for _, nativeMsg := range aiChat.NativeMessages {
		msg, ok := nativeMsg.(*KronosChatMessage)
		if !ok {
			continue
		}
		for _, part := range msg.Parts {
			if part.Type == "wave-tool-result" && part.WaveToolResult != nil {
				waveToolResults[part.WaveToolResult.ToolUseID] = *part.WaveToolResult
			}
		}
	}
	for _, nativeMsg := range aiChat.NativeMessages {
		msg, ok := nativeMsg.(*KronosChatMessage)
		if !ok || msg.Hidden {
			continue
		}
		uiMsg := uctypes.UIMessage{
			ID:   msg.MessageId,
			Role: msg.Role,
		}
		for _, part := range msg.Parts {
			switch part.Type {
			case "text":
				if part.Ignored || part.Synthetic || strings.TrimSpace(part.Text) == "" {
					continue
				}
				uiMsg.Parts = append(uiMsg.Parts, uctypes.UIMessagePart{Type: "text", Text: part.Text, State: "done"})
			case "reasoning":
				if strings.TrimSpace(part.Text) == "" {
					continue
				}
				uiMsg.Parts = append(uiMsg.Parts, uctypes.UIMessagePart{Type: "reasoning", Text: part.Text, State: "done"})
			case "file":
				uiMsg.Parts = append(uiMsg.Parts, uctypes.UIMessagePart{
					Type:      "file",
					URL:       part.URL,
					Filename:  part.Filename,
					MediaType: part.Mime,
				})
			case "step-start":
				uiMsg.Parts = append(uiMsg.Parts, uctypes.UIMessagePart{Type: "step-start"})
			case "tool":
				toolData := kronosToolUseDataFromPart(part)
				if part.ToolSource == "wave" && part.WaveToolUseData != nil {
					toolData = *part.WaveToolUseData
					if result, ok := waveToolResults[part.CallID]; ok {
						if result.ErrorText != "" {
							toolData.Status = uctypes.ToolUseStatusError
							toolData.ErrorMessage = result.ErrorText
						} else if toolData.Status != uctypes.ToolUseStatusError {
							toolData.Status = uctypes.ToolUseStatusCompleted
						}
					}
				}
				uiMsg.Parts = append(uiMsg.Parts, uctypes.UIMessagePart{
					Type: "data-tooluse",
					ID:   part.CallID,
					Data: toolData,
				})
			}
		}
		if len(uiMsg.Parts) == 0 {
			continue
		}
		uiChat.Messages = append(uiChat.Messages, uiMsg)
	}
	return uiChat, nil
}

func ensureKronosSession(ctx context.Context, httpClient *http.Client, chatOpts uctypes.WaveChatOpts) (string, error) {
	chat := chatstore.DefaultChatStore.Get(chatOpts.ChatId)
	if chat != nil && chat.BackendSessionId != "" {
		return chat.BackendSessionId, nil
	}

	createBody := map[string]any{}
	createResp := &kronosSessionInfo{}
	if err := doKronosJSON(ctx, httpClient, chatOpts.Config.Endpoint, chatOpts.Config.APIToken, http.MethodPost, "/session", createBody, createResp); err != nil {
		return "", err
	}
	if createResp.ID == "" {
		return "", fmt.Errorf("kronos session create response missing id")
	}
	if err := chatstore.DefaultChatStore.MutateChat(chatOpts.ChatId, func(chat *uctypes.AIChat) error {
		chat.BackendSessionId = createResp.ID
		return nil
	}); err != nil {
		return "", err
	}
	return createResp.ID, nil
}

func postKronosPrompt(ctx context.Context, httpClient *http.Client, chatOpts uctypes.WaveChatOpts, sessionID string) (*kronosServerMessage, error) {
	messages, err := getPendingKronosMessages(chatOpts.ChatId)
	if err != nil {
		return nil, err
	}
	if len(messages) == 0 {
		return nil, fmt.Errorf("no pending Kronos messages to send")
	}

	parts, err := buildKronosPromptParts(messages, chatOpts)
	if err != nil {
		return nil, err
	}
	payload := map[string]any{
		"parts": parts,
	}
	if systemPrompt := buildKronosSystemPrompt(chatOpts); systemPrompt != "" {
		payload["system"] = systemPrompt
	}
	if chatOpts.Config.Agent != "" {
		payload["agent"] = chatOpts.Config.Agent
	}
	if providerID, modelID, ok := parseKronosModel(chatOpts.Config.Model); ok {
		payload["model"] = map[string]string{
			"providerID": providerID,
			"modelID":    modelID,
		}
	} else if chatOpts.Config.Model != "" {
		return nil, fmt.Errorf("kronos ai:model must use provider/model format, got %q", chatOpts.Config.Model)
	}

	respMsg := &kronosServerMessage{}
	path := fmt.Sprintf("/session/%s/message", sessionID)
	if err := doKronosJSON(ctx, httpClient, chatOpts.Config.Endpoint, chatOpts.Config.APIToken, http.MethodPost, path, payload, respMsg); err != nil {
		return nil, err
	}
	if err := markKronosMessagesSynced(chatOpts.ChatId, messages); err != nil {
		return nil, err
	}
	return respMsg, nil
}

func getPendingKronosMessages(chatID string) ([]*KronosChatMessage, error) {
	chat := chatstore.DefaultChatStore.Get(chatID)
	if chat == nil {
		return nil, fmt.Errorf("chat not found: %s", chatID)
	}
	var pending []*KronosChatMessage
	for _, nativeMsg := range chat.NativeMessages {
		msg, ok := nativeMsg.(*KronosChatMessage)
		if !ok || msg.RemoteSynced {
			continue
		}
		pending = append(pending, msg)
	}
	return pending, nil
}

func markKronosMessagesSynced(chatID string, msgs []*KronosChatMessage) error {
	ids := make(map[string]bool)
	for _, msg := range msgs {
		ids[msg.MessageId] = true
	}
	return chatstore.DefaultChatStore.MutateChat(chatID, func(chat *uctypes.AIChat) error {
		for _, nativeMsg := range chat.NativeMessages {
			msg, ok := nativeMsg.(*KronosChatMessage)
			if !ok {
				continue
			}
			if ids[msg.MessageId] {
				msg.RemoteSynced = true
			}
		}
		return nil
	})
}

func buildKronosPromptParts(messages []*KronosChatMessage, chatOpts uctypes.WaveChatOpts) ([]map[string]any, error) {
	var parts []map[string]any
	for _, msg := range messages {
		for _, part := range msg.Parts {
			switch part.Type {
			case "text":
				parts = append(parts, map[string]any{
					"type": "text",
					"text": part.Text,
				})
			case "file":
				parts = append(parts, map[string]any{
					"type":     "file",
					"url":      part.URL,
					"filename": part.Filename,
					"mime":     part.Mime,
				})
			case "wave-tool-result":
				if part.WaveToolResult == nil {
					continue
				}
				resultJSON, err := json.Marshal(part.WaveToolResult)
				if err != nil {
					return nil, err
				}
				parts = append(parts, map[string]any{
					"type": "text",
					"text": kronosWaveToolResultOpenTag + string(resultJSON) + kronosWaveToolResultCloseTag,
				})
			}
		}
	}
	appendPromptContextPart := func(text string) {
		if strings.TrimSpace(text) == "" {
			return
		}
		parts = append(parts, map[string]any{
			"type": "text",
			"text": text,
		})
	}
	appendPromptContextPart(chatOpts.TabState)
	if chatOpts.PlatformInfo != "" {
		appendPromptContextPart("<PlatformInfo>\n" + chatOpts.PlatformInfo + "\n</PlatformInfo>")
	}
	if chatOpts.AppGoFile != "" {
		appendPromptContextPart("<CurrentAppGoFile>\n" + chatOpts.AppGoFile + "\n</CurrentAppGoFile>")
	}
	if chatOpts.AppStaticFiles != "" {
		appendPromptContextPart("<CurrentAppStaticFiles>\n" + chatOpts.AppStaticFiles + "\n</CurrentAppStaticFiles>")
	}
	return parts, nil
}

func buildKronosSystemPrompt(chatOpts uctypes.WaveChatOpts) string {
	prompts := append([]string{}, chatOpts.SystemPrompt...)
	if chatOpts.Config.ToolRouting == kronosToolRoutingKronosOnly || !chatOpts.Config.HasCapability(uctypes.AICapabilityTools) {
		return strings.TrimSpace(strings.Join(prompts, "\n\n"))
	}
	manifest := buildWaveToolManifest(chatOpts)
	if manifest == "" {
		return strings.TrimSpace(strings.Join(prompts, "\n\n"))
	}
	routingNote := "Kronos native tools remain available and should be used whenever they are the best fit."
	if chatOpts.Config.ToolRouting == kronosToolRoutingWaveOnly {
		routingNote = "Prefer the Wave bridge tools below for tab, widget, filesystem, terminal, and in-app browser work. Avoid Kronos native tools unless the Wave bridge cannot satisfy the request."
	}
	prompts = append(prompts, strings.TrimSpace(strings.Join([]string{
		"<WaveToolBridge>",
		routingNote,
		"When you need one of the Wave bridge tools, respond with exactly one XML block and no markdown fences:",
		kronosWaveToolRequestOpenTag + `{"id":"call_id","name":"tool_name","input":{}}` + kronosWaveToolRequestCloseTag,
		"Rules:",
		"- Emit at most one Wave bridge tool request per assistant turn.",
		"- Do not include any explanatory prose inside the XML block.",
		"- Wait for a user message containing a <wave_tool_result>...</wave_tool_result> block before continuing.",
		"- Use Wave bridge tools when you must act on the user's live Kronterm widgets, tabs, terminal blocks, or Wave-scoped files/context.",
		"Available Wave bridge tools:",
		manifest,
		"</WaveToolBridge>",
	}, "\n")))
	return strings.TrimSpace(strings.Join(prompts, "\n\n"))
}

func buildWaveToolManifest(chatOpts uctypes.WaveChatOpts) string {
	toolDefs := make(map[string]uctypes.ToolDefinition)
	collect := func(items []uctypes.ToolDefinition) {
		for _, item := range items {
			if item.Name == "" {
				continue
			}
			if item.Source == "" {
				item.Source = "wave"
			}
			toolDefs[item.Name] = *item.Clean()
		}
	}
	collect(chatOpts.Tools)
	collect(chatOpts.TabTools)
	if len(toolDefs) == 0 {
		return ""
	}
	toolNames := make([]string, 0, len(toolDefs))
	for toolName := range toolDefs {
		toolNames = append(toolNames, toolName)
	}
	sort.Strings(toolNames)
	manifestEntries := make([]map[string]any, 0, len(toolDefs))
	for _, toolName := range toolNames {
		toolDef := toolDefs[toolName]
		manifestEntries = append(manifestEntries, map[string]any{
			"name":            toolDef.Name,
			"description":     toolDef.Description,
			"source":          toolDef.Source,
			"acts_on_widgets": toolDef.ActsOnWidgets,
			"input_schema":    toolDef.InputSchema,
		})
	}
	jsonBytes, err := json.MarshalIndent(manifestEntries, "", "  ")
	if err != nil {
		return ""
	}
	return string(jsonBytes)
}

func parseKronosModel(model string) (string, string, bool) {
	parts := strings.SplitN(model, "/", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "", "", false
	}
	return parts[0], parts[1], true
}

func convertKronosAssistantMessage(respMsg *kronosServerMessage, chatOpts uctypes.WaveChatOpts) (*KronosChatMessage, *uctypes.WaveStopReason, error) {
	msg := &KronosChatMessage{
		MessageId:    respMsg.Info.ID,
		Role:         respMsg.Info.Role,
		RemoteSynced: true,
	}
	if respMsg.Info.Tokens != nil {
		msg.Usage = &uctypes.AIUsage{
			APIType:      chatOpts.Config.APIType,
			Model:        chatOpts.Config.Model,
			InputTokens:  respMsg.Info.Tokens.Input,
			OutputTokens: respMsg.Info.Tokens.Output,
		}
	}

	var waveToolCalls []uctypes.WaveToolCall
	for _, part := range respMsg.Parts {
		switch part.Type {
		case "text":
			convertedParts, calls, err := convertKronosTextPart(part, chatOpts)
			if err != nil {
				return nil, nil, err
			}
			if len(convertedParts) > 0 {
				msg.Parts = append(msg.Parts, convertedParts...)
			}
			waveToolCalls = append(waveToolCalls, calls...)
		case "reasoning":
			msg.Parts = append(msg.Parts, KronosChatPart{Type: "reasoning", ID: part.ID, Text: part.Text})
		case "file":
			msg.Parts = append(msg.Parts, KronosChatPart{Type: "file", ID: part.ID, Mime: part.Mime, Filename: part.Filename, URL: part.URL})
		case "tool":
			msg.Parts = append(msg.Parts, KronosChatPart{
				Type:       "tool",
				ID:         part.ID,
				CallID:     part.CallID,
				Tool:       part.Tool,
				ToolSource: "kronos",
				State:      part.State,
			})
		case "step-start":
			msg.Parts = append(msg.Parts, KronosChatPart{Type: "step-start", ID: part.ID})
		}
	}

	if respMsg.Info.Error != nil && respMsg.Info.Error.Message != "" {
		return msg, &uctypes.WaveStopReason{
			Kind:      uctypes.StopKindError,
			ErrorType: respMsg.Info.Error.Name,
			ErrorText: respMsg.Info.Error.Message,
		}, nil
	}
	if len(waveToolCalls) > 0 {
		return msg, &uctypes.WaveStopReason{
			Kind:      uctypes.StopKindToolUse,
			ToolCalls: waveToolCalls,
		}, nil
	}
	return msg, &uctypes.WaveStopReason{Kind: uctypes.StopKindDone}, nil
}

func convertKronosTextPart(part kronosServerPart, chatOpts uctypes.WaveChatOpts) ([]KronosChatPart, []uctypes.WaveToolCall, error) {
	visibleText, requests, err := extractWaveToolRequests(part.Text)
	if err != nil {
		return nil, nil, err
	}
	var convertedParts []KronosChatPart
	var toolCalls []uctypes.WaveToolCall
	if strings.TrimSpace(visibleText) != "" {
		convertedParts = append(convertedParts, KronosChatPart{
			Type: "text",
			ID:   part.ID,
			Text: visibleText,
		})
	}
	for _, request := range requests {
		argsJSON, err := json.Marshal(request.Input)
		if err != nil {
			return nil, nil, err
		}
		toolUseData := aiutil.CreateToolUseData(request.ID, request.Name, string(argsJSON), chatOpts)
		call := uctypes.WaveToolCall{
			ID:          request.ID,
			Name:        request.Name,
			Input:       request.Input,
			ToolUseData: &toolUseData,
		}
		toolDef := chatOpts.GetToolDefinition(request.Name)
		actsOnWidgets := false
		if toolDef != nil {
			actsOnWidgets = toolDef.ActsOnWidgets
		}
		convertedParts = append(convertedParts, KronosChatPart{
			Type:          "tool",
			ID:            request.ID,
			CallID:        request.ID,
			Tool:          request.Name,
			ToolSource:    "wave",
			ActsOnWidgets: actsOnWidgets,
			State: &kronosToolState{
				Status: "pending",
				Input:  request.Input,
			},
			WaveToolUseData: &toolUseData,
		})
		toolCalls = append(toolCalls, call)
	}
	return convertedParts, toolCalls, nil
}

func extractWaveToolRequests(text string) (string, []kronosWaveToolRequest, error) {
	if !strings.Contains(text, kronosWaveToolRequestOpenTag) {
		return text, nil, nil
	}
	var sanitized strings.Builder
	var requests []kronosWaveToolRequest
	remaining := text
	for {
		start := strings.Index(remaining, kronosWaveToolRequestOpenTag)
		if start == -1 {
			sanitized.WriteString(remaining)
			break
		}
		sanitized.WriteString(remaining[:start])
		remaining = remaining[start+len(kronosWaveToolRequestOpenTag):]
		end := strings.Index(remaining, kronosWaveToolRequestCloseTag)
		if end == -1 {
			sanitized.WriteString(kronosWaveToolRequestOpenTag)
			sanitized.WriteString(remaining)
			break
		}
		payload := strings.TrimSpace(remaining[:end])
		remaining = remaining[end+len(kronosWaveToolRequestCloseTag):]
		if payload == "" {
			continue
		}
		var request kronosWaveToolRequest
		if err := json.Unmarshal([]byte(payload), &request); err != nil {
			return text, nil, nil
		}
		if request.ID == "" {
			request.ID = uuid.New().String()
		}
		requests = append(requests, request)
	}
	return sanitized.String(), requests, nil
}

func flushKronosAssistantToSSE(state *kronosStreamState, assistantMsg *KronosChatMessage, sseHandler *sse.SSEHandlerCh) {
	if assistantMsg == nil {
		return
	}
	state.lock.Lock()
	if !state.messageStarted {
		state.messageStarted = true
		state.assistantMessageID = assistantMsg.MessageId
		state.lock.Unlock()
		_ = sseHandler.AiMsgStart(assistantMsg.MessageId)
	} else {
		state.lock.Unlock()
	}
	for _, part := range assistantMsg.Parts {
		switch part.Type {
		case "text":
			state.lock.Lock()
			textState := state.textParts[part.ID]
			if textState == nil {
				textState = &kronosTextStreamState{}
				state.textParts[part.ID] = textState
			}
			state.lock.Unlock()
			flushKronosTextPart(part, textState, sseHandler)
		case "tool":
			if part.ToolSource != "kronos" {
				continue
			}
			toolData := kronosToolUseDataFromPart(part)
			_ = sseHandler.AiMsgData("data-tooluse", toolData.ToolCallId, toolData)
		}
	}
}

func flushKronosTextPart(part KronosChatPart, state *kronosTextStreamState, sseHandler *sse.SSEHandlerCh) {
	if state == nil || state.Ended {
		return
	}
	textDelta := part.Text
	if state.RawSeen < len(part.Text) {
		textDelta = part.Text[state.RawSeen:]
		state.RawSeen = len(part.Text)
	} else {
		textDelta = ""
	}
	visible := state.consume(textDelta)
	if visible != "" {
		if !state.Started {
			state.Started = true
			_ = sseHandler.AiMsgTextStart(part.ID)
		}
		_ = sseHandler.AiMsgTextDelta(part.ID, visible)
	}
	finalVisible := state.finalize()
	if finalVisible != "" {
		if !state.Started {
			state.Started = true
			_ = sseHandler.AiMsgTextStart(part.ID)
		}
		_ = sseHandler.AiMsgTextDelta(part.ID, finalVisible)
	}
	if state.Started {
		_ = sseHandler.AiMsgTextEnd(part.ID)
	}
	state.Ended = true
}

func (s *kronosTextStreamState) consume(delta string) string {
	s.Buffer += delta
	var out strings.Builder
	for {
		if s.InsideTag {
			closeIdx := strings.Index(s.Buffer, kronosWaveToolRequestCloseTag)
			if closeIdx == -1 {
				return out.String()
			}
			s.Buffer = s.Buffer[closeIdx+len(kronosWaveToolRequestCloseTag):]
			s.InsideTag = false
			continue
		}
		openIdx := strings.Index(s.Buffer, kronosWaveToolRequestOpenTag)
		if openIdx >= 0 {
			out.WriteString(s.Buffer[:openIdx])
			s.Buffer = s.Buffer[openIdx+len(kronosWaveToolRequestOpenTag):]
			s.InsideTag = true
			continue
		}
		keep := len(kronosWaveToolRequestOpenTag) - 1
		if keep < 0 {
			keep = 0
		}
		if len(s.Buffer) <= keep {
			return out.String()
		}
		flushLen := len(s.Buffer) - keep
		out.WriteString(s.Buffer[:flushLen])
		s.Buffer = s.Buffer[flushLen:]
		return out.String()
	}
}

func (s *kronosTextStreamState) finalize() string {
	var out strings.Builder
	for {
		if s.InsideTag {
			closeIdx := strings.Index(s.Buffer, kronosWaveToolRequestCloseTag)
			if closeIdx == -1 {
				s.Buffer = ""
				return out.String()
			}
			s.Buffer = s.Buffer[closeIdx+len(kronosWaveToolRequestCloseTag):]
			s.InsideTag = false
			continue
		}
		openIdx := strings.Index(s.Buffer, kronosWaveToolRequestOpenTag)
		if openIdx == -1 {
			out.WriteString(s.Buffer)
			s.Buffer = ""
			return out.String()
		}
		out.WriteString(s.Buffer[:openIdx])
		s.Buffer = s.Buffer[openIdx+len(kronosWaveToolRequestOpenTag):]
		s.InsideTag = true
	}
}

func streamKronosEvents(ctx context.Context, httpClient *http.Client, chatOpts uctypes.WaveChatOpts, sessionID string, state *kronosStreamState, sseHandler *sse.SSEHandlerCh) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, strings.TrimRight(chatOpts.Config.Endpoint, "/")+"/global/event", nil)
	if err != nil {
		return
	}
	applyKronosAuth(req, chatOpts.Config.APIToken)
	req.Header.Set("Accept", "text/event-stream")
	resp, err := httpClient.Do(req)
	if err != nil {
		return
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return
	}
	decoder := eventsource.NewDecoder(resp.Body)
	for {
		event, err := decoder.Decode()
		if err != nil {
			return
		}
		var globalEvent kronosGlobalEvent
		if err := json.Unmarshal([]byte(event.Data()), &globalEvent); err != nil {
			continue
		}
		switch globalEvent.Payload.Type {
		case "message.updated":
			var payload kronosMessageUpdatedEvent
			if json.Unmarshal(globalEvent.Payload.Properties, &payload) != nil {
				continue
			}
			if payload.Info.SessionID != sessionID || payload.Info.Role != "assistant" {
				continue
			}
			state.lock.Lock()
			if !state.messageStarted {
				state.messageStarted = true
				state.assistantMessageID = payload.Info.ID
				state.lock.Unlock()
				_ = sseHandler.AiMsgStart(payload.Info.ID)
			} else {
				state.lock.Unlock()
			}
		case "message.part.delta":
			var payload kronosMessagePartDeltaEvent
			if json.Unmarshal(globalEvent.Payload.Properties, &payload) != nil {
				continue
			}
			if payload.SessionID != sessionID || payload.Field != "text" {
				continue
			}
			state.lock.Lock()
			if state.assistantMessageID == "" || payload.MessageID != state.assistantMessageID {
				state.lock.Unlock()
				continue
			}
			textState := state.textParts[payload.PartID]
			if textState == nil {
				textState = &kronosTextStreamState{}
				state.textParts[payload.PartID] = textState
			}
			state.lock.Unlock()
			visible := textState.consume(payload.Delta)
			if visible == "" {
				continue
			}
			if !textState.Started {
				textState.Started = true
				_ = sseHandler.AiMsgTextStart(payload.PartID)
			}
			_ = sseHandler.AiMsgTextDelta(payload.PartID, visible)
		case "permission.asked":
			var payload kronosPermissionAskedEvent
			if json.Unmarshal(globalEvent.Payload.Properties, &payload) != nil {
				continue
			}
			if payload.SessionID != sessionID {
				continue
			}
			handleKronosPermissionEvent(ctx, httpClient, chatOpts, sessionID, payload)
		}
	}
}

func handleKronosPermissionEvent(ctx context.Context, httpClient *http.Client, chatOpts uctypes.WaveChatOpts, sessionID string, evt kronosPermissionAskedEvent) {
	response := "reject"
	switch chatOpts.Config.PermissionMode {
	case "always":
		response = "always"
	case "once":
		response = "once"
	}
	body := map[string]string{"response": response}
	path := fmt.Sprintf("/session/%s/permissions/%s", sessionID, evt.ID)
	_ = doKronosJSON(ctx, httpClient, chatOpts.Config.Endpoint, chatOpts.Config.APIToken, http.MethodPost, path, body, nil)
}

func kronosToolUseDataFromPart(part KronosChatPart) uctypes.UIMessageDataToolUse {
	status := uctypes.ToolUseStatusPending
	errorMessage := ""
	toolDesc := part.Tool
	if part.State != nil {
		switch part.State.Status {
		case "completed":
			status = uctypes.ToolUseStatusCompleted
		case "error":
			status = uctypes.ToolUseStatusError
			errorMessage = part.State.Error
		case "running", "pending":
			status = uctypes.ToolUseStatusPending
		}
		if part.State.Title != "" {
			toolDesc = part.State.Title
		}
	}
	if toolDesc == "" {
		toolDesc = part.Tool
	}
	return uctypes.UIMessageDataToolUse{
		ToolCallId:    part.CallID,
		ToolName:      part.Tool,
		ToolDesc:      toolDesc,
		Status:        status,
		ErrorMessage:  errorMessage,
		ToolSource:    part.ToolSource,
		ActsOnWidgets: part.ActsOnWidgets,
	}
}

func doKronosJSON(ctx context.Context, httpClient *http.Client, endpoint string, apiToken string, method string, path string, body any, out any) error {
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
	applyKronosAuth(req, apiToken)
	resp, err := httpClient.Do(req)
	if err != nil {
		return err
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
		return fmt.Errorf("kronos %s %s failed: %s", method, path, msg)
	}
	if out != nil && len(respBytes) > 0 {
		if err := json.Unmarshal(respBytes, out); err != nil {
			return err
		}
	}
	return nil
}

func applyKronosAuth(req *http.Request, apiToken string) {
	if strings.TrimSpace(apiToken) == "" {
		return
	}
	authValue := base64.StdEncoding.EncodeToString([]byte("kronoscode:" + apiToken))
	req.Header.Set("Authorization", "Basic "+authValue)
}

func makeDataURL(mimeType string, data []byte) string {
	if len(data) == 0 {
		return ""
	}
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}
	return fmt.Sprintf("data:%s;base64,%s", mimeType, base64.StdEncoding.EncodeToString(data))
}
