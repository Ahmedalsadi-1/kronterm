import { Check, ChevronDown, Cloud, Laptop2, Link, LoaderCircle, Plus, RefreshCw, Server, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { HostKind, HostRuntimeState } from "../types";

export interface ConnectHostInput {
    label: string;
    baseUrl: string;
    kind: HostKind;
    token?: string;
    code?: string;
}

interface HostSheetProps {
    open: boolean;
    hosts: HostRuntimeState[];
    connecting: boolean;
    onClose: () => void;
    onConnect: (input: ConnectHostInput) => Promise<void>;
    onRemove: (hostId: string) => Promise<void>;
    onRefresh: () => Promise<void>;
}

const KindOptions: Array<{ kind: HostKind; label: string; detail: string; icon: typeof Cloud }> = [
    {
        kind: "managed",
        label: "Kron Cloud",
        detail: "Always-on Browser Host or full Kron Sandbox",
        icon: Cloud,
    },
    {
        kind: "computer",
        label: "My computer",
        detail: "Pair the KronLink Host running on your Mac or PC",
        icon: Laptop2,
    },
    {
        kind: "sandbox",
        label: "Self-hosted",
        detail: "Connect your own KronosChamber or KronTerm server",
        icon: Server,
    },
];

export const HostSheet = ({ open, hosts, connecting, onClose, onConnect, onRemove, onRefresh }: HostSheetProps) => {
    const [adding, setAdding] = useState(false);
    const [kind, setKind] = useState<HostKind>("managed");
    const [label, setLabel] = useState("");
    const [baseUrl, setBaseUrl] = useState("");
    const [token, setToken] = useState("");
    const [code, setCode] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        if (!open) {
            setAdding(false);
            setError("");
        }
    }, [open]);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        setError("");
        try {
            await onConnect({ label, baseUrl, kind, token, code });
            setAdding(false);
            setLabel("");
            setBaseUrl("");
            setToken("");
            setCode("");
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "Could not connect this host");
        }
    };

    return (
        <section className={`host-sheet ${open ? "is-open" : ""}`} aria-hidden={!open}>
            <div className="sheet-drag-handle" />
            <header className="host-sheet-header">
                <button type="button" onClick={onClose} aria-label="Close hosts">
                    <ChevronDown />
                </button>
                <div>
                    <strong>Hosts</strong>
                    <small>
                        {hosts.length ? `${hosts.length} places Kronos can work` : "Give Kronos a place to work"}
                    </small>
                </div>
                <button type="button" onClick={() => void onRefresh()} aria-label="Refresh hosts">
                    <RefreshCw />
                </button>
            </header>

            <div className="host-sheet-body">
                {hosts.length ? (
                    <div className="host-list">
                        {hosts.map(({ profile, connection, detail }) => (
                            <article className="host-row" key={profile.id}>
                                <span className="host-row-mark" style={{ background: profile.color }}>
                                    {profile.kind === "computer" ? (
                                        <Laptop2 />
                                    ) : profile.kind === "managed" ? (
                                        <Cloud />
                                    ) : (
                                        <Server />
                                    )}
                                </span>
                                <div>
                                    <strong>{profile.label}</strong>
                                    <small>{detail || profile.baseUrl}</small>
                                    <div className="host-capabilities">
                                        {profile.capabilities.slice(0, 4).map((capability) => (
                                            <span key={capability}>{capability}</span>
                                        ))}
                                    </div>
                                </div>
                                <span className={`host-connection host-${connection}`}>
                                    {connection === "connecting" ? <LoaderCircle className="spin" /> : <i />}
                                    {connection}
                                </span>
                                {profile.kind !== "managed" ? (
                                    <button
                                        className="host-remove"
                                        type="button"
                                        onClick={() => void onRemove(profile.id)}
                                        aria-label={`Remove ${profile.label}`}
                                    >
                                        <Trash2 />
                                    </button>
                                ) : null}
                            </article>
                        ))}
                    </div>
                ) : (
                    <div className="host-empty">
                        <span>
                            <Link />
                        </span>
                        <h2>No computer required.</h2>
                        <p>
                            Add Kron Cloud or a Browser Host for a standalone workspace. Your computer remains optional.
                        </p>
                    </div>
                )}

                {adding ? (
                    <form className="host-form" onSubmit={submit}>
                        <div className="host-kind-grid">
                            {KindOptions.map((option) => {
                                const Icon = option.icon;
                                return (
                                    <button
                                        className={kind === option.kind ? "is-selected" : ""}
                                        type="button"
                                        key={option.kind}
                                        onClick={() => setKind(option.kind)}
                                    >
                                        <Icon />
                                        <span>
                                            <strong>{option.label}</strong>
                                            <small>{option.detail}</small>
                                        </span>
                                        {kind === option.kind ? <Check /> : null}
                                    </button>
                                );
                            })}
                        </div>

                        <label>
                            <span>Name</span>
                            <input
                                value={label}
                                onChange={(event) => setLabel(event.target.value)}
                                placeholder={kind === "computer" ? "Alba's Mac" : "Kron Cloud"}
                            />
                        </label>
                        <label>
                            <span>Host address</span>
                            <input
                                value={baseUrl}
                                onChange={(event) => setBaseUrl(event.target.value)}
                                placeholder={
                                    kind === "computer" ? "http://192.168.1.8:4119" : "https://cloud.kronterm.dev"
                                }
                                inputMode="url"
                                autoCapitalize="none"
                                autoCorrect="off"
                                required
                            />
                        </label>
                        {kind === "computer" ? (
                            <label>
                                <span>Pairing code</span>
                                <input
                                    className="pair-code-input"
                                    value={code}
                                    onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                                    placeholder="000 000"
                                    inputMode="numeric"
                                    required
                                />
                            </label>
                        ) : (
                            <label>
                                <span>
                                    Access token <small>optional</small>
                                </span>
                                <input
                                    value={token}
                                    onChange={(event) => setToken(event.target.value)}
                                    placeholder="Stored in iPhone Keychain"
                                    type="password"
                                    autoCapitalize="none"
                                    autoCorrect="off"
                                />
                            </label>
                        )}
                        {error ? <p className="form-error">{error}</p> : null}
                        <div className="host-form-actions">
                            <button type="button" onClick={() => setAdding(false)}>
                                Cancel
                            </button>
                            <button type="submit" className="primary-action" disabled={connecting}>
                                {connecting ? <LoaderCircle className="spin" /> : <Plus />}
                                {kind === "computer" ? "Pair computer" : "Add host"}
                            </button>
                        </div>
                    </form>
                ) : (
                    <button className="add-host-button" type="button" onClick={() => setAdding(true)}>
                        <Plus />
                        Add a place for Kronos to work
                    </button>
                )}
            </div>
        </section>
    );
};
