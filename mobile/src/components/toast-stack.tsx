import { CheckCircle2, CircleAlert, X } from "lucide-react";
import type { ToastMessage } from "../types";

interface ToastStackProps {
    toasts: ToastMessage[];
    onDismiss: (id: string) => void;
}

export const ToastStack = ({ toasts, onDismiss }: ToastStackProps) => (
    <aside className="toast-stack" aria-live="polite">
        {toasts.map((toast) => (
            <article className={`toast toast-${toast.tone}`} key={toast.id}>
                {toast.tone === "success" ? <CheckCircle2 /> : <CircleAlert />}
                <div>
                    <strong>{toast.title}</strong>
                    {toast.detail ? <small>{toast.detail}</small> : null}
                </div>
                <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Dismiss notification">
                    <X />
                </button>
            </article>
        ))}
    </aside>
);
