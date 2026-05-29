// Copyright 2025, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package permissionrules

import (
	"regexp"
	"strings"
)

const (
	ActionAllow = "allow"
	ActionAsk   = "ask"
	ActionDeny  = "deny"
)

type Action string

type Rule struct {
	Tool     string
	Resource string
	Action   Action
}

type Decision struct {
	Action Action
	Rule   Rule
	Match  bool
}

type Ruleset []Rule

func Evaluate(tool string, resource string, rulesets ...Ruleset) Decision {
	merged := Merge(rulesets...)
	for idx := len(merged) - 1; idx >= 0; idx-- {
		rule := normalizeRule(merged[idx])
		if !Match(rule.Tool, tool) {
			continue
		}
		if !Match(rule.Resource, resource) {
			continue
		}
		return Decision{
			Action: rule.Action,
			Rule:   rule,
			Match:  true,
		}
	}

	return Decision{
		Action: ActionAsk,
		Rule: Rule{
			Tool:     tool,
			Resource: "*",
			Action:   ActionAsk,
		},
	}
}

func Merge(rulesets ...Ruleset) Ruleset {
	total := 0
	for _, ruleset := range rulesets {
		total += len(ruleset)
	}

	merged := make(Ruleset, 0, total)
	for _, ruleset := range rulesets {
		merged = append(merged, ruleset...)
	}
	return merged
}

func Match(pattern string, value string) bool {
	pattern = normalizePattern(pattern)

	var builder strings.Builder
	builder.WriteString("^")
	for _, char := range pattern {
		switch char {
		case '*':
			builder.WriteString(".*")
		case '?':
			builder.WriteString(".")
		default:
			builder.WriteString(regexp.QuoteMeta(string(char)))
		}
	}
	builder.WriteString("$")

	return regexp.MustCompile(builder.String()).MatchString(value)
}

func normalizeRule(rule Rule) Rule {
	rule.Tool = normalizePattern(rule.Tool)
	rule.Resource = normalizePattern(rule.Resource)
	if !IsValidAction(rule.Action) {
		rule.Action = ActionAsk
	}
	return rule
}

func normalizePattern(pattern string) string {
	if pattern == "" {
		return "*"
	}
	return pattern
}

func IsValidAction(action Action) bool {
	switch action {
	case ActionAllow, ActionAsk, ActionDeny:
		return true
	default:
		return false
	}
}
