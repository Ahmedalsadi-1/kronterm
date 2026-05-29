// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package permissionrules

import "testing"

func TestEvaluateDefaultsToAsk(t *testing.T) {
	decision := Evaluate("desktop_click", "window:mail")

	if decision.Action != ActionAsk {
		t.Fatalf("expected default action %q, got %q", ActionAsk, decision.Action)
	}
	if decision.Match {
		t.Fatalf("expected unmatched default decision")
	}
	if decision.Rule.Tool != "desktop_click" || decision.Rule.Resource != "*" {
		t.Fatalf("unexpected default rule: %#v", decision.Rule)
	}
}

func TestEvaluateMatchesToolAndResourceWildcards(t *testing.T) {
	rules := Ruleset{
		{Tool: "widget_*", Resource: "tab:*", Action: ActionAllow},
		{Tool: "desktop_*", Resource: "window:settings", Action: ActionDeny},
	}

	tests := []struct {
		name     string
		tool     string
		resource string
		want     Action
	}{
		{name: "tool wildcard", tool: "widget_click", resource: "tab:abc", want: ActionAllow},
		{name: "exact resource", tool: "desktop_type", resource: "window:settings", want: ActionDeny},
		{name: "resource mismatch", tool: "desktop_type", resource: "window:mail", want: ActionAsk},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			decision := Evaluate(test.tool, test.resource, rules)
			if decision.Action != test.want {
				t.Fatalf("expected action %q, got %q", test.want, decision.Action)
			}
		})
	}
}

func TestEvaluateUsesLastMatchingRule(t *testing.T) {
	base := Ruleset{
		{Tool: "desktop_*", Resource: "*", Action: ActionAsk},
		{Tool: "desktop_click", Resource: "window:*", Action: ActionAllow},
	}
	override := Ruleset{
		{Tool: "desktop_click", Resource: "window:admin", Action: ActionDeny},
	}

	decision := Evaluate("desktop_click", "window:admin", base, override)
	if decision.Action != ActionDeny {
		t.Fatalf("expected last matching action %q, got %q", ActionDeny, decision.Action)
	}
	if !decision.Match {
		t.Fatalf("expected matching rule")
	}
	if decision.Rule.Resource != "window:admin" {
		t.Fatalf("expected winning rule to be returned, got %#v", decision.Rule)
	}
}

func TestEvaluateTreatsEmptyPatternsAsWildcards(t *testing.T) {
	decision := Evaluate("term_run_command", "", Ruleset{{Action: ActionAllow}})

	if decision.Action != ActionAllow {
		t.Fatalf("expected empty rule patterns to match all, got %q", decision.Action)
	}
	if decision.Rule.Tool != "*" || decision.Rule.Resource != "*" {
		t.Fatalf("expected normalized wildcard rule, got %#v", decision.Rule)
	}
}

func TestEvaluateInvalidActionFallsBackToAsk(t *testing.T) {
	decision := Evaluate("widget_click", "tab:abc", Ruleset{{
		Tool:     "widget_*",
		Resource: "tab:*",
		Action:   "approve",
	}})

	if decision.Action != ActionAsk {
		t.Fatalf("expected invalid action to become %q, got %q", ActionAsk, decision.Action)
	}
	if !decision.Match {
		t.Fatalf("expected invalid-action rule to still count as a match")
	}
}

func TestMatchSupportsStarAndQuestionWildcards(t *testing.T) {
	tests := []struct {
		pattern string
		value   string
		want    bool
	}{
		{pattern: "widget_*", value: "widget_click", want: true},
		{pattern: "desktop_?????", value: "desktop_click", want: true},
		{pattern: "desktop_?????", value: "desktop_scroll", want: false},
		{pattern: "file:/tmp/*.txt", value: "file:/tmp/a.txt", want: true},
		{pattern: "file:/tmp/*.txt", value: "file:/tmp/a.md", want: false},
		{pattern: "", value: "anything", want: true},
	}

	for _, test := range tests {
		if got := Match(test.pattern, test.value); got != test.want {
			t.Fatalf("Match(%q, %q) = %v, want %v", test.pattern, test.value, got, test.want)
		}
	}
}

func TestMergePreservesRuleOrder(t *testing.T) {
	first := Ruleset{{Tool: "a", Resource: "*", Action: ActionAllow}}
	second := Ruleset{{Tool: "b", Resource: "*", Action: ActionDeny}}

	merged := Merge(first, second)
	if len(merged) != 2 {
		t.Fatalf("expected 2 merged rules, got %d", len(merged))
	}
	if merged[0].Tool != "a" || merged[1].Tool != "b" {
		t.Fatalf("unexpected merge order: %#v", merged)
	}
}
