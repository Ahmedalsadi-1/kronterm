// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

import { Toggle } from "@/app/element/toggle";
import { memo, useCallback, useRef, useState } from "react";
import clsx from "clsx";

export const SettingsCard = memo(({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={clsx("kron-settings-card", className)}>{children}</div>
));
SettingsCard.displayName = "SettingsCard";

export const SectionHeader = memo(
    ({ title, description, icon }: { title: string; description?: string; icon?: string }) => (
        <div className="kron-settings-section-header">
            <h2 className="kron-settings-section-title">
                {icon && <i className={clsx("fa", "fa-solid", `fa-${icon}`, "kron-settings-section-icon")} />}
                {title}
            </h2>
            {description && <p className="kron-settings-section-desc">{description}</p>}
        </div>
    )
);
SectionHeader.displayName = "SectionHeader";

export const SettingRow = memo(
    ({ title, description, children, indent }: SettingRowProps) => (
        <div className={clsx("kron-settings-row", indent && "kron-settings-row--indent")}>
            <div className="kron-settings-row-text">
                <div className="kron-settings-row-title">{title}</div>
                {description && <div className="kron-settings-row-desc">{description}</div>}
            </div>
            <div className="kron-settings-row-control">{children}</div>
        </div>
    )
);
SettingRow.displayName = "SettingRow";

interface SettingRowProps {
    title: string;
    description?: string;
    children: React.ReactNode;
    indent?: boolean;
}

export const ToggleSetting = memo(
    ({ title, description, checked, onChange }: ToggleSettingProps) => (
        <SettingRow title={title} description={description}>
            <Toggle checked={checked} onChange={onChange} />
        </SettingRow>
    )
);
ToggleSetting.displayName = "ToggleSetting";

interface ToggleSettingProps {
    title: string;
    description?: string;
    checked: boolean;
    onChange: (v: boolean) => void;
}

export const SelectSetting = memo(
    ({ title, description, value, onChange, options }: SelectSettingProps) => (
        <SettingRow title={title} description={description}>
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="kron-settings-select"
            >
                {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                        {opt.label}
                    </option>
                ))}
            </select>
        </SettingRow>
    )
);
SelectSetting.displayName = "SelectSetting";

interface SelectSettingProps {
    title: string;
    description?: string;
    value: string;
    onChange: (v: string) => void;
    options: { value: string; label: string }[];
}

export const InputSetting = memo(
    ({
        title,
        description,
        value,
        onChange,
        placeholder,
        type = "text",
        monospace = false,
    }: InputSettingProps) => (
        <SettingRow title={title} description={description}>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className={clsx("kron-settings-input", monospace && "kron-settings-input--mono")}
            />
        </SettingRow>
    )
);
InputSetting.displayName = "InputSetting";

interface InputSettingProps {
    title: string;
    description?: string;
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: "text" | "password" | "number";
    monospace?: boolean;
}

export const SliderSetting = memo(
    ({ title, description, value, min, max, step, onChange, displayValue }: SliderSettingProps) => (
        <SettingRow title={title} description={description}>
            <div className="kron-settings-slider-group">
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="kron-settings-range"
                    aria-label={title}
                />
                <span className="kron-settings-slider-value">{displayValue ?? value}</span>
            </div>
        </SettingRow>
    )
);
SliderSetting.displayName = "SliderSetting";

interface SliderSettingProps {
    title: string;
    description?: string;
    value: number;
    min: number;
    max: number;
    step: number;
    onChange: (v: number) => void;
    displayValue?: string;
}

export const InfoCallout = memo(({ children }: { children: React.ReactNode }) => (
    <div className="kron-settings-callout">{children}</div>
));
InfoCallout.displayName = "InfoCallout";

export const NumberInput = memo(
    ({ value, onChange, min, max, className }: NumberInputProps) => {
        const inputRef = useRef<HTMLInputElement>(null);
        const [localVal, setLocalVal] = useState(String(value));

        const commit = useCallback(() => {
            const num = Number(localVal);
            if (!isNaN(num)) {
                const clamped = Math.min(Math.max(num, min ?? 1), max ?? 999);
                onChange(clamped);
                setLocalVal(String(clamped));
            }
        }, [localVal, min, max, onChange]);

        return (
            <input
                ref={inputRef}
                type="number"
                min={min}
                max={max}
                value={localVal}
                onChange={(e) => setLocalVal(e.target.value)}
                onBlur={commit}
                onKeyDown={(e) => e.key === "Enter" && commit()}
                className={clsx("kron-settings-input kron-settings-input--number", className)}
            />
        );
    }
);
NumberInput.displayName = "NumberInput";

interface NumberInputProps {
    value: number;
    onChange: (v: number) => void;
    min?: number;
    max?: number;
    className?: string;
}