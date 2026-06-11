// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

// types and methods for wsh rpc calls
package wshrpc

import (
	"bytes"
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/wavetermdev/waveterm/pkg/aiusechat/uctypes"
	"github.com/wavetermdev/waveterm/pkg/baseds"
	"github.com/wavetermdev/waveterm/pkg/telemetry/telemetrydata"
	"github.com/wavetermdev/waveterm/pkg/vdom"
	"github.com/wavetermdev/waveterm/pkg/waveobj"
	"github.com/wavetermdev/waveterm/pkg/wconfig"
	"github.com/wavetermdev/waveterm/pkg/wps"
)

type RespOrErrorUnion[T any] struct {
	Response T
	Error    error
}

type MultiArg struct {
	Args []any `json:"args"`
}

// Instructions for adding a new RPC call
// * methods must end with Command
// * methods must take context as their first parameter
// * methods may take additional typed parameters, and may return either just an error, or one return value plus an error
// * after modifying WshRpcInterface, run `task generate` to regnerate bindings

type WshRpcInterface interface {
	AuthenticateCommand(ctx context.Context, data string) (CommandAuthenticateRtnData, error)
	AuthenticateTokenCommand(ctx context.Context, data CommandAuthenticateTokenData) (CommandAuthenticateRtnData, error)
	AuthenticateTokenVerifyCommand(ctx context.Context, data CommandAuthenticateTokenData) (CommandAuthenticateRtnData, error) // (special) validates token without binding, root router only
	AuthenticateJobManagerCommand(ctx context.Context, data CommandAuthenticateJobManagerData) error
	AuthenticateJobManagerVerifyCommand(ctx context.Context, data CommandAuthenticateJobManagerData) error // (special) validates job auth token without binding, root router only
	DisposeCommand(ctx context.Context, data CommandDisposeData) error
	RouteAnnounceCommand(ctx context.Context) error               // (special) announces a new route to the main router
	RouteUnannounceCommand(ctx context.Context) error             // (special) unannounces a route to the main router
	ControlGetRouteIdCommand(ctx context.Context) (string, error) // (special) gets the route for the link that we're on
	SetPeerInfoCommand(ctx context.Context, peerInfo string) error
	GetJwtPublicKeyCommand(ctx context.Context) (string, error) // (special) gets the public JWT signing key
	CreateSurfaceTokenCommand(ctx context.Context, data CommandCreateSurfaceTokenData) (*CommandCreateSurfaceTokenRtnData, error)

	MessageCommand(ctx context.Context, data CommandMessageData) error
	GetMetaCommand(ctx context.Context, data CommandGetMetaData) (waveobj.MetaMapType, error)
	SetMetaCommand(ctx context.Context, data CommandSetMetaData) error
	ControllerInputCommand(ctx context.Context, data CommandBlockInputData) error
	ControllerDestroyCommand(ctx context.Context, blockId string) error
	ControllerResyncCommand(ctx context.Context, data CommandControllerResyncData) error
	ControllerAppendOutputCommand(ctx context.Context, data CommandControllerAppendOutputData) error
	ResolveIdsCommand(ctx context.Context, data CommandResolveIdsData) (CommandResolveIdsRtnData, error)
	CreateBlockCommand(ctx context.Context, data CommandCreateBlockData) (waveobj.ORef, error)
	CreateSubBlockCommand(ctx context.Context, data CommandCreateSubBlockData) (waveobj.ORef, error)
	DeleteBlockCommand(ctx context.Context, data CommandDeleteBlockData) error
	DeleteSubBlockCommand(ctx context.Context, data CommandDeleteBlockData) error
	WaitForRouteCommand(ctx context.Context, data CommandWaitForRouteData) (bool, error)

	EventPublishCommand(ctx context.Context, data wps.WaveEvent) error
	EventSubCommand(ctx context.Context, data wps.SubscriptionRequest) error
	EventUnsubCommand(ctx context.Context, data string) error
	EventUnsubAllCommand(ctx context.Context) error
	EventReadHistoryCommand(ctx context.Context, data CommandEventReadHistoryData) ([]*wps.WaveEvent, error)

	FileRestoreBackupCommand(ctx context.Context, data CommandFileRestoreBackupData) error
	GetTempDirCommand(ctx context.Context, data CommandGetTempDirData) (string, error)
	WriteTempFileCommand(ctx context.Context, data CommandWriteTempFileData) (string, error)
	StreamTestCommand(ctx context.Context) chan RespOrErrorUnion[int]
	StreamWaveAiCommand(ctx context.Context, request WaveAIStreamRequest) chan RespOrErrorUnion[WaveAIPacketType]
	StreamCpuDataCommand(ctx context.Context, request CpuDataRequest) chan RespOrErrorUnion[TimeSeriesData]
	TestCommand(ctx context.Context, data string) error
	TestMultiArgCommand(ctx context.Context, arg1 string, arg2 int, arg3 bool) (string, error)
	SetConfigCommand(ctx context.Context, data MetaSettingsType) error
	SetConnectionsConfigCommand(ctx context.Context, data ConnConfigRequest) error
	GetFullConfigCommand(ctx context.Context) (wconfig.FullConfigType, error)
	GetWaveAIModeConfigCommand(ctx context.Context) (wconfig.AIModeConfigUpdate, error)
	BlockInfoCommand(ctx context.Context, blockId string) (*BlockInfoData, error)
	GetBlockContentCommand(ctx context.Context, blockId string) (*CommandGetBlockContentRtnData, error)
	DebugTermCommand(ctx context.Context, data CommandDebugTermData) (*CommandDebugTermRtnData, error)
	BlocksListCommand(ctx context.Context, data BlocksListRequest) ([]BlocksListEntry, error)
	WaveInfoCommand(ctx context.Context) (*WaveInfoData, error)
	MacOSVersionCommand(ctx context.Context) (string, error)
	WshActivityCommand(ct context.Context, data map[string]int) error
	ActivityCommand(ctx context.Context, data ActivityUpdate) error
	RecordTEventCommand(ctx context.Context, data telemetrydata.TEvent) error
	GetVarCommand(ctx context.Context, data CommandVarData) (*CommandVarResponseData, error)
	GetAllVarsCommand(ctx context.Context, data CommandVarData) ([]CommandVarResponseData, error)
	SetVarCommand(ctx context.Context, data CommandVarData) error
	PathCommand(ctx context.Context, data PathCommandData) (string, error)
	SendTelemetryCommand(ctx context.Context) error
	FetchSuggestionsCommand(ctx context.Context, data FetchSuggestionsData) (*FetchSuggestionsResponse, error)
	DisposeSuggestionsCommand(ctx context.Context, widgetId string) error
	GetTabCommand(ctx context.Context, tabId string) (*waveobj.Tab, error)
	UpdateTabNameCommand(ctx context.Context, tabId string, newName string) error
	UpdateWorkspaceTabIdsCommand(ctx context.Context, workspaceId string, tabIds []string) error
	GetAllBadgesCommand(ctx context.Context) ([]baseds.BadgeEvent, error)

	// connection functions
	ConnStatusCommand(ctx context.Context) ([]ConnStatus, error)
	WslStatusCommand(ctx context.Context) ([]ConnStatus, error)
	ConnEnsureCommand(ctx context.Context, data ConnExtData) error
	ConnReinstallWshCommand(ctx context.Context, data ConnExtData) error
	ConnConnectCommand(ctx context.Context, connRequest ConnRequest) error
	ConnDisconnectCommand(ctx context.Context, connName string) error
	ConnListCommand(ctx context.Context) ([]string, error)
	WslListCommand(ctx context.Context) ([]string, error)
	WslDefaultDistroCommand(ctx context.Context) (string, error)
	DismissWshFailCommand(ctx context.Context, connName string) error
	ConnUpdateWshCommand(ctx context.Context, remoteInfo RemoteInfo) (bool, error)
	FindGitBashCommand(ctx context.Context, rescan bool) (string, error)
	ConnServerInitCommand(ctx context.Context, data CommandConnServerInitData) error
	NotifySystemResumeCommand(ctx context.Context) error

	// eventrecv is special, it's handled internally by WshRpc with EventListener
	EventRecvCommand(ctx context.Context, data wps.WaveEvent) error

	// remotes
	WshRpcRemoteFileInterface
	RemoteStreamCpuDataCommand(ctx context.Context) chan RespOrErrorUnion[TimeSeriesData]
	RemoteGetInfoCommand(ctx context.Context) (RemoteInfo, error)
	RemoteInstallRcFilesCommand(ctx context.Context) error
	RemoteStartJobCommand(ctx context.Context, data CommandRemoteStartJobData) (*CommandStartJobRtnData, error)
	RemoteReconnectToJobManagerCommand(ctx context.Context, data CommandRemoteReconnectToJobManagerData) (*CommandRemoteReconnectToJobManagerRtnData, error)
	RemoteDisconnectFromJobManagerCommand(ctx context.Context, data CommandRemoteDisconnectFromJobManagerData) error
	RemoteTerminateJobManagerCommand(ctx context.Context, data CommandRemoteTerminateJobManagerData) error
	BadgeWatchPidCommand(ctx context.Context, data CommandBadgeWatchPidData) error

	// emain
	WebSelectorCommand(ctx context.Context, data CommandWebSelectorData) ([]string, error)
	WebEvalCommand(ctx context.Context, data CommandWebEvalData) (string, error)
	NotifyCommand(ctx context.Context, notificationOptions WaveNotificationOptions) error
	FocusWindowCommand(ctx context.Context, windowId string) error
	ElectronEncryptCommand(ctx context.Context, data CommandElectronEncryptData) (*CommandElectronEncryptRtnData, error)
	ElectronDecryptCommand(ctx context.Context, data CommandElectronDecryptData) (*CommandElectronDecryptRtnData, error)
	NetworkOnlineCommand(ctx context.Context) (bool, error)
	ElectronSystemBellCommand(ctx context.Context) error

	// installed apps
	ListInstalledAppsCommand(ctx context.Context) ([]InstalledAppInfo, error)
	LaunchInstalledAppCommand(ctx context.Context, data CommandLaunchInstalledAppData) error

	// secrets
	GetSecretsCommand(ctx context.Context, names []string) (map[string]string, error)
	GetSecretsNamesCommand(ctx context.Context) ([]string, error)
	SetSecretsCommand(ctx context.Context, secrets map[string]*string) error
	GetSecretsLinuxStorageBackendCommand(ctx context.Context) (string, error)

	// mcp
	McpListServersCommand(ctx context.Context) ([]McpServerInfo, error)
	McpConnectCommand(ctx context.Context, serverName string) error
	McpDisconnectCommand(ctx context.Context, serverName string) error
	McpListToolsCommand(ctx context.Context, serverName string) ([]McpToolInfo, error)
	McpCallToolCommand(ctx context.Context, data McpCallToolData) (*McpCallToolResult, error)
	McpGetStatusCommand(ctx context.Context) (map[string]McpStatus, error)

	SandboxStartCommand(ctx context.Context, data SandboxStartRequest) (SandboxStartResponse, error)
	SandboxStopCommand(ctx context.Context, data SandboxStopRequest) (SandboxStopResponse, error)
	SandboxStatusCommand(ctx context.Context, data SandboxStatusRequest) (SandboxStatusResponse, error)

	AppStreamStartCommand(ctx context.Context, data AppStreamStartRequest) (AppStreamStartResponse, error)
	AppStreamStopCommand(ctx context.Context, data AppStreamStopRequest) error
	AppStreamActionCommand(ctx context.Context, data AppStreamActionRequest) error
	CanvasLoadCommand(ctx context.Context, data CanvasLoadRequest) (*CanvasLoadResponse, error)
	CanvasSaveCommand(ctx context.Context, data CanvasSaveRequest) error
	CanvasSnapshotCommand(ctx context.Context, data CanvasSnapshotRequest) (*CanvasSnapshotResponse, error)
	CanvasAssetUploadCommand(ctx context.Context, data CanvasAssetUploadRequest) (*CanvasAssetUploadResponse, error)
	CanvasCreateNodeCommand(ctx context.Context, data CanvasNodeMutationRequest) (*CanvasNode, error)
	CanvasUpdateNodeCommand(ctx context.Context, data CanvasNodeMutationRequest) (*CanvasNode, error)
	CanvasDeleteNodeCommand(ctx context.Context, data CanvasNodeIdRequest) error
	CanvasConnectNodesCommand(ctx context.Context, data CanvasConnectNodesRequest) (*CanvasEdge, error)
	CanvasLaunchNodeCommand(ctx context.Context, data CanvasLaunchNodeRequest) (*CanvasLaunchNodeResponse, error)

	WorkspaceListCommand(ctx context.Context) ([]WorkspaceInfoData, error)
	GetUpdateChannelCommand(ctx context.Context) (string, error)

	// terminal
	VDomCreateContextCommand(ctx context.Context, data vdom.VDomCreateContext) (*waveobj.ORef, error)
	VDomAsyncInitiationCommand(ctx context.Context, data vdom.VDomAsyncInitiationRequest) error

	// ai
	AiSendMessageCommand(ctx context.Context, data AiMessageData) error
	WaveAIEnableTelemetryCommand(ctx context.Context) error
	GetWaveAIChatCommand(ctx context.Context, data CommandGetWaveAIChatData) (*uctypes.UIChat, error)
	GetWaveAIRateLimitCommand(ctx context.Context) (*uctypes.RateLimitInfo, error)
	WaveAIToolApproveCommand(ctx context.Context, data CommandWaveAIToolApproveData) error
	WaveAIAddContextCommand(ctx context.Context, data CommandWaveAIAddContextData) error
	WaveAIGetToolDiffCommand(ctx context.Context, data CommandWaveAIGetToolDiffData) (*CommandWaveAIGetToolDiffRtnData, error)

	// screenshot
	CaptureBlockScreenshotCommand(ctx context.Context, data CommandCaptureBlockScreenshotData) (string, error)
	WidgetScreenshotAnnotatedCommand(ctx context.Context, data CommandWidgetScreenshotAnnotatedData) (*WidgetScreenshotAnnotatedRtnData, error)

	// human simulation
	WidgetGetElementsCommand(ctx context.Context, data CommandWidgetGetElementsData) (*WidgetGetElementsRtnData, error)
	WidgetGetStateCommand(ctx context.Context, data CommandWidgetGetStateData) (*WidgetGetStateRtnData, error)
	WidgetMouseClickCommand(ctx context.Context, data CommandWidgetMouseClickData) (*WidgetMouseActionRtnData, error)
	WidgetMouseScrollCommand(ctx context.Context, data CommandWidgetMouseScrollData) (*WidgetMouseActionRtnData, error)
	WidgetMouseDragCommand(ctx context.Context, data CommandWidgetMouseDragData) (*WidgetMouseActionRtnData, error)
	WidgetKeyboardTypeCommand(ctx context.Context, data CommandWidgetKeyboardTypeData) (*WidgetMouseActionRtnData, error)
	WidgetKeyboardPressCommand(ctx context.Context, data CommandWidgetKeyboardPressData) (*WidgetMouseActionRtnData, error)
	WidgetWaitForElementCommand(ctx context.Context, data CommandWidgetWaitForElementData) (*WidgetWaitForElementRtnData, error)
	WidgetSnapshotCommand(ctx context.Context, data CommandWidgetSnapshotData) (*WidgetSnapshotRtnData, error)
	WidgetFindCommand(ctx context.Context, data CommandWidgetFindData) (*WidgetFindRtnData, error)
	WidgetInspectCommand(ctx context.Context, data CommandWidgetInspectData) (*WidgetInspectRtnData, error)
	WidgetElementAtCommand(ctx context.Context, data CommandWidgetElementAtData) (*WidgetElementAtRtnData, error)
	WidgetClickCommand(ctx context.Context, data CommandWidgetClickData) (*WidgetMouseActionRtnData, error)
	WidgetHoverCommand(ctx context.Context, data CommandWidgetHoverData) (*WidgetMouseActionRtnData, error)
	WidgetLongPressCommand(ctx context.Context, data CommandWidgetLongPressData) (*WidgetMouseActionRtnData, error)
	WidgetDragCommand(ctx context.Context, data CommandWidgetDragData) (*WidgetMouseActionRtnData, error)
	WidgetScrollToCommand(ctx context.Context, data CommandWidgetScrollToData) (*WidgetMouseActionRtnData, error)
	WidgetGetValueCommand(ctx context.Context, data CommandWidgetGetValueData) (*WidgetGetValueRtnData, error)
	WidgetSetValueCommand(ctx context.Context, data CommandWidgetSetValueData) (*WidgetMouseActionRtnData, error)
	WidgetClearCommand(ctx context.Context, data CommandWidgetClearData) (*WidgetMouseActionRtnData, error)
	WidgetSelectCommand(ctx context.Context, data CommandWidgetSelectData) (*WidgetMouseActionRtnData, error)
	WidgetToggleCommand(ctx context.Context, data CommandWidgetToggleData) (*WidgetMouseActionRtnData, error)
	WidgetClipboardGetCommand(ctx context.Context, data CommandWidgetClipboardGetData) (*WidgetClipboardGetRtnData, error)
	WidgetClipboardSetCommand(ctx context.Context, data CommandWidgetClipboardSetData) (*WidgetMouseActionRtnData, error)
	WidgetWaitConditionCommand(ctx context.Context, data CommandWidgetWaitConditionData) (*WidgetWaitConditionRtnData, error)

	// block focus
	SetBlockFocusCommand(ctx context.Context, blockId string) error
	GetFocusedBlockDataCommand(ctx context.Context) (*FocusedBlockData, error)

	// rtinfo
	GetRTInfoCommand(ctx context.Context, data CommandGetRTInfoData) (*waveobj.ObjRTInfo, error)
	SetRTInfoCommand(ctx context.Context, data CommandSetRTInfoData) error

	// terminal
	TermGetScrollbackLinesCommand(ctx context.Context, data CommandTermGetScrollbackLinesData) (*CommandTermGetScrollbackLinesRtnData, error)

	// file
	WshRpcFileInterface
	WaveFileReadStreamCommand(ctx context.Context, data CommandWaveFileReadStreamData) (*WaveFileInfo, error)

	// proc
	VDomRenderCommand(ctx context.Context, data vdom.VDomFrontendUpdate) chan RespOrErrorUnion[*vdom.VDomBackendUpdate]
	VDomUrlRequestCommand(ctx context.Context, data VDomUrlRequestData) chan RespOrErrorUnion[VDomUrlRequestResponse]

	// streams
	StreamDataCommand(ctx context.Context, data CommandStreamData) error
	StreamDataAckCommand(ctx context.Context, data CommandStreamAckData) error

	// jobs
	AuthenticateToJobManagerCommand(ctx context.Context, data CommandAuthenticateToJobData) error
	StartJobCommand(ctx context.Context, data CommandStartJobData) (*CommandStartJobRtnData, error)
	JobPrepareConnectCommand(ctx context.Context, data CommandJobPrepareConnectData) (*CommandJobConnectRtnData, error)
	JobStartStreamCommand(ctx context.Context, data CommandJobStartStreamData) error
	JobInputCommand(ctx context.Context, data CommandJobInputData) error
	JobCmdExitedCommand(ctx context.Context, data CommandJobCmdExitedData) error // this is sent FROM the job manager => main server

	// job controller
	JobControllerDeleteJobCommand(ctx context.Context, jobId string) error
	JobControllerListCommand(ctx context.Context) ([]*waveobj.Job, error)
	JobControllerStartJobCommand(ctx context.Context, data CommandJobControllerStartJobData) (string, error)
	JobControllerExitJobCommand(ctx context.Context, jobId string) error
	JobControllerDisconnectJobCommand(ctx context.Context, jobId string) error
	JobControllerReconnectJobCommand(ctx context.Context, jobId string) error
	JobControllerReconnectJobsForConnCommand(ctx context.Context, connName string) error
	JobControllerConnectedJobsCommand(ctx context.Context) ([]string, error)
	JobControllerAttachJobCommand(ctx context.Context, data CommandJobControllerAttachJobData) error
	JobControllerDetachJobCommand(ctx context.Context, jobId string) error
	JobControllerGetAllJobManagerStatusCommand(ctx context.Context) ([]*JobManagerStatusUpdate, error)
	BlockJobStatusCommand(ctx context.Context, blockId string) (*BlockJobStatusData, error)

	// window management
	WindowListCommand(ctx context.Context) ([]WindowInfo, error)
	CreateWindowCommand(ctx context.Context) (string, error)
	CloseWindowCommand(ctx context.Context, windowId string) error
	ActivateWindowCommand(ctx context.Context, windowId string) error

	// bookmark management
	BookmarkListCommand(ctx context.Context) (map[string]wconfig.WebBookmark, error)
	BookmarkCreateCommand(ctx context.Context, data BookmarkCreateData) error
	BookmarkRemoveCommand(ctx context.Context, bookmarkId string) error
	BookmarkUpdateCommand(ctx context.Context, data BookmarkUpdateData) error
	BookmarkMoveCommand(ctx context.Context, data BookmarkMoveData) error
	BookmarkSearchCommand(ctx context.Context, query string) ([]BookmarkSearchResult, error)

	// history management
	HistorySearchCommand(ctx context.Context, data HistorySearchData) ([]HistoryEntry, error)
	HistoryRecentCommand(ctx context.Context, maxItems int) ([]HistoryEntry, error)
	HistoryDeleteUrlCommand(ctx context.Context, url string) error
	HistoryDeleteRangeCommand(ctx context.Context, data HistoryDeleteRangeData) error

	// tab group management
	TabGroupListCommand(ctx context.Context) ([]TabGroupInfo, error)
	GroupTabsCommand(ctx context.Context, data GroupTabsData) error
	UpdateTabGroupCommand(ctx context.Context, data UpdateTabGroupData) error
	UngroupTabsCommand(ctx context.Context, tabGroupId string) error
	CloseTabGroupCommand(ctx context.Context, tabGroupId string) error

	// browseros info
	BrowserOSInfoCommand(ctx context.Context) (*BrowserOSInfo, error)
}

// for frontend
type WshServerCommandMeta struct {
	CommandType string `json:"commandtype"`
}

type RpcOpts struct {
	Timeout    int64  `json:"timeout,omitempty"`
	NoResponse bool   `json:"noresponse,omitempty"`
	Route      string `json:"route,omitempty"`

	StreamCancelFn func(context.Context) error `json:"-"` // this is an *output* parameter, set by the handler
}

type RpcContext struct {
	SockName  string `json:"sockname,omitempty"`  // the domain socket name
	RouteId   string `json:"routeid"`             // the routeid from the jwt
	ProcRoute bool   `json:"procroute,omitempty"` // use a random procid for route
	BlockId   string `json:"blockid,omitempty"`   // blockid for this rpc
	Conn      string `json:"conn,omitempty"`      // the conn name
	IsRouter  bool   `json:"isrouter,omitempty"`  // if this is for a sub-router
}

func (rc RpcContext) GenerateRouteId() string {
	if rc.RouteId != "" {
		return rc.RouteId
	}
	return "proc:" + uuid.New().String()
}

type CommandAuthenticateRtnData struct {
	RouteId string `json:"routeid"`

	// these fields are only set when doing a token swap
	Env            map[string]string `json:"env,omitempty"`
	InitScriptText string            `json:"initscripttext,omitempty"`
	RpcContext     *RpcContext       `json:"rpccontext,omitempty"`
}

type CommandAuthenticateTokenData struct {
	Token string `json:"token"`
}

type CommandCreateSurfaceTokenData struct {
	TabId   string `json:"tabid"`
	BlockId string `json:"blockid,omitempty"`
}

type CommandCreateSurfaceTokenRtnData struct {
	Token     string `json:"token"`
	TabId     string `json:"tabid"`
	BlockId   string `json:"blockid,omitempty"`
	ExpiresAt int64  `json:"expiresat"`
}

type CommandDisposeData struct {
	RouteId string `json:"routeid"`
	// auth token travels in the packet directly
}

type CommandMessageData struct {
	Message string `json:"message"`
}

type CommandGetMetaData struct {
	ORef waveobj.ORef `json:"oref"`
}

type CommandSetMetaData struct {
	ORef waveobj.ORef        `json:"oref"`
	Meta waveobj.MetaMapType `json:"meta"`
}

type CommandResolveIdsData struct {
	BlockId string   `json:"blockid"`
	Ids     []string `json:"ids"`
}

type CommandResolveIdsRtnData struct {
	ResolvedIds map[string]waveobj.ORef `json:"resolvedids"`
}

type CommandCreateBlockData struct {
	TabId         string               `json:"tabid"`
	BlockDef      *waveobj.BlockDef    `json:"blockdef"`
	RtOpts        *waveobj.RuntimeOpts `json:"rtopts,omitempty"`
	Magnified     bool                 `json:"magnified,omitempty"`
	Ephemeral     bool                 `json:"ephemeral,omitempty"`
	Focused       bool                 `json:"focused,omitempty"`
	TargetBlockId string               `json:"targetblockid,omitempty"`
	TargetAction  string               `json:"targetaction,omitempty"` // "replace", "splitright", "splitdown", "splitleft", "splitup"
}

type CommandCreateSubBlockData struct {
	ParentBlockId string            `json:"parentblockid"`
	BlockDef      *waveobj.BlockDef `json:"blockdef"`
}

type CommandControllerResyncData struct {
	ForceRestart bool                 `json:"forcerestart,omitempty"`
	TabId        string               `json:"tabid"`
	BlockId      string               `json:"blockid"`
	RtOpts       *waveobj.RuntimeOpts `json:"rtopts,omitempty"`
}

type CommandControllerAppendOutputData struct {
	BlockId string `json:"blockid"`
	Data64  string `json:"data64"`
}

type CommandBlockInputData struct {
	BlockId     string            `json:"blockid"`
	InputData64 string            `json:"inputdata64,omitempty"`
	SigName     string            `json:"signame,omitempty"`
	TermSize    *waveobj.TermSize `json:"termsize,omitempty"`
}

type CommandJobInputData struct {
	JobId          string            `json:"jobid"`
	InputSessionId string            `json:"inputsessionid,omitempty"`
	SeqNum         int               `json:"seqnum,omitempty"`
	InputData64    string            `json:"inputdata64,omitempty"`
	SigName        string            `json:"signame,omitempty"`
	TermSize       *waveobj.TermSize `json:"termsize,omitempty"`
}

type CommandWaitForRouteData struct {
	RouteId string `json:"routeid"`
	WaitMs  int    `json:"waitms"`
}

type CommandDeleteBlockData struct {
	BlockId string `json:"blockid"`
}

type CommandEventReadHistoryData struct {
	Event    string `json:"event"`
	Scope    string `json:"scope"`
	MaxItems int    `json:"maxitems"`
}

type WaveAIStreamRequest struct {
	ClientId string                    `json:"clientid,omitempty"`
	Opts     *WaveAIOptsType           `json:"opts"`
	Prompt   []WaveAIPromptMessageType `json:"prompt"`
}

type WaveAIPromptMessageType struct {
	Role    string `json:"role"`
	Content string `json:"content"`
	Name    string `json:"name,omitempty"`
}

type WaveAIOptsType struct {
	Model      string `json:"model"`
	APIType    string `json:"apitype,omitempty"`
	APIToken   string `json:"apitoken"`
	OrgID      string `json:"orgid,omitempty"`
	APIVersion string `json:"apiversion,omitempty"`
	BaseURL    string `json:"baseurl,omitempty"`
	ProxyURL   string `json:"proxyurl,omitempty"`
	MaxTokens  int    `json:"maxtokens,omitempty"`
	MaxChoices int    `json:"maxchoices,omitempty"`
	TimeoutMs  int    `json:"timeoutms,omitempty"`
}

type WaveAIPacketType struct {
	Type         string           `json:"type"`
	Model        string           `json:"model,omitempty"`
	Created      int64            `json:"created,omitempty"`
	FinishReason string           `json:"finish_reason,omitempty"`
	Usage        *WaveAIUsageType `json:"usage,omitempty"`
	Index        int              `json:"index,omitempty"`
	Text         string           `json:"text,omitempty"`
	Error        string           `json:"error,omitempty"`
}

type WaveAIUsageType struct {
	PromptTokens     int `json:"prompt_tokens,omitempty"`
	CompletionTokens int `json:"completion_tokens,omitempty"`
	TotalTokens      int `json:"total_tokens,omitempty"`
}

type CpuDataRequest struct {
	Id    string `json:"id"`
	Count int    `json:"count"`
}

type CpuDataType struct {
	Time  int64   `json:"time"`
	Value float64 `json:"value"`
}

type CommandFileRestoreBackupData struct {
	BackupFilePath    string `json:"backupfilepath"`
	RestoreToFileName string `json:"restoretofilename"`
}

type CommandGetTempDirData struct {
	FileName string `json:"filename,omitempty"`
}

type CommandWriteTempFileData struct {
	FileName string `json:"filename"`
	Data64   string `json:"data64"`
}

type ConnRequest struct {
	Host       string               `json:"host"`
	Keywords   wconfig.ConnKeywords `json:"keywords,omitempty"`
	LogBlockId string               `json:"logblockid,omitempty"`
}

type RemoteInfo struct {
	ClientArch    string `json:"clientarch"`
	ClientOs      string `json:"clientos"`
	ClientVersion string `json:"clientversion"`
	Shell         string `json:"shell"`
	HomeDir       string `json:"homedir"`
}

const (
	TimeSeries_Cpu = "cpu"
)

type TimeSeriesData struct {
	Ts     int64              `json:"ts"`
	Values map[string]float64 `json:"values"`
}

type MetaSettingsType struct {
	waveobj.MetaMapType
}

func (m *MetaSettingsType) UnmarshalJSON(data []byte) error {
	var metaMap waveobj.MetaMapType
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	if err := decoder.Decode(&metaMap); err != nil {
		return err
	}
	*m = MetaSettingsType{MetaMapType: metaMap}
	return nil
}

func (m MetaSettingsType) MarshalJSON() ([]byte, error) {
	return json.Marshal(m.MetaMapType)
}

type ConnConfigRequest struct {
	Host        string              `json:"host"`
	MetaMapType waveobj.MetaMapType `json:"metamaptype"`
}

type ConnStatus struct {
	Status                        string `json:"status"`
	ConnHealthStatus              string `json:"connhealthstatus,omitempty"`
	WshEnabled                    bool   `json:"wshenabled"`
	Connection                    string `json:"connection"`
	Connected                     bool   `json:"connected"`
	HasConnected                  bool   `json:"hasconnected"` // true if it has *ever* connected successfully
	ActiveConnNum                 int    `json:"activeconnnum"`
	Error                         string `json:"error,omitempty"`
	WshError                      string `json:"wsherror,omitempty"`
	NoWshReason                   string `json:"nowshreason,omitempty"`
	WshVersion                    string `json:"wshversion,omitempty"`
	LastActivityBeforeStalledTime int64  `json:"lastactivitybeforestalledtime,omitempty"`
	KeepAliveSentTime             int64  `json:"keepalivesenttime,omitempty"`
}

type WebSelectorOpts struct {
	All   bool `json:"all,omitempty"`
	Inner bool `json:"inner,omitempty"`
}

type CommandWebSelectorData struct {
	WorkspaceId string           `json:"workspaceid"`
	BlockId     string           `json:"blockid"`
	TabId       string           `json:"tabid"`
	Selector    string           `json:"selector"`
	Opts        *WebSelectorOpts `json:"opts,omitempty"`
}

type CommandWebEvalData struct {
	WorkspaceId string `json:"workspaceid"`
	BlockId     string `json:"blockid"`
	TabId       string `json:"tabid"`
	Script      string `json:"script"`
}

type BlockInfoData struct {
	BlockId     string          `json:"blockid"`
	TabId       string          `json:"tabid"`
	WorkspaceId string          `json:"workspaceid"`
	Block       *waveobj.Block  `json:"block"`
	Files       []*WaveFileInfo `json:"files"`
}

type BlockContentTermData struct {
	Cwd                 string `json:"cwd,omitempty"`
	RunningProcess      string `json:"runningprocess,omitempty"`
	ShellType           string `json:"shelltype,omitempty"`
	ExitCode            int    `json:"exitcode,omitempty"`
	HasShellIntegration bool   `json:"hasshellintegration,omitempty"`
	JobId               string `json:"jobid,omitempty"`
	JobRunning          bool   `json:"jobrunning,omitempty"`
	ControllerType      string `json:"controllertype,omitempty"`
	TotalLines          int    `json:"totallines,omitempty"`
	ConnectionName      string `json:"connectionname,omitempty"`
}

type BlockContentWebData struct {
	Url          string `json:"url,omitempty"`
	Title        string `json:"title,omitempty"`
	Loading      bool   `json:"loading,omitempty"`
	PinnedUrl    string `json:"pinnedurl,omitempty"`
	ElementCount int    `json:"elementcount,omitempty"`
}

type BlockContentEditorData struct {
	FilePath    string `json:"filepath,omitempty"`
	Language    string `json:"language,omitempty"`
	Modified    bool   `json:"modified,omitempty"`
	LineCount   int    `json:"linecount,omitempty"`
	PreviewType string `json:"previewtype,omitempty"`
}

type BlockContentPreviewData struct {
	FilePath string `json:"filepath,omitempty"`
	MimeType string `json:"mimetype,omitempty"`
	FileSize int64  `json:"filesize,omitempty"`
}

type BlockContentSandboxData struct {
	SandboxId string `json:"sandboxid,omitempty"`
	Os        string `json:"os,omitempty"`
	Running   bool   `json:"running,omitempty"`
}

type BlockContentAIData struct {
	Model        string `json:"model,omitempty"`
	Provider     string `json:"provider,omitempty"`
	MessageCount int    `json:"messagecount,omitempty"`
}

type CommandGetBlockContentRtnData struct {
	BlockId  string                   `json:"blockid"`
	ViewType string                   `json:"viewtype"`
	Terminal *BlockContentTermData    `json:"terminal,omitempty"`
	Web      *BlockContentWebData     `json:"web,omitempty"`
	Editor   *BlockContentEditorData  `json:"editor,omitempty"`
	Preview  *BlockContentPreviewData `json:"preview,omitempty"`
	Sandbox  *BlockContentSandboxData `json:"sandbox,omitempty"`
	AI       *BlockContentAIData      `json:"ai,omitempty"`
}

type WaveNotificationOptions struct {
	Title  string `json:"title,omitempty"`
	Body   string `json:"body,omitempty"`
	Silent bool   `json:"silent,omitempty"`
}

type VDomUrlRequestData struct {
	Method  string            `json:"method"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
	Body    []byte            `json:"body,omitempty"`
}

type VDomUrlRequestResponse struct {
	StatusCode int               `json:"statuscode,omitempty"`
	Headers    map[string]string `json:"headers,omitempty"`
	Body       []byte            `json:"body,omitempty"`
}

type WaveInfoData struct {
	Version   string `json:"version"`
	ClientId  string `json:"clientid"`
	BuildTime string `json:"buildtime"`
	ConfigDir string `json:"configdir"`
	DataDir   string `json:"datadir"`
}

type WorkspaceInfoData struct {
	WindowId      string             `json:"windowid"`
	WorkspaceData *waveobj.Workspace `json:"workspacedata"`
}

type BlocksListRequest struct {
	WindowId    string `json:"windowid,omitempty"`
	WorkspaceId string `json:"workspaceid,omitempty"`
}

type BlocksListEntry struct {
	WindowId    string              `json:"windowid"`
	WorkspaceId string              `json:"workspaceid"`
	TabId       string              `json:"tabid"`
	BlockId     string              `json:"blockid"`
	Meta        waveobj.MetaMapType `json:"meta"`
}

type AiMessageData struct {
	Message string `json:"message,omitempty"`
}

type CommandGetWaveAIChatData struct {
	ChatId string `json:"chatid"`
}

type CommandWaveAIToolApproveData struct {
	ToolCallId string `json:"toolcallid"`
	Approval   string `json:"approval,omitempty"`
}

type AIAttachedFile struct {
	Name   string `json:"name"`
	Type   string `json:"type"`
	Size   int    `json:"size"`
	Data64 string `json:"data64"`
}

type CommandWaveAIAddContextData struct {
	Files   []AIAttachedFile `json:"files,omitempty"`
	Text    string           `json:"text,omitempty"`
	Submit  bool             `json:"submit,omitempty"`
	NewChat bool             `json:"newchat,omitempty"`
}

type CommandWaveAIGetToolDiffData struct {
	ChatId     string `json:"chatid"`
	ToolCallId string `json:"toolcallid"`
}

type CommandWaveAIGetToolDiffRtnData struct {
	OriginalContents64 string `json:"originalcontents64"`
	ModifiedContents64 string `json:"modifiedcontents64"`
}

type CommandCaptureBlockScreenshotData struct {
	BlockId string `json:"blockid"`
}

type CommandVarData struct {
	Key      string `json:"key"`
	Val      string `json:"val,omitempty"`
	Remove   bool   `json:"remove,omitempty"`
	ZoneId   string `json:"zoneid"`
	FileName string `json:"filename"`
}

type CommandVarResponseData struct {
	Key    string `json:"key"`
	Val    string `json:"val"`
	Exists bool   `json:"exists"`
}

type CommandDebugTermData struct {
	BlockId string `json:"blockid"`
	Size    int64  `json:"size"`
}

type CommandDebugTermRtnData struct {
	Offset int64  `json:"offset"`
	Data64 string `json:"data64"`
}

type PathCommandData struct {
	PathType     string `json:"pathtype"`
	Open         bool   `json:"open"`
	OpenExternal bool   `json:"openexternal"`
	TabId        string `json:"tabid"`
}

type ActivityDisplayType struct {
	Width    int     `json:"width"`
	Height   int     `json:"height"`
	DPR      float64 `json:"dpr"`
	Internal bool    `json:"internal,omitempty"`
}

type ActivityUpdate struct {
	FgMinutes           int                   `json:"fgminutes,omitempty"`
	ActiveMinutes       int                   `json:"activeminutes,omitempty"`
	OpenMinutes         int                   `json:"openminutes,omitempty"`
	WaveAIFgMinutes     int                   `json:"waveaifgminutes,omitempty"`
	WaveAIActiveMinutes int                   `json:"waveaiactiveminutes,omitempty"`
	NumTabs             int                   `json:"numtabs,omitempty"`
	NewTab              int                   `json:"newtab,omitempty"`
	NumBlocks           int                   `json:"numblocks,omitempty"`
	NumWindows          int                   `json:"numwindows,omitempty"`
	NumWS               int                   `json:"numws,omitempty"`
	NumWSNamed          int                   `json:"numwsnamed,omitempty"`
	NumSSHConn          int                   `json:"numsshconn,omitempty"`
	NumWSLConn          int                   `json:"numwslconn,omitempty"`
	NumMagnify          int                   `json:"nummagnify,omitempty"`
	TermCommandsRun     int                   `json:"termcommandsrun,omitempty"`
	NumPanics           int                   `json:"numpanics,omitempty"`
	NumAIReqs           int                   `json:"numaireqs,omitempty"`
	Startup             int                   `json:"startup,omitempty"`
	Shutdown            int                   `json:"shutdown,omitempty"`
	SetTabTheme         int                   `json:"settabtheme,omitempty"`
	BuildTime           string                `json:"buildtime,omitempty"`
	Displays            []ActivityDisplayType `json:"displays,omitempty"`
	Renderers           map[string]int        `json:"renderers,omitempty"`
	Blocks              map[string]int        `json:"blocks,omitempty"`
	WshCmds             map[string]int        `json:"wshcmds,omitempty"`
	Conn                map[string]int        `json:"conn,omitempty"`
}

type ConnExtData struct {
	ConnName   string `json:"connname"`
	LogBlockId string `json:"logblockid,omitempty"`
}

type CommandConnServerInitData struct {
	ClientId string `json:"clientid"`
}

type FetchSuggestionsData struct {
	SuggestionType string `json:"suggestiontype"`
	Query          string `json:"query"`
	WidgetId       string `json:"widgetid"`
	ReqNum         int    `json:"reqnum"`
	FileCwd        string `json:"file:cwd,omitempty"`
	FileDirOnly    bool   `json:"file:dironly,omitempty"`
	FileConnection string `json:"file:connection,omitempty"`
}

type FetchSuggestionsResponse struct {
	ReqNum      int              `json:"reqnum"`
	Suggestions []SuggestionType `json:"suggestions"`
}

type SuggestionType struct {
	Type         string `json:"type"`
	SuggestionId string `json:"suggestionid"`
	Display      string `json:"display"`
	SubText      string `json:"subtext,omitempty"`
	Icon         string `json:"icon,omitempty"`
	IconColor    string `json:"iconcolor,omitempty"`
	IconSrc      string `json:"iconsrc,omitempty"`
	MatchPos     []int  `json:"matchpos,omitempty"`
	SubMatchPos  []int  `json:"submatchpos,omitempty"`
	Score        int    `json:"score,omitempty"`
	FileMimeType string `json:"file:mimetype,omitempty"`
	FilePath     string `json:"file:path,omitempty"`
	FileName     string `json:"file:name,omitempty"`
	UrlUrl       string `json:"url:url,omitempty"`
}

type CommandGetRTInfoData struct {
	ORef waveobj.ORef `json:"oref"`
}

type CommandSetRTInfoData struct {
	ORef   waveobj.ORef   `json:"oref"`
	Data   map[string]any `json:"data" tstype:"ObjRTInfo"`
	Delete bool           `json:"delete,omitempty"`
}

type CommandTermGetScrollbackLinesData struct {
	LineStart   int  `json:"linestart"`
	LineEnd     int  `json:"lineend"`
	LastCommand bool `json:"lastcommand"`
}

type CommandTermGetScrollbackLinesRtnData struct {
	TotalLines  int      `json:"totallines"`
	LineStart   int      `json:"linestart"`
	Lines       []string `json:"lines"`
	LastUpdated int64    `json:"lastupdated"`
}

type CommandTermUpdateAttachedJobData struct {
	BlockId string `json:"blockid"`
	JobId   string `json:"jobid,omitempty"`
}

type CommandElectronEncryptData struct {
	PlainText string `json:"plaintext"`
}

type CommandElectronEncryptRtnData struct {
	CipherText     string `json:"ciphertext"`
	StorageBackend string `json:"storagebackend"` // only returned for linux
}

type CommandElectronDecryptData struct {
	CipherText string `json:"ciphertext"`
}

type CommandElectronDecryptRtnData struct {
	PlainText      string `json:"plaintext"`
	StorageBackend string `json:"storagebackend"` // only returned for linux
}

type CommandStreamData struct {
	Id     string `json:"id"`  // streamid
	Seq    int64  `json:"seq"` // start offset (bytes)
	Data64 string `json:"data64,omitempty"`
	Eof    bool   `json:"eof,omitempty"`   // can be set with data or without
	Error  string `json:"error,omitempty"` // stream terminated with error
}

type CommandStreamAckData struct {
	Id     string `json:"id"`               // streamid
	Seq    int64  `json:"seq"`              // next expected byte
	RWnd   int64  `json:"rwnd"`             // receive window size
	Fin    bool   `json:"fin,omitempty"`    // observed end-of-stream (eof or error)
	Delay  int64  `json:"delay,omitempty"`  // ack delay in microseconds (from when data was received to when we sent out ack -- monotonic clock)
	Cancel bool   `json:"cancel,omitempty"` // used to cancel the stream
	Error  string `json:"error,omitempty"`  // reason for cancel (may only be set if cancel is true)
}

type StreamMeta struct {
	Id            string `json:"id"`   // streamid
	RWnd          int64  `json:"rwnd"` // initial receive window size
	ReaderRouteId string `json:"readerrouteid"`
	WriterRouteId string `json:"writerrouteid"`
}

type CommandAuthenticateToJobData struct {
	JobAccessToken string `json:"jobaccesstoken"`
}

type CommandAuthenticateJobManagerData struct {
	JobId        string `json:"jobid"`
	JobAuthToken string `json:"jobauthtoken"`
}

type CommandStartJobData struct {
	Cmd        string            `json:"cmd"`
	Args       []string          `json:"args"`
	Env        map[string]string `json:"env"`
	TermSize   waveobj.TermSize  `json:"termsize"`
	StreamMeta *StreamMeta       `json:"streammeta,omitempty"`
}

type CommandRemoteStartJobData struct {
	Cmd                string            `json:"cmd"`
	Args               []string          `json:"args"`
	Env                map[string]string `json:"env"`
	TermSize           waveobj.TermSize  `json:"termsize"`
	StreamMeta         *StreamMeta       `json:"streammeta,omitempty"`
	JobAuthToken       string            `json:"jobauthtoken"`
	JobId              string            `json:"jobid"`
	MainServerJwtToken string            `json:"mainserverjwttoken"`
	ClientId           string            `json:"clientid"`
	PublicKeyBase64    string            `json:"publickeybase64"`
}

type CommandRemoteReconnectToJobManagerData struct {
	JobId              string `json:"jobid"`
	JobAuthToken       string `json:"jobauthtoken"`
	MainServerJwtToken string `json:"mainserverjwttoken"`
	JobManagerPid      int    `json:"jobmanagerpid"`
	JobManagerStartTs  int64  `json:"jobmanagerstartts"`
}

type CommandRemoteReconnectToJobManagerRtnData struct {
	Success        bool   `json:"success"`
	JobManagerGone bool   `json:"jobmanagergone"`
	Error          string `json:"error,omitempty"`
}

type CommandRemoteDisconnectFromJobManagerData struct {
	JobId string `json:"jobid"`
}

type CommandRemoteTerminateJobManagerData struct {
	JobId             string `json:"jobid"`
	JobManagerPid     int    `json:"jobmanagerpid"`
	JobManagerStartTs int64  `json:"jobmanagerstartts"`
}

type CommandStartJobRtnData struct {
	CmdPid            int   `json:"cmdpid"`
	CmdStartTs        int64 `json:"cmdstartts"`
	JobManagerPid     int   `json:"jobmanagerpid"`
	JobManagerStartTs int64 `json:"jobmanagerstartts"`
}

type CommandJobPrepareConnectData struct {
	StreamMeta StreamMeta       `json:"streammeta"`
	Seq        int64            `json:"seq"`
	TermSize   waveobj.TermSize `json:"termsize"`
}

type CommandJobStartStreamData struct {
}

type CommandJobConnectRtnData struct {
	Seq         int64  `json:"seq"`
	StreamDone  bool   `json:"streamdone,omitempty"`
	StreamError string `json:"streamerror,omitempty"`
	HasExited   bool   `json:"hasexited,omitempty"`
	ExitCode    *int   `json:"exitcode,omitempty"`
	ExitSignal  string `json:"exitsignal,omitempty"`
	ExitErr     string `json:"exiterr,omitempty"`
}

type CommandJobCmdExitedData struct {
	JobId      string `json:"jobid"`
	ExitCode   *int   `json:"exitcode,omitempty"`
	ExitSignal string `json:"exitsignal,omitempty"`
	ExitErr    string `json:"exiterr,omitempty"`
	ExitTs     int64  `json:"exitts,omitempty"`
}

type CommandJobControllerStartJobData struct {
	ConnName string            `json:"connname"`
	JobKind  string            `json:"jobkind"`
	Cmd      string            `json:"cmd"`
	Args     []string          `json:"args"`
	Env      map[string]string `json:"env"`
	TermSize *waveobj.TermSize `json:"termsize,omitempty"`
}

type CommandJobControllerAttachJobData struct {
	JobId   string `json:"jobid"`
	BlockId string `json:"blockid"`
}

type JobManagerStatusUpdate struct {
	JobId            string `json:"jobid"`
	JobManagerStatus string `json:"jobmanagerstatus"`
}

type CommandWaveFileReadStreamData struct {
	ZoneId     string     `json:"zoneid"`
	Name       string     `json:"name"`
	StreamMeta StreamMeta `json:"streammeta"`
}

// see blockstore.go (WaveFile)
type WaveFileInfo struct {
	ZoneId    string   `json:"zoneid"`
	Name      string   `json:"name"`
	Opts      FileOpts `json:"opts"`
	CreatedTs int64    `json:"createdts"`
	Size      int64    `json:"size"`
	ModTs     int64    `json:"modts"`
	Meta      FileMeta `json:"meta"`
}

type CommandBadgeWatchPidData struct {
	Pid     int          `json:"pid"`
	ORef    waveobj.ORef `json:"oref"`
	BadgeId string       `json:"badgeid"`
}

type BlockJobStatusData struct {
	BlockId       string `json:"blockid"`
	JobId         string `json:"jobid"`
	Status        string `json:"status,omitempty" tstype:"null | \"init\" | \"connected\" | \"disconnected\" | \"done\""`
	VersionTs     int64  `json:"versionts"`
	DoneReason    string `json:"donereason,omitempty"`
	StartupError  string `json:"startuperror,omitempty"`
	CmdExitTs     int64  `json:"cmdexitts,omitempty"`
	CmdExitCode   *int   `json:"cmdexitcode,omitempty"`
	CmdExitSignal string `json:"cmdexitsignal,omitempty"`
}

type FocusedBlockData struct {
	BlockId                    string              `json:"blockid"`
	ViewType                   string              `json:"viewtype"`
	Controller                 string              `json:"controller"`
	ConnName                   string              `json:"connname"`
	BlockMeta                  waveobj.MetaMapType `json:"blockmeta"`
	TermJobStatus              *BlockJobStatusData `json:"termjobstatus,omitempty"`
	ConnStatus                 *ConnStatus         `json:"connstatus,omitempty"`
	TermShellIntegrationStatus string              `json:"termshellintegrationstatus,omitempty"`
	TermLastCommand            string              `json:"termlastcommand,omitempty"`
}

// =============================================================================
// Widget Human Simulation RPC Types
// =============================================================================

type WidgetElementData struct {
	Ref       string `json:"ref"`
	Role      string `json:"role"`
	Name      string `json:"name"`
	Value     string `json:"value,omitempty"`
	X         int    `json:"x"`
	Y         int    `json:"y"`
	Width     int    `json:"width"`
	Height    int    `json:"height"`
	Focusable bool   `json:"focusable"`
	Visible   bool   `json:"visible"`
}

type CommandWidgetGetElementsData struct {
	BlockId string `json:"blockid"`
}

type WidgetGetElementsRtnData struct {
	BlockId   string              `json:"blockid"`
	Elements  []WidgetElementData `json:"elements"`
	Count     int                 `json:"count"`
	Timestamp int64               `json:"timestamp"`
}

type CommandWidgetGetStateData struct {
	BlockId string `json:"blockid"`
}

type WidgetGetStateRtnData struct {
	BlockId  string         `json:"blockid"`
	ViewType string         `json:"viewtype"`
	State    map[string]any `json:"state"`
	Focused  bool           `json:"focused"`
	X        float64        `json:"x"`
	Y        float64        `json:"y"`
	Width    float64        `json:"width"`
	Height   float64        `json:"height"`
}

type CommandWidgetMouseClickData struct {
	BlockId    string `json:"blockid"`
	X          int    `json:"x"`
	Y          int    `json:"y"`
	Button     string `json:"button"`
	ClickCount int    `json:"clickcount"`
}

type WidgetMouseActionRtnData struct {
	BlockId string `json:"blockid"`
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
}

type CommandWidgetMouseScrollData struct {
	BlockId string `json:"blockid"`
	Amount  int    `json:"amount"`
	OriginX *int   `json:"originx,omitempty"`
	OriginY *int   `json:"originy,omitempty"`
}

type CommandWidgetMouseDragData struct {
	BlockId string `json:"blockid"`
	StartX  int    `json:"startx"`
	StartY  int    `json:"starty"`
	EndX    int    `json:"endx"`
	EndY    int    `json:"endy"`
	Button  string `json:"button"`
}

type CommandWidgetKeyboardTypeData struct {
	BlockId string `json:"blockid"`
	Text    string `json:"text"`
	DelayMs int    `json:"delayms"`
}

type CommandWidgetKeyboardPressData struct {
	BlockId string   `json:"blockid"`
	Keys    []string `json:"keys"`
}

type CommandWidgetWaitForElementData struct {
	BlockId    string `json:"blockid"`
	ElementRef string `json:"elementref,omitempty"`
	Condition  string `json:"condition"`
	TimeoutMs  int    `json:"timeoutms"`
}

type WidgetWaitForElementRtnData struct {
	BlockId    string `json:"blockid"`
	Condition  string `json:"condition"`
	Met        bool   `json:"met"`
	WaitTimeMs int    `json:"wait_time_ms"`
	Message    string `json:"message,omitempty"`
}

type CommandWidgetScreenshotAnnotatedData struct {
	BlockId      string `json:"blockid"`
	ShowElements bool   `json:"showelements"`
}

type WidgetScreenshotAnnotatedRtnData struct {
	BlockId  string `json:"blockid"`
	ImageUrl string `json:"imageurl"`
}

type CommandWidgetSnapshotData struct {
	BlockId string `json:"blockid"`
}

type WidgetSnapshotRtnData struct {
	BlockId   string              `json:"blockid"`
	Elements  []WidgetElementData `json:"elements"`
	Count     int                 `json:"count"`
	Timestamp int64               `json:"timestamp"`
}

type CommandWidgetFindData struct {
	BlockId  string `json:"blockid"`
	Role     string `json:"role,omitempty"`
	Name     string `json:"name,omitempty"`
	Value    string `json:"value,omitempty"`
	Text     string `json:"text,omitempty"`
	MaxCount int    `json:"maxcount,omitempty"`
}

type WidgetFindRtnData struct {
	BlockId  string              `json:"blockid"`
	Elements []WidgetElementData `json:"elements"`
	Count    int                 `json:"count"`
}

type CommandWidgetInspectData struct {
	BlockId    string `json:"blockid"`
	ElementRef string `json:"elementref"`
}

type WidgetInspectRtnData struct {
	BlockId     string   `json:"blockid"`
	ElementRef  string   `json:"elementref"`
	Role        string   `json:"role"`
	Name        string   `json:"name"`
	Value       string   `json:"value,omitempty"`
	Description string   `json:"description,omitempty"`
	X           int      `json:"x"`
	Y           int      `json:"y"`
	Width       int      `json:"width"`
	Height      int      `json:"height"`
	Focusable   bool     `json:"focusable"`
	Visible     bool     `json:"visible"`
	Enabled     bool     `json:"enabled"`
	Checked     bool     `json:"checked,omitempty"`
	Expanded    bool     `json:"expanded,omitempty"`
	Selected    bool     `json:"selected,omitempty"`
	Actions     []string `json:"actions,omitempty"`
}

type CommandWidgetElementAtData struct {
	BlockId string `json:"blockid"`
	X       int    `json:"x"`
	Y       int    `json:"y"`
}

type WidgetElementAtRtnData struct {
	BlockId    string `json:"blockid"`
	X          int    `json:"x"`
	Y          int    `json:"y"`
	ElementRef string `json:"elementref,omitempty"`
	Role       string `json:"role,omitempty"`
	Name       string `json:"name,omitempty"`
	Found      bool   `json:"found"`
}

type CommandWidgetClickData struct {
	BlockId    string `json:"blockid"`
	ElementRef string `json:"elementref,omitempty"`
	X          int    `json:"x,omitempty"`
	Y          int    `json:"y,omitempty"`
	Button     string `json:"button,omitempty"`
	ClickType  string `json:"clicktype,omitempty"`
}

type CommandWidgetHoverData struct {
	BlockId    string `json:"blockid"`
	ElementRef string `json:"elementref,omitempty"`
	X          int    `json:"x,omitempty"`
	Y          int    `json:"y,omitempty"`
}

type CommandWidgetLongPressData struct {
	BlockId    string  `json:"blockid"`
	ElementRef string  `json:"elementref,omitempty"`
	X          int     `json:"x,omitempty"`
	Y          int     `json:"y,omitempty"`
	Duration   float64 `json:"duration,omitempty"`
}

type CommandWidgetDragData struct {
	BlockId  string `json:"blockid"`
	StartRef string `json:"startref,omitempty"`
	StartX   int    `json:"startx,omitempty"`
	StartY   int    `json:"starty,omitempty"`
	EndRef   string `json:"endref,omitempty"`
	EndX     int    `json:"endx,omitempty"`
	EndY     int    `json:"endy,omitempty"`
	Button   string `json:"button,omitempty"`
}

type CommandWidgetScrollToData struct {
	BlockId    string `json:"blockid"`
	ElementRef string `json:"elementref,omitempty"`
	X          int    `json:"x,omitempty"`
	Y          int    `json:"y,omitempty"`
}

type CommandWidgetGetValueData struct {
	BlockId    string `json:"blockid"`
	ElementRef string `json:"elementref"`
}

type WidgetGetValueRtnData struct {
	BlockId    string `json:"blockid"`
	ElementRef string `json:"elementref"`
	Value      string `json:"value"`
}

type CommandWidgetSetValueData struct {
	BlockId    string `json:"blockid"`
	ElementRef string `json:"elementref"`
	Value      string `json:"value"`
}

type CommandWidgetClearData struct {
	BlockId    string `json:"blockid"`
	ElementRef string `json:"elementref"`
}

type CommandWidgetSelectData struct {
	BlockId    string `json:"blockid"`
	ElementRef string `json:"elementref"`
	Option     string `json:"option"`
}

type CommandWidgetToggleData struct {
	BlockId    string `json:"blockid"`
	ElementRef string `json:"elementref"`
}

type CommandWidgetClipboardGetData struct {
	BlockId string `json:"blockid"`
}

type WidgetClipboardGetRtnData struct {
	BlockId string `json:"blockid"`
	Text    string `json:"text"`
}

type CommandWidgetClipboardSetData struct {
	BlockId string `json:"blockid"`
	Text    string `json:"text"`
}

type CommandWidgetWaitConditionData struct {
	BlockId    string `json:"blockid"`
	ElementRef string `json:"elementref,omitempty"`
	Condition  string `json:"condition"`
	Value      string `json:"value,omitempty"`
	TimeoutMs  int    `json:"timeoutms"`
}

type WidgetWaitConditionRtnData struct {
	BlockId    string `json:"blockid"`
	Condition  string `json:"condition"`
	Met        bool   `json:"met"`
	WaitTimeMs int    `json:"wait_time_ms"`
	Message    string `json:"message,omitempty"`
}

type McpServerInfo struct {
	Name    string `json:"name"`
	Status  string `json:"status"`
	Version string `json:"version,omitempty"`
}

type McpToolInfo struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	InputSchema string `json:"input_schema"`
}

type McpCallToolData struct {
	ServerName string                 `json:"server_name"`
	ToolName   string                 `json:"tool_name"`
	Arguments  map[string]interface{} `json:"arguments"`
}

type McpCallToolResult struct {
	ServerName string `json:"server_name"`
	ToolName   string `json:"tool_name"`
	Success    bool   `json:"success"`
	Result     string `json:"result,omitempty"`
	Error      string `json:"error,omitempty"`
}

type McpStatus struct {
	Name   string `json:"name"`
	Status string `json:"status"`
	Error  string `json:"error,omitempty"`
}

type SandboxStartRequest struct {
	SessionId     string `json:"sessionId,omitempty"`
	Mode          string `json:"mode,omitempty"`
	BrowserUrl    string `json:"browserUrl,omitempty"`
	EnsureBrowser bool   `json:"ensureBrowser,omitempty"`
}

type SandboxStartResponse struct {
	SessionId  string `json:"sessionId"`
	Status     string `json:"status"`
	Mode       string `json:"mode"`
	Runtime    string `json:"runtime,omitempty"`
	VncPort    int    `json:"vncPort,omitempty"`
	SshPort    int    `json:"sshPort,omitempty"`
	VncWsUrl   string `json:"vncWsUrl,omitempty"`
	DesktopUrl string `json:"desktopUrl,omitempty"`
	McpUrl     string `json:"mcpUrl,omitempty"`
	SshConn    string `json:"sshConn,omitempty"`
	Password   string `json:"password,omitempty"`
	Error      string `json:"error,omitempty"`
}

type SandboxStopRequest struct {
	SessionId string `json:"sessionId,omitempty"`
}

type SandboxStopResponse struct {
	Status string `json:"status"`
	Error  string `json:"error,omitempty"`
}

type SandboxStatusRequest struct {
	SessionId string `json:"sessionId,omitempty"`
}

type SandboxStatusResponse struct {
	SessionId  string `json:"sessionId,omitempty"`
	Status     string `json:"status"`
	Mode       string `json:"mode,omitempty"`
	Runtime    string `json:"runtime,omitempty"`
	VncPort    int    `json:"vncPort,omitempty"`
	SshPort    int    `json:"sshPort,omitempty"`
	VncWsUrl   string `json:"vncWsUrl,omitempty"`
	DesktopUrl string `json:"desktopUrl,omitempty"`
	McpUrl     string `json:"mcpUrl,omitempty"`
	SshConn    string `json:"sshConn,omitempty"`
	Error      string `json:"error,omitempty"`
}

type AppStreamStartRequest struct {
	SessionId string `json:"sessionId,omitempty"`
	AppId     string `json:"appId,omitempty"`
	AppName   string `json:"appName,omitempty"`
	BundleId  string `json:"bundleId,omitempty"`
}

type AppStreamStartResponse struct {
	SessionId string `json:"sessionId,omitempty"`
	StreamUrl string `json:"streamUrl,omitempty"`
	Status    string `json:"status"`
	Error     string `json:"error,omitempty"`
}

type AppStreamStopRequest struct {
	SessionId string `json:"sessionId,omitempty"`
}

type AppStreamActionRequest struct {
	SessionId   string `json:"sessionId,omitempty"`
	Action      string `json:"action"`
	X           int    `json:"x,omitempty"`
	Y           int    `json:"y,omitempty"`
	Button      string `json:"button,omitempty"`
	Text        string `json:"text,omitempty"`
	Keys        string `json:"keys,omitempty"`
	Direction   string `json:"direction,omitempty"`
	ScrollCount int    `json:"scrollCount,omitempty"`
}

// --- Window Management ---

type WindowInfo struct {
	WindowId    string        `json:"windowId"`
	WorkspaceId string        `json:"workspaceId"`
	Title       string        `json:"title,omitempty"`
	TabCount    int           `json:"tabCount"`
	ActiveTabId string        `json:"activeTabId,omitempty"`
	Focused     bool          `json:"focused"`
	Bounds      *WindowBounds `json:"bounds,omitempty"`
}

type WindowBounds struct {
	X      int `json:"x"`
	Y      int `json:"y"`
	Width  int `json:"width"`
	Height int `json:"height"`
}

// --- Bookmark Management ---

type BookmarkCreateData struct {
	Title        string  `json:"title"`
	Url          string  `json:"url"`
	ParentId     string  `json:"parentId,omitempty"`
	DisplayOrder float64 `json:"display:order,omitempty"`
}

type BookmarkUpdateData struct {
	Id           string  `json:"id"`
	Title        string  `json:"title,omitempty"`
	Url          string  `json:"url,omitempty"`
	DisplayOrder float64 `json:"display:order,omitempty"`
}

type BookmarkMoveData struct {
	Id       string `json:"id"`
	ParentId string `json:"parentId,omitempty"`
	Index    int    `json:"index,omitempty"`
}

type BookmarkSearchResult struct {
	Id    string `json:"id"`
	Title string `json:"title"`
	Url   string `json:"url"`
}

// --- History Management ---

type HistoryEntry struct {
	Id         string `json:"id"`
	Url        string `json:"url"`
	Title      string `json:"title,omitempty"`
	VisitTime  int64  `json:"visitTime"`
	VisitCount int    `json:"visitCount,omitempty"`
}

type HistorySearchData struct {
	Query    string `json:"query"`
	MaxItems int    `json:"maxItems,omitempty"`
}

type HistoryDeleteRangeData struct {
	StartTime int64 `json:"startTime"`
	EndTime   int64 `json:"endTime"`
}

// --- Tab Group Management ---

type TabGroupInfo struct {
	Id        string   `json:"id"`
	Title     string   `json:"title,omitempty"`
	Color     string   `json:"color,omitempty"`
	TabIds    []string `json:"tabIds,omitempty"`
	Collapsed bool     `json:"collapsed"`
}

type GroupTabsData struct {
	TabIds []string `json:"tabIds"`
	Title  string   `json:"title,omitempty"`
}

type UpdateTabGroupData struct {
	Id        string `json:"id"`
	Title     string `json:"title,omitempty"`
	Color     string `json:"color,omitempty"`
	Collapsed *bool  `json:"collapsed,omitempty"`
}

// --- BrowserOS Info ---

type BrowserOSInfo struct {
	Version      string   `json:"version"`
	Capabilities []string `json:"capabilities"`
	Features     []string `json:"features"`
}
