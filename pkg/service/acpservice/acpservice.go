// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

package acpservice

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/wavetermdev/waveterm/pkg/tsgen/tsgenmeta"
	"github.com/wavetermdev/waveterm/pkg/waveobj"
	"github.com/wavetermdev/waveterm/pkg/wstore"
)

const DefaultTimeout = 2 * time.Second

type AcpService struct{}

func (svc *AcpService) ListSessions_Meta() tsgenmeta.MethodMeta {
	return tsgenmeta.MethodMeta{ReturnDesc: "sessions"}
}

func (svc *AcpService) ListSessions() ([]*waveobj.AcpSession, error) {
	ctx, cancelFn := context.WithTimeout(context.Background(), DefaultTimeout)
	defer cancelFn()
	sessions, err := wstore.DBGetAllObjsByType[*waveobj.AcpSession](ctx, waveobj.OType_AcpSession)
	if err != nil {
		return nil, fmt.Errorf("error listing ACP sessions: %w", err)
	}
	sort.Slice(sessions, func(i int, j int) bool {
		return sessions[i].UpdatedTs > sessions[j].UpdatedTs
	})
	return sessions, nil
}

func (svc *AcpService) GetSession_Meta() tsgenmeta.MethodMeta {
	return tsgenmeta.MethodMeta{ArgNames: []string{"conversationId"}, ReturnDesc: "session"}
}

func (svc *AcpService) GetSession(conversationId string) (*waveobj.AcpSession, error) {
	ctx, cancelFn := context.WithTimeout(context.Background(), DefaultTimeout)
	defer cancelFn()
	session, err := wstore.DBGet[*waveobj.AcpSession](ctx, conversationId)
	if err != nil {
		return nil, fmt.Errorf("error loading ACP session: %w", err)
	}
	return session, nil
}

func (svc *AcpService) SaveSession_Meta() tsgenmeta.MethodMeta {
	return tsgenmeta.MethodMeta{ArgNames: []string{"session"}, ReturnDesc: "session"}
}

func (svc *AcpService) SaveSession(session *waveobj.AcpSession) (*waveobj.AcpSession, error) {
	if session == nil || session.OID == "" || session.Backend == "" {
		return nil, fmt.Errorf("ACP session requires conversation id and backend")
	}
	ctx, cancelFn := context.WithTimeout(context.Background(), DefaultTimeout)
	defer cancelFn()
	if session.Meta == nil {
		session.Meta = make(waveobj.MetaMapType)
	}
	now := time.Now().UnixMilli()
	if session.CreatedTs == 0 {
		session.CreatedTs = now
	}
	session.UpdatedTs = now
	exists, err := wstore.DBExistsORef(ctx, waveobj.MakeORef(waveobj.OType_AcpSession, session.OID))
	if err != nil {
		return nil, fmt.Errorf("error checking ACP session: %w", err)
	}
	if exists {
		err = wstore.DBUpdate(ctx, session)
	} else {
		err = wstore.DBInsert(ctx, session)
	}
	if err != nil {
		return nil, fmt.Errorf("error saving ACP session: %w", err)
	}
	return session, nil
}

func (svc *AcpService) ArchiveSession_Meta() tsgenmeta.MethodMeta {
	return tsgenmeta.MethodMeta{ArgNames: []string{"conversationId"}}
}

func (svc *AcpService) ArchiveSession(conversationId string) error {
	ctx, cancelFn := context.WithTimeout(context.Background(), DefaultTimeout)
	defer cancelFn()
	return wstore.DBUpdateFnErr[*waveobj.AcpSession](ctx, conversationId, func(session *waveobj.AcpSession) error {
		session.Status = "archived"
		session.ResumeState = "archived"
		session.UpdatedTs = time.Now().UnixMilli()
		return nil
	})
}

func (svc *AcpService) DeleteSession_Meta() tsgenmeta.MethodMeta {
	return tsgenmeta.MethodMeta{ArgNames: []string{"conversationId"}}
}

func (svc *AcpService) DeleteSession(conversationId string) error {
	ctx, cancelFn := context.WithTimeout(context.Background(), DefaultTimeout)
	defer cancelFn()
	return wstore.DBDelete(ctx, waveobj.OType_AcpSession, conversationId)
}
