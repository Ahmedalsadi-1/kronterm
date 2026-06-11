export type Part = {
    type: 'text' | 'reasoning' | 'patch' | 'tool-call' | 'tool-result' | 'image' | 'file' | string;
    text?: string;
    content?: string;
    value?: string;
    synthetic?: boolean;
    time?: {
        start?: number;
        end?: number;
    };
    [key: string]: any;
};

export type Message = {
    id: string;
    role: 'user' | 'assistant' | 'system' | string;
    parts: Part[];
    clientRole?: string;
    userMessageMarker?: boolean;
    origin?: string;
    source?: string;
    [key: string]: any;
};
