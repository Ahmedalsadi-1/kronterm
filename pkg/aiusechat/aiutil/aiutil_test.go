package aiutil

import (
	"testing"

	"github.com/wavetermdev/waveterm/pkg/aiusechat/uctypes"
)

func TestApplyPermissionRules(t *testing.T) {
	rules := []uctypes.PermissionRuleConfig{
		{Tool: "write_*", Resource: "/tmp/*", Action: "allow"},
		{Tool: "term_*", Resource: "*", Action: "deny"},
	}

	if got := applyPermissionRules("write_text_file", map[string]any{"filename": "/tmp/demo.txt"}, uctypes.ApprovalNeedsApproval, rules); got != uctypes.ApprovalAutoApproved {
		t.Fatalf("expected auto approval, got %q", got)
	}
	if got := applyPermissionRules("term_run_command", map[string]any{"command": "rm -rf /"}, uctypes.ApprovalNeedsApproval, rules); got != uctypes.ApprovalUserDenied {
		t.Fatalf("expected denied approval, got %q", got)
	}
	if got := applyPermissionRules("read_text_file", map[string]any{"filename": "/tmp/demo.txt"}, "", rules); got != "" {
		t.Fatalf("expected read tool approval to remain unchanged, got %q", got)
	}
}

func TestInferPermissionResource(t *testing.T) {
	if got := inferPermissionResource(map[string]any{"widget_id": "abc123"}); got != "abc123" {
		t.Fatalf("expected widget_id resource, got %q", got)
	}
}
