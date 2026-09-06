package aiusechat

import (
	"testing"

	sandboxmanager "github.com/wavetermdev/waveterm/pkg/sandbox/manager"
)

func TestKrontermDesktopComputerUseURL(t *testing.T) {
	tests := []struct {
		name    string
		session *sandboxmanager.Session
		want    string
	}{
		{
			name: "prefers MCP URL",
			session: &sandboxmanager.Session{
				DesktopURL: "http://localhost:9990",
				MCPURL:     "http://127.0.0.1:4567/computer-use/",
			},
			want: "http://127.0.0.1:4567/computer-use",
		},
		{
			name: "derives from desktop root URL",
			session: &sandboxmanager.Session{
				DesktopURL: "http://localhost:9990",
			},
			want: "http://localhost:9990/computer-use",
		},
		{
			name: "derives from desktop preview URL",
			session: &sandboxmanager.Session{
				DesktopURL: "http://localhost:9990/novnc/vnc_lite.html?scale=true",
			},
			want: "http://localhost:9990/computer-use",
		},
		{
			name: "keeps existing computer-use URL",
			session: &sandboxmanager.Session{
				DesktopURL: "http://localhost:9990/computer-use",
			},
			want: "http://localhost:9990/computer-use",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := krontermDesktopComputerUseURL(tt.session)
			if got != tt.want {
				t.Fatalf("expected %q, got %q", tt.want, got)
			}
		})
	}
}
