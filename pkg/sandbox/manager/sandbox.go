package sandbox

import (
	"bytes"
	"context"
	"fmt"
	"log"
	"net"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/wavetermdev/waveterm/pkg/wconfig"
)

const (
	SandboxStatusStopped  = "stopped"
	SandboxStatusStarting = "starting"
	SandboxStatusRunning  = "running"
	SandboxStatusError    = "error"

	SandboxModeDesktop    = "desktop"
	SandboxModeBackground = "background"

	SandboxDefaultBrowserURL = "about:blank"
	SandboxDefaultPassword   = "wave123"

	SandboxRuntimeQEMU            = "qemu"
	SandboxRuntimeKrontermDesktop = "kronterm-desktop"
)

func MakeVNCWsURL(sessionID string) string {
	return fmt.Sprintf("/sandbox/vnc?sessionid=%s", normalizeSessionID(sessionID))
}

func MakeDesktopURL(session *Session) string {
	if session == nil {
		return ""
	}
	if session.DesktopURL == "" {
		return ""
	}
	return strings.TrimRight(session.DesktopURL, "/") + "/novnc/vnc_lite.html?scale=true"
}

type QEMUConfig struct {
	Machine     string
	CPU         string
	CPUCores    int
	MemoryMB    int
	VNCPort     int
	SSHPort     int
	DiskImage   string
	SeedImage   string
	DisplayType string
}

type Session struct {
	SessionID  string
	Status     string
	Mode       string
	BrowserURL string
	Runtime    string
	Config     *QEMUConfig
	Process    *os.Process
	DesktopURL string
	MCPURL     string
	LastError  string
}

type StartOpts struct {
	SessionID  string
	Mode       string
	BrowserURL string
}

type SandboxManager struct {
	mu       sync.RWMutex
	sessions map[string]*Session
	vncPort  int
	sshPort  int
}

var globalSandboxManager *SandboxManager

func GetSandboxManager() *SandboxManager {
	if globalSandboxManager == nil {
		globalSandboxManager = &SandboxManager{
			sessions: make(map[string]*Session),
			vncPort:  5901,
			sshPort:  2222,
		}
	}
	return globalSandboxManager
}

func normalizeSessionID(sessionID string) string {
	if sessionID == "" {
		return "default"
	}
	return sessionID
}

func normalizeMode(mode string) string {
	if mode == SandboxModeBackground {
		return SandboxModeBackground
	}
	return SandboxModeDesktop
}

func normalizeBrowserURL(url string) string {
	if url == "" {
		return SandboxDefaultBrowserURL
	}
	return url
}

func selectedRuntime() string {
	runtime := strings.ToLower(strings.TrimSpace(os.Getenv("WAVE_SANDBOX_RUNTIME")))
	if runtime == SandboxRuntimeQEMU {
		return SandboxRuntimeQEMU
	}
	return SandboxRuntimeKrontermDesktop
}

func krontermDesktopBaseURL() string {
	baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("WAVE_KRONTERM_DESKTOP_URL")), "/")
	if baseURL == "" {
		return "http://localhost:9990"
	}
	return baseURL
}

func (sm *SandboxManager) allocatePorts() (vncPort, sshPort int) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	vncPort = sm.vncPort
	sshPort = sm.sshPort
	sm.vncPort++
	sm.sshPort++
	return
}

func (sm *SandboxManager) Start(ctx context.Context, opts StartOpts) (*Session, error) {
	sessionID := normalizeSessionID(opts.SessionID)
	mode := normalizeMode(opts.Mode)
	browserURL := normalizeBrowserURL(opts.BrowserURL)
	if selectedRuntime() == SandboxRuntimeKrontermDesktop {
		return sm.startKrontermDesktop(ctx, sessionID, mode, browserURL)
	}
	diskImage := getDefaultDiskImage()

	sm.mu.Lock()
	if existing := sm.sessions[sessionID]; existing != nil {
		existing.Mode = mode
		existing.BrowserURL = browserURL
		sessionCopy := cloneSession(existing)
		sm.mu.Unlock()
		return sessionCopy, nil
	}
	if reusable := sm.findReusableSessionLocked(diskImage); reusable != nil {
		reusable.Mode = mode
		reusable.BrowserURL = browserURL
		sessionCopy := cloneSession(reusable)
		sm.mu.Unlock()
		return sessionCopy, nil
	}
	sm.mu.Unlock()

	vncPort, sshPort := sm.allocatePorts()
	config := &QEMUConfig{
		Machine:     "virt",
		CPU:         "host",
		CPUCores:    2,
		MemoryMB:    2048,
		VNCPort:     vncPort,
		SSHPort:     sshPort,
		DiskImage:   diskImage,
		SeedImage:   getDefaultSeedImage(),
		DisplayType: "vnc",
	}

	qemuCmd := buildQEMUCommand(config)
	stderrBuf := &bytes.Buffer{}
	qemuCmd.Stderr = stderrBuf
	log.Printf("[sandbox] starting QEMU for session %s on ports VNC=%d SSH=%d", sessionID, vncPort, sshPort)
	log.Printf("[sandbox] command: %s", qemuCmd.String())

	if err := qemuCmd.Start(); err != nil {
		return nil, fmt.Errorf("failed to start QEMU: %w", err)
	}

	session := &Session{
		SessionID:  sessionID,
		Status:     SandboxStatusStarting,
		Mode:       mode,
		BrowserURL: browserURL,
		Runtime:    SandboxRuntimeQEMU,
		Config:     config,
		Process:    qemuCmd.Process,
	}

	sm.mu.Lock()
	sm.sessions[sessionID] = session
	sm.mu.Unlock()

	go sm.waitForExit(sessionID, qemuCmd, stderrBuf)
	go sm.waitForAttachReady(ctx, sessionID, config.VNCPort)

	return cloneSession(session), nil
}

func (sm *SandboxManager) startKrontermDesktop(ctx context.Context, sessionID string, mode string, browserURL string) (*Session, error) {
	baseURL := krontermDesktopBaseURL()
	session := &Session{
		SessionID:  sessionID,
		Status:     SandboxStatusStarting,
		Mode:       mode,
		BrowserURL: browserURL,
		Runtime:    SandboxRuntimeKrontermDesktop,
		DesktopURL: baseURL,
		MCPURL:     baseURL + "/computer-use",
	}

	sm.mu.Lock()
	sm.sessions[sessionID] = session
	sm.mu.Unlock()

	readyCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	go func() {
		defer cancel()
		sm.waitForKrontermDesktopReady(readyCtx, sessionID, baseURL)
	}()
	return cloneSession(session), nil
}

func (sm *SandboxManager) waitForKrontermDesktopReady(ctx context.Context, sessionID string, baseURL string) {
	parsed, err := url.Parse(baseURL)
	if err != nil {
		sm.setSessionError(sessionID, err)
		return
	}
	host := parsed.Host
	if !strings.Contains(host, ":") {
		if parsed.Scheme == "https" {
			host += ":443"
		} else {
			host += ":80"
		}
	}

	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			sm.setSessionError(sessionID, ctx.Err())
			return
		case <-ticker.C:
			conn, err := net.DialTimeout("tcp", host, 300*time.Millisecond)
			if err != nil {
				if !sm.sessionStillActive(sessionID) {
					return
				}
				continue
			}
			conn.Close()
			sm.mu.Lock()
			session := sm.sessions[sessionID]
			if session != nil && session.Status == SandboxStatusStarting {
				session.Status = SandboxStatusRunning
				session.LastError = ""
			}
			sm.mu.Unlock()
			return
		}
	}
}

func (sm *SandboxManager) findReusableSessionLocked(diskImage string) *Session {
	for _, session := range sm.sessions {
		if session == nil || session.Config == nil || session.Process == nil {
			continue
		}
		if session.Status != SandboxStatusStarting && session.Status != SandboxStatusRunning {
			continue
		}
		if session.Config.DiskImage != diskImage {
			continue
		}
		return session
	}
	return nil
}

func (sm *SandboxManager) waitForAttachReady(ctx context.Context, sessionID string, vncPort int) {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			sm.setSessionError(sessionID, ctx.Err())
			return
		case <-ticker.C:
			conn, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", vncPort), 300*time.Millisecond)
			if err != nil {
				if !sm.sessionStillActive(sessionID) {
					return
				}
				continue
			}
			conn.Close()
			sm.mu.Lock()
			session := sm.sessions[sessionID]
			if session != nil && session.Status == SandboxStatusStarting {
				session.Status = SandboxStatusRunning
				session.LastError = ""
			}
			sm.mu.Unlock()
			return
		}
	}
}

func (sm *SandboxManager) waitForExit(sessionID string, qemuCmd *exec.Cmd, stderrBuf *bytes.Buffer) {
	err := qemuCmd.Wait()
	sm.mu.Lock()
	session := sm.sessions[sessionID]
	if session != nil {
		if err != nil && session.Status != SandboxStatusStopped {
			session.Status = SandboxStatusError
			session.LastError = makeLaunchError(err, stderrBuf)
			session.Process = nil
		} else {
			delete(sm.sessions, sessionID)
		}
	}
	sm.mu.Unlock()
	log.Printf("[sandbox] session %s ended", sessionID)
}

func (sm *SandboxManager) setSessionError(sessionID string, err error) {
	sm.mu.Lock()
	defer sm.mu.Unlock()
	session := sm.sessions[sessionID]
	if session == nil {
		return
	}
	session.Status = SandboxStatusError
	if err != nil {
		session.LastError = err.Error()
	}
}

func (sm *SandboxManager) sessionStillActive(sessionID string) bool {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	return sm.sessions[sessionID] != nil
}

func (sm *SandboxManager) Stop(sessionID string) error {
	sessionID = normalizeSessionID(sessionID)

	sm.mu.RLock()
	session := sm.sessions[sessionID]
	sm.mu.RUnlock()
	if session == nil {
		return fmt.Errorf("session %s not found", sessionID)
	}
	if session.Runtime == SandboxRuntimeKrontermDesktop || session.Process == nil {
		sm.mu.Lock()
		delete(sm.sessions, sessionID)
		sm.mu.Unlock()
		return nil
	}

	if err := session.Process.Kill(); err != nil {
		return fmt.Errorf("failed to kill session %s: %w", sessionID, err)
	}

	sm.mu.Lock()
	delete(sm.sessions, sessionID)
	sm.mu.Unlock()
	return nil
}

func (sm *SandboxManager) GetStatus(sessionID string) (*Session, error) {
	sessionID = normalizeSessionID(sessionID)

	sm.mu.RLock()
	defer sm.mu.RUnlock()
	session := sm.sessions[sessionID]
	if session == nil {
		return &Session{
			SessionID:  sessionID,
			Status:     SandboxStatusStopped,
			Mode:       SandboxModeDesktop,
			BrowserURL: SandboxDefaultBrowserURL,
			Runtime:    selectedRuntime(),
		}, nil
	}
	return cloneSession(session), nil
}

func (sm *SandboxManager) ListSessions() []string {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	sessions := make([]string, 0, len(sm.sessions))
	for sessionID := range sm.sessions {
		sessions = append(sessions, sessionID)
	}
	return sessions
}

func (sm *SandboxManager) DialVNC(sessionID string) (net.Conn, *Session, error) {
	session, err := sm.GetStatus(sessionID)
	if err != nil {
		return nil, nil, err
	}
	if session.Runtime == SandboxRuntimeKrontermDesktop {
		return nil, session, fmt.Errorf("kronterm-desktop runtime exposes noVNC at %s instead of raw VNC", session.DesktopURL)
	}
	if session.Status != SandboxStatusRunning || session.Config == nil {
		return nil, session, fmt.Errorf("sandbox session %s is not running", sessionID)
	}
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("127.0.0.1:%d", session.Config.VNCPort), 2*time.Second)
	if err != nil {
		return nil, session, err
	}
	return conn, session, nil
}

func cloneSession(session *Session) *Session {
	if session == nil {
		return nil
	}
	sessionCopy := *session
	if session.Config != nil {
		configCopy := *session.Config
		sessionCopy.Config = &configCopy
	}
	return &sessionCopy
}

func buildQEMUCommand(config *QEMUConfig) *exec.Cmd {
	dispPort := config.VNCPort - 5900
	cmd := exec.Command(
		"qemu-system-aarch64",
		"-machine", fmt.Sprintf("%s,accel=hvf", config.Machine),
		"-cpu", config.CPU,
		"-smp", fmt.Sprintf("cores=%d", config.CPUCores),
		"-m", fmt.Sprintf("%dM", config.MemoryMB),
		"-net", "nic,model=virtio-net-pci",
		"-net", fmt.Sprintf("user,hostfwd=tcp::%d-:22", config.SSHPort),
		"-vnc", fmt.Sprintf(":%d,to=99", dispPort),
		"-drive", fmt.Sprintf("file=%s,format=qcow2,if=virtio", config.DiskImage),
		"-cdrom", config.SeedImage,
	)
	cmd.Env = append(os.Environ(), "QT_QPA_PLATFORM=offscreen")
	return cmd
}

func getDefaultDiskImage() string {
	fullConfig := wconfig.GetWatcher().GetFullConfig()
	if fullConfig.Settings.SandboxDiskImage != "" {
		return fullConfig.Settings.SandboxDiskImage
	}

	homeDir, _ := os.UserHomeDir()
	sandboxDir := filepath.Join(homeDir, ".waveterm", "sandbox")
	candidates := []string{
		filepath.Join(sandboxDir, "ubuntu-desktop.qcow2"),
		filepath.Join(sandboxDir, "disk.qcow2"),
	}
	for _, candidate := range candidates {
		if fileExists(candidate) {
			return candidate
		}
	}
	return candidates[0]
}

func getDefaultSeedImage() string {
	homeDir, _ := os.UserHomeDir()
	return homeDir + "/.waveterm/sandbox/seed.iso"
}

func fileExists(path string) bool {
	if path == "" {
		return false
	}
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return !info.IsDir()
}

func makeLaunchError(err error, stderrBuf *bytes.Buffer) string {
	if stderrBuf == nil {
		return err.Error()
	}
	stderr := strings.TrimSpace(stderrBuf.String())
	if stderr == "" {
		return err.Error()
	}
	return fmt.Sprintf("%v: %s", err, stderr)
}
