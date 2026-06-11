// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * IMPLEMENTATION GUIDE: Integrating ImprovedChatInput into AcpChatPanel
 * 
 * This file demonstrates how to update the AcpChatPanel to use the new
 * ImprovedChatInput component for a better chat UX.
 */

// ─── Step 1: Import the new components ──────────────────────────────────────

/*
import { ImprovedChatInput } from "@/app/aipanel/improved-chat-input";
import type {
  FileWithPreview,
  PastedContent,
  ModelOption,
} from "@/app/aipanel/improved-chat-input";
*/

// ─── Step 2: Update your chat message sending logic ────────────────────────

/*
// In your AcpChatPanel or chat handler:

const handleSendImprovedChatMessage = async (
  messageText: string,
  files: FileWithPreview[],
  pastedContent: PastedContent[]
) => {
  // Convert files to the format your backend expects
  const fileMetadata = files.map(f => ({
    id: f.id,
    name: f.file.name,
    size: f.file.size,
    type: f.file.type,
    hasPreview: !!f.preview,
    isTextual: !!f.textContent,
  }));

  // Convert pasted content
  const pastedMetadata = pastedContent.map(p => ({
    id: p.id,
    wordCount: p.wordCount,
    characterCount: p.content.length,
    timestamp: p.timestamp.toISOString(),
  }));

  // Send to your backend
  await sendMessage({
    text: messageText,
    files: fileMetadata,
    pastedContent: pastedMetadata,
    fileObjects: files, // Include actual File objects if needed
  });

  // Clear the state after sending
  // (The component will handle this internally)
};
*/

// ─── Step 3: Add a model selector helper ────────────────────────────────────

/*
// Helper to convert available agents to ModelOption format
const getAvailableModels = (state: AcpSessionState): ModelOption[] => {
  const models = state.activeRuntime?.session?.models ?? [];
  
  return models.map(model => ({
    id: model.modelId,
    name: model.displayName || model.modelId,
    description: model.description || "AI Model",
    badge: model.recommended ? "Recommended" : undefined,
  }));
};

// Get the default model
const getDefaultModel = (state: AcpSessionState): string | undefined => {
  return state.activeRuntime?.session?.selectedModelId;
};
*/

// ─── Step 4: Add the component to your JSX ────────────────────────────────

/*
// In your AcpChatPanel render:

export const AcpChatPanel = memo(({ className }: AcpChatPanelProps) => {
  const { state, sendMessage, setModel } = useAcpSession();
  const models = useMemo(() => getAvailableModels(state), [state]);
  const defaultModel = useMemo(() => getDefaultModel(state), [state]);

  return (
    <div className={cn("acp-chat-panel", className)}>
      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto">
        <ChatMessageList messages={messages} />
      </div>

      {/* New ImprovedChatInput component */}
      <ImprovedChatInput
        onSendMessage={handleSendImprovedChatMessage}
        disabled={state.activeRuntime?.processing}
        placeholder="Ask KronosCode anything..."
        maxFiles={10}
        maxFileSize={50 * 1024 * 1024}
        acceptedFileTypes={[
          "image/*",
          ".pdf",
          ".txt",
          ".md",
          ".js",
          ".jsx",
          ".ts",
          ".tsx",
          ".go",
          ".py",
        ]}
        models={models}
        defaultModel={defaultModel}
        onModelChange={(modelId) => setModel(modelId)}
      />
    </div>
  );
});
*/

// ─── Step 5: Update styling (if needed) ──────────────────────────────────────

/*
// Add to your SCSS file (e.g., aipanel.scss):

.acp-chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--panel-bg-color);

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
  }

  .improved-chat-input-wrapper {
    padding: 12px;
    border-top: 1px solid var(--border-color);
    background: var(--surface-base-color);
  }
}
*/

// ─── Step 6: Handle file uploads to your backend ────────────────────────────

/*
// Example backend integration:

async function uploadFileToBackend(file: File, onProgress?: (progress: number) => void) {
  const formData = new FormData();
  formData.append("file", file);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const progress = (event.loaded / event.total) * 100;
        onProgress?.(progress);
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status === 200 || xhr.status === 201) {
        const response = JSON.parse(xhr.responseText);
        resolve(response);
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("Upload failed"));
    });

    xhr.open("POST", "/api/upload");
    xhr.send(formData);
  });
}

// In the send handler:
const handleSendImprovedChatMessage = async (
  messageText: string,
  files: FileWithPreview[],
  pastedContent: PastedContent[]
) => {
  // Upload files
  const uploadedFiles = await Promise.all(
    files.map(async (f) => {
      try {
        const result = await uploadFileToBackend(f.file, (progress) => {
          // Update progress in the component (if needed)
          console.log(`Uploading ${f.file.name}: ${progress}%`);
        });
        return { ...f, uploadId: result.id };
      } catch (error) {
        console.error(`Failed to upload ${f.file.name}:`, error);
        return null;
      }
    })
  );

  // Send message with uploaded files
  await sendMessage({
    text: messageText,
    files: uploadedFiles.filter(Boolean),
    pastedContent,
  });
};
*/

// ─── Step 7: Error handling ─────────────────────────────────────────────────

/*
// Add error handling in your message send:

const handleSendImprovedChatMessage = async (
  messageText: string,
  files: FileWithPreview[],
  pastedContent: PastedContent[]
) => {
  try {
    // Validate input
    if (!messageText.trim() && files.length === 0) {
      throw new Error("Please enter a message or attach files");
    }

    // Check for unsupported file types
    const unsupportedFiles = files.filter(f => !isFileTypeSupported(f.type));
    if (unsupportedFiles.length > 0) {
      throw new Error(
        `Unsupported file types: ${unsupportedFiles.map(f => f.file.name).join(", ")}`
      );
    }

    // Send message
    setMessageLoading(true);
    await sendMessage({
      text: messageText,
      files,
      pastedContent,
    });
  } catch (error) {
    console.error("Failed to send message:", error);
    setError(error instanceof Error ? error.message : "Failed to send message");
  } finally {
    setMessageLoading(false);
  }
};
*/

// ─── Step 8: Keyboard shortcuts (optional enhancement) ──────────────────────

/*
// The component already supports:
// - Enter: Send message
// - Shift+Enter: New line
// - Cmd/Ctrl+V: Paste files or content

// To add additional shortcuts:
const handleKeyboardShortcuts = (event: KeyboardEvent) => {
  // Cmd/Ctrl+Shift+L: Clear all files
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "l") {
    event.preventDefault();
    clearAllFiles();
  }

  // Cmd/Ctrl+Shift+C: Copy last message
  if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key === "c") {
    event.preventDefault();
    copyLastMessage();
  }
};
*/

// ─── Step 9: Mobile responsiveness ──────────────────────────────────────────

/*
// The component is already responsive with:
// - Tailwind responsive classes (sm:, md:, lg:)
// - Flexible layout that adapts to container size
// - Touch-friendly button sizes

// For further mobile optimization:
const getMobileOptimizedPlaceholder = () => {
  const isMobile = window.innerWidth < 768;
  return isMobile ? "Ask..." : "Ask KronosCode anything...";
};
*/

// ─── Step 10: Accessibility enhancements ────────────────────────────────────

/*
// Add ARIA labels and descriptions:

<ImprovedChatInput
  onSendMessage={handleSendImprovedChatMessage}
  disabled={isLoading}
  placeholder="Ask KronosCode anything..."
  // Add role, aria-label, aria-describedby as needed
  role="region"
  aria-label="Chat input area"
  aria-describedby="chat-help-text"
/>

// Add help text:
<div id="chat-help-text" className="sr-only">
  Type your message, attach files, or paste content. Press Enter to send,
  Shift+Enter for new line.
</div>
*/

// ─── Migration Checklist ────────────────────────────────────────────────────

/*
✓ Import ImprovedChatInput component
✓ Create handleSendImprovedChatMessage callback
✓ Convert available models to ModelOption format
✓ Replace old input component with ImprovedChatInput
✓ Update file upload handling
✓ Add error handling
✓ Test keyboard shortcuts
✓ Test drag-and-drop
✓ Test pasted content detection
✓ Test mobile responsiveness
✓ Add accessibility features
✓ Update documentation
✓ Run TypeScript checks: npm run check:ts
✓ Test in preview: task preview
*/

// ─── Files to Modify ────────────────────────────────────────────────────────

/*
Files to update:
1. frontend/app/aipanel/acp-chat-panel.tsx
   - Import ImprovedChatInput
   - Update the input section
   - Add model conversion helpers
   - Update message sending logic

2. frontend/app/aipanel/aipanel.scss (if using)
   - Add styling for the new component
   - Update layout classes as needed

3. frontend/app/aipanel/aitypes.ts
   - Add FileWithPreview and PastedContent types (optional)
   - Update WaveUIMessage to include file metadata

4. frontend/types/gotypes.d.ts
   - Update if needed for file handling in RPC

5. Tests
   - frontend/app/aipanel/acp-chat-panel.test.ts
   - Test message sending with files
   - Test file validation
   - Test paste detection
*/

// ─── Additional Resources ───────────────────────────────────────────────────

/*
Related documentation:
- improved-chat-input.tsx: Main component implementation
- improved-aipanel-input.tsx: Adapter for WaveAIModel integration
- improved-chat-input-integration.tsx: Detailed integration guide
- AGENTS.md: Wave Terminal architecture
- .kilocode/skills/add-rpc/SKILL.md: For backend file handling
*/

export {};
