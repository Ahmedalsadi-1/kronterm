import { atom } from 'jotai';

export const themeModeAtom = atom<'system' | 'light' | 'dark'>('system');
export const fontSizeAtom = atom(100);
export const terminalFontSizeAtom = atom(13);
export const spacingAtom = atom(100);
export const cornerRadiusAtom = atom(12);
export const inputBarOffsetAtom = atom(0);
export const toolCallExpansionAtom = atom<'collapsed' | 'activity' | 'detailed'>('activity');
export const diffLayoutPreferenceAtom = atom<'dynamic' | 'inline' | 'side-by-side'>('dynamic');
export const diffViewModeAtom = atom<'single' | 'stacked'>('single');
export const showTerminalQuickKeysAtom = atom(false);
export const showReasoningTracesAtom = atom(false);
export const showTextJustificationActivityAtom = atom(false);
export const queueModeEnabledAtom = atom(false);
export const persistChatDraftAtom = atom(true);
export const autoDeleteEnabledAtom = atom(false);
export const autoDeleteAfterDaysAtom = atom(30);
export const nativeNotificationsEnabledAtom = atom(false);
export const notificationModeAtom = atom<'always' | 'hidden-only'>('always');
export const notifyOnCompletionAtom = atom(true);
export const notifyOnErrorAtom = atom(true);
export const notifyOnQuestionAtom = atom(true);
export const notifyOnSubtasksAtom = atom(false);
export const notificationTemplatesAtom = atom({
    completion: { title: '{agent_name} is ready', message: '{model_name} completed the task' },
    error: { title: 'Tool error', message: '{last_message}' },
    question: { title: 'Input needed', message: '{last_message}' },
    subtask: { title: '{agent_name} is ready', message: '{model_name} completed the task' },
});
export const keyboardShortcutOverridesAtom = atom<Record<string, string>>({});
