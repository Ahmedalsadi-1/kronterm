import React from 'react';
import { useAtom } from 'jotai';
import { Switch } from '@/app/components/ui/switch';
import {
    nativeNotificationsEnabledAtom,
    notificationModeAtom,
    notifyOnCompletionAtom,
    notifyOnErrorAtom,
    notifyOnQuestionAtom,
    notifyOnSubtasksAtom,
    notificationTemplatesAtom,
} from '@/stores/kronosChamberSettingsStore';

export const NotificationSettings: React.FC = () => {
    const [nativeNotificationsEnabled, setNativeNotificationsEnabled] = useAtom(nativeNotificationsEnabledAtom);
    const [notificationMode, setNotificationMode] = useAtom(notificationModeAtom);
    const [notifyOnCompletion, setNotifyOnCompletion] = useAtom(notifyOnCompletionAtom);
    const [notifyOnError, setNotifyOnError] = useAtom(notifyOnErrorAtom);
    const [notifyOnQuestion, setNotifyOnQuestion] = useAtom(notifyOnQuestionAtom);
    const [notifyOnSubtasks, setNotifyOnSubtasks] = useAtom(notifyOnSubtasksAtom);
    const [notificationTemplates, setNotificationTemplates] = useAtom(notificationTemplatesAtom);

    const updateTemplate = (
        event: 'completion' | 'error' | 'question' | 'subtask',
        field: 'title' | 'message',
        value: string,
    ) => {
        setNotificationTemplates({
            ...notificationTemplates,
            [event]: {
                ...notificationTemplates[event],
                [field]: value,
            },
        });
    };

    return (
        <div className="space-y-6">
            <div className="space-y-1">
                <h3 className="text-base font-semibold text-foreground">When to notify</h3>
                <p className="text-sm text-muted-foreground">Customize when notifications show up.</p>
            </div>

            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <span className="text-sm font-medium text-foreground">Enable notifications</span>
                    <p className="text-xs text-muted-foreground">Turns notifications on or off.</p>
                </div>
                <Switch
                    checked={nativeNotificationsEnabled}
                    onCheckedChange={setNativeNotificationsEnabled}
                    className="data-[state=checked]:bg-status-info"
                />
            </div>

            {nativeNotificationsEnabled && (
                <>
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <span className="text-sm font-medium text-foreground">Notify while app is focused</span>
                            <p className="text-xs text-muted-foreground">When off, only notify when you are not looking at KronTerm.</p>
                        </div>
                        <Switch
                            checked={notificationMode === 'always'}
                            onCheckedChange={(checked) => setNotificationMode(checked ? 'always' : 'hidden-only')}
                            className="data-[state=checked]:bg-status-info"
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="space-y-0.5">
                            <span className="text-sm font-medium text-foreground">Events</span>
                            <p className="text-xs text-muted-foreground">Choose which events trigger notifications.</p>
                        </div>

                        {[
                            { label: 'Completion', desc: 'Agent finished its task.', checked: notifyOnCompletion, onChange: setNotifyOnCompletion },
                            { label: 'Errors', desc: 'A tool call failed.', checked: notifyOnError, onChange: setNotifyOnError },
                            { label: 'Questions', desc: 'Agent is asking for input or permission.', checked: notifyOnQuestion, onChange: setNotifyOnQuestion },
                            { label: 'Subagents', desc: 'Also notify for child sessions.', checked: notifyOnSubtasks, onChange: setNotifyOnSubtasks },
                        ].map((item) => (
                            <div key={item.label} className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <span className="text-sm text-foreground">{item.label}</span>
                                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                                </div>
                                <Switch
                                    checked={item.checked}
                                    onCheckedChange={item.onChange}
                                    className="data-[state=checked]:bg-status-info"
                                />
                            </div>
                        ))}
                    </div>

                    <div className="space-y-4 pt-2">
                        <div className="space-y-1">
                            <h3 className="text-base font-semibold text-foreground">Customize content</h3>
                            <p className="text-xs text-muted-foreground">
                                Use template variables: {'{project_name}'} {'{branch}'} {'{agent_name}'} {'{last_message}'}
                            </p>
                        </div>
                        {(['completion', 'error', 'question', 'subtask'] as const).map((event) => (
                            <div key={event} className="space-y-2">
                                <span className="text-sm font-medium text-foreground capitalize">{event}</span>
                                <div className="space-y-1.5">
                                    <div>
                                        <label className="text-xs text-muted-foreground block mb-1">Title</label>
                                        <input
                                            type="text"
                                            value={notificationTemplates[event].title}
                                            onChange={(e) => updateTemplate(event, 'title', e.target.value)}
                                            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-muted-foreground block mb-1">Message</label>
                                        <input
                                            type="text"
                                            value={notificationTemplates[event].message}
                                            onChange={(e) => updateTemplate(event, 'message', e.target.value)}
                                            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
