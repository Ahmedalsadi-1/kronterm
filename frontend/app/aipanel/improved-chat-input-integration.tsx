// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * INTEGRATION GUIDE: Improved Chat Input Component for Wave Terminal
 * 
 * This guide explains how to integrate the new ImprovedChatInput component
 * with Wave Terminal's KronosCode AI chat widget.
 * 
 * FILE: improved-chat-input-integration.md
 */

// ─── Overview ───────────────────────────────────────────────────────────────
// 
// The ImprovedChatInput component provides an enhanced chat UI with:
// - File attachment support with preview cards
// - Pasted content tracking
// - Model selector dropdown
// - Drag-and-drop file upload
// - Better visual design using Wave Terminal's color scheme
// - Smooth animations and transitions
// 
// The component is self-contained and works with Wave Terminal's existing
// Jotai atom system and RPC communication.

// ─── Component Props ────────────────────────────────────────────────────────

interface ImprovedChatInputProps {
  // Callback when user sends a message with files and pasted content
  onSendMessage?: (
    message: string,
    files: FileWithPreview[],
    pastedContent: PastedContent[]
  ) => void;

  // Disable input (e.g., while processing)
  disabled?: boolean;

  // Placeholder text
  placeholder?: string;

  // Maximum number of files
  maxFiles?: number;

  // Maximum file size in bytes
  maxFileSize?: number;

  // Array of accepted file type patterns
  acceptedFileTypes?: string[];

  // Available models for selection
  models?: ModelOption[];

  // Default selected model ID
  defaultModel?: string;

  // Callback when user changes model
  onModelChange?: (modelId: string) => void;
}

// ─── File Types ────────────────────────────────────────────────────────────

interface FileWithPreview {
  id: string;
  file: File;
  preview?: string; // base64 image preview for images
  type: string;
  uploadStatus: "pending" | "uploading" | "complete" | "error";
  uploadProgress?: number;
  abortController?: AbortController;
  textContent?: string; // for textual files
}

interface PastedContent {
  id: string;
  content: string;
  timestamp: Date;
  wordCount: number;
}

interface ModelOption {
  id: string;
  name: string;
  description: string;
  badge?: string; // e.g., "Latest"
}

// ─── Basic Usage ────────────────────────────────────────────────────────────

// In your component:
/*
import { ImprovedChatInput } from "@/app/aipanel/improved-chat-input";

const MyChat = () => {
  const handleSendMessage = (message, files, pastedContent) => {
    // Handle the message with files and pasted content
    console.log("Message:", message);
    console.log("Files:", files);
    console.log("Pasted Content:", pastedContent);
    
    // Send to your backend
    // ...
  };

  const models = [
    { id: "model-1", name: "Model 1", description: "Fast" },
    { id: "model-2", name: "Model 2", description: "Accurate", badge: "Latest" },
  ];

  return (
    <ImprovedChatInput
      onSendMessage={handleSendMessage}
      placeholder="Ask KronosCode anything..."
      models={models}
      defaultModel="model-1"
      onModelChange={(modelId) => console.log("Changed to:", modelId)}
    />
  );
};
*/

// ─── Integration with Wave Terminal ─────────────────────────────────────────

// 1. Replace AIPanelInput in aipanel.tsx:
//    
//    Before:
//    ```
//    import { AIPanelInput } from "@/app/aipanel/aipanelinput";
//    <AIPanelInput onSubmit={handleSubmit} status={status} model={model} />
//    ```
//
//    After:
//    ```
//    import { ImprovedChatInput } from "@/app/aipanel/improved-chat-input";
//    <ImprovedChatInput
//      onSendMessage={handleSendMessage}
//      disabled={disabled}
//      models={availableModels}
//      defaultModel={currentModel}
//      onModelChange={handleModelChange}
//    />
//    ```

// 2. Adapt WaveAIModel to use the new component:
//    
//    You need to create an adapter that converts between the new component's
//    props/callbacks and WaveAIModel's atoms:

/*
// In your component:
const WaveAIModelAdapter = ({ model }: { model: WaveAIModel }) => {
  const [input, setInput] = useAtom(model.inputAtom);
  const models = useAtomValue(model.availableModelsAtom);
  const currentModel = useAtomValue(model.selectedModelAtom);

  const handleSendMessage = (message, files, pastedContent) => {
    // Convert to WaveAIModel's format
    setInput(""); // clear input
    
    // Add files to model
    for (const file of files) {
      model.addFile(file.file, {
        textContent: file.textContent,
        preview: file.preview,
      });
    }
    
    // Send message
    model.sendMessage(message, {
      files: files.map(f => f.id),
      pastedContent: pastedContent,
    });
  };

  return (
    <ImprovedChatInput
      onSendMessage={handleSendMessage}
      disabled={model.isProcessing}
      models={models}
      defaultModel={currentModel}
      onModelChange={(modelId) => model.setSelectedModel(modelId)}
    />
  );
};
*/

// ─── Color Scheme Integration ───────────────────────────────────────────────

// The component uses Wave Terminal's color scheme:
//   - Background: #30302E / #1e1e1c
//   - Borders: #2a2a2a
//   - Text primary: #d4d4d4 / #eeeeee
//   - Text secondary: #8a8580
//   - Accent: #5b9ef5 (blue) / #d7a85d (send button)
//   - Error: #dc7668

// To customize colors, either:
// 1. Update the hex colors directly in improved-chat-input.tsx
// 2. Modify your CSS variables if you're using CSS custom properties
// 3. Pass theme props (not yet implemented)

// ─── File Handling ──────────────────────────────────────────────────────────

// The component automatically:
// - Validates file size
// - Checks file types
// - Reads textual files asynchronously
// - Generates image previews using URL.createObjectURL
// - Tracks upload progress
// - Handles upload cancellation

// Supported textual file types:
// text/*, application/json, application/xml, application/javascript
// Extensions: txt, md, py, js, ts, jsx, tsx, html, css, json, xml, yaml, etc.

// Example: Send files with metadata
/*
const handleSendMessage = (message, files, pastedContent) => {
  files.forEach(file => {
    console.log({
      name: file.file.name,
      size: file.file.size,
      type: file.type,
      isTextual: file.textContent !== undefined,
      content: file.textContent,
      preview: file.preview,
    });
  });
};
*/

// ─── Pasted Content Handling ────────────────────────────────────────────────

// When users paste content:
// - If > 200 characters, it's shown as a "PASTED" card
// - Users can copy or remove it
// - Multiple pastes are supported (up to 5)
// - Paste content is included in onSendMessage callback

// ─── Model Selection ────────────────────────────────────────────────────────

// Models are provided as an array of ModelOption:
/*
const models = [
  {
    id: "claude-sonnet",
    name: "Claude Sonnet",
    description: "Balanced model",
    badge: "Latest"
  },
  {
    id: "claude-opus",
    name: "Claude Opus",
    description: "Most capable",
  },
  {
    id: "claude-haiku",
    name: "Claude Haiku",
    description: "Fastest",
  },
];
*/

// ─── Keyboard Shortcuts ────────────────────────────────────────────────────

// - Enter: Send message
// - Shift+Enter: New line
// - Ctrl/Cmd+V: Paste files or content

// ─── Accessibility ────────────────────────────────────────────────────────

// The component includes:
// - Proper semantic HTML (buttons, inputs)
// - Title attributes for tooltips
// - Keyboard navigation
// - ARIA labels (can be added)
// - Proper focus management

// ─── Performance Considerations ────────────────────────────────────────────

// - Component uses React.memo to prevent unnecessary re-renders
// - Callbacks are memoized with useCallback
// - File preview URLs are revoked when files are removed
// - Animations use CSS transitions for smooth 60fps

// ─── TypeScript Support ────────────────────────────────────────────────────

// Fully typed with TypeScript:
// - FileWithPreview interface
// - PastedContent interface
// - ModelOption interface
// - ImprovedChatInputProps interface

// ─── Testing ────────────────────────────────────────────────────────────────

// Mock example:
/*
import { render, screen, fireEvent } from "@testing-library/react";
import { ImprovedChatInput } from "@/app/aipanel/improved-chat-input";

test("sends message with files", () => {
  const handleSend = jest.fn();
  render(
    <ImprovedChatInput onSendMessage={handleSend} />
  );
  
  const textarea = screen.getByPlaceholderText("Ask KronosCode anything...");
  fireEvent.change(textarea, { target: { value: "Hello" } });
  
  const sendButton = screen.getByTitle("Send message");
  fireEvent.click(sendButton);
  
  expect(handleSend).toHaveBeenCalledWith("Hello", [], []);
});
*/

// ─── Future Enhancements ────────────────────────────────────────────────────

// Potential improvements:
// - Voice input support
// - Markdown preview
// - Emoji picker
// - Custom theme support
// - File preview modal
// - Upload cancellation
// - Retry failed uploads
// - Drag-to-reorder files
// - Rich text editor

// ─── Troubleshooting ────────────────────────────────────────────────────────

// Issue: Files not appearing
// - Check maxFiles limit
// - Verify acceptedFileTypes
// - Check browser console for errors

// Issue: Textual file content not showing
// - Verify isTextualFile() logic
// - Check CORS if loading remote files
// - Check file encoding

// Issue: Drag-drop not working
// - Ensure event.preventDefault() is called
// - Check z-index of drag overlay
// - Verify browser supports DataTransfer API

// ─── Migration from Old Component ────────────────────────────────────────────

// If migrating from AIPanelInput:
//
// 1. Old component used:
//    - model.inputAtom for input state
//    - model.addFile() to add files
//    - onSubmit callback
//
// 2. New component uses:
//    - Local state for input
//    - Passes files in onSendMessage callback
//    - Model agnostic (can work with any model system)
//
// 3. Create an adapter layer to maintain compatibility:
//
/*
const AIPanelInputAdapter = ({ model }) => {
  const handleSendMessage = (message, files, pastedContent) => {
    // Adapt to old API
    files.forEach(f => model.addFile(f.file));
    model.submitMessage(message);
  };

  return <ImprovedChatInput onSendMessage={handleSendMessage} />;
};
*/

export {};
