// Copyright 2026, Command Line Inc.
// SPDX-License-Identifier: Apache-2.0

/**
 * Adapter component to integrate ImprovedChatInput with Wave Terminal's WaveAIModel
 * and existing chat architecture.
 */

import { useAtom, useAtomValue } from "jotai";
import { memo, useCallback, useMemo } from "react";
import type { WaveAIModel } from "@/app/aipanel/waveai-model";
import {
  ImprovedChatInput,
  type FileWithPreview,
  type PastedContent,
  type ModelOption,
} from "@/app/aipanel/improved-chat-input";

interface ImprovedAIPanelInputProps {
  model: WaveAIModel;
  onSubmit?: (message: string, files: FileWithPreview[], pastedContent: PastedContent[]) => void;
  disabled?: boolean;
}

/**
 * This adapter bridges the new ImprovedChatInput component with Wave Terminal's
 * existing WaveAIModel system. It handles:
 * - Converting model atoms to component props
 * - Adapting file handling to WaveAIModel's addFile method
 * - Managing message submission through the model's interface
 * - Tracking model selection changes
 */
export const ImprovedAIPanelInput = memo(
  ({ model, onSubmit, disabled = false }: ImprovedAIPanelInputProps) => {
    const [input, setInput] = useAtom(model.inputAtom);
    const isFocused = useAtomValue(model.isWaveAIFocusedAtom);
    const isChatEmpty = useAtomValue(model.isChatEmptyAtom);

    // Get placeholder based on state
    const placeholder = useMemo(() => {
      if (!isChatEmpty) {
        return "Continue...";
      } else if (model.inBuilder) {
        return "What would you like to build...";
      } else {
        return "Ask KronosCode anything...";
      }
    }, [isChatEmpty, model.inBuilder]);

    // Mock model options - replace with actual models from your system
    const models: ModelOption[] = useMemo(
      () => [
        {
          id: "kronoscode-default",
          name: "KronosCode",
          description: "Default agent",
          badge: "Active",
        },
        {
          id: "kronoscode-expert",
          name: "KronosCode Expert",
          description: "Advanced mode",
        },
      ],
      []
    );

    // Handle sending message with files and pasted content
    const handleSendMessage = useCallback(
      async (message: string, files: FileWithPreview[], pastedContent: PastedContent[]) => {
        // Add files to model
        for (const file of files) {
          try {
            await model.addFile(file.file);
          } catch (error) {
            console.error(`Failed to add file ${file.file.name}:`, error);
            model.setError(`Failed to add file: ${file.file.name}`);
          }
        }

        // Update input with message
        setInput(message);

        // Call custom submit handler if provided
        if (onSubmit) {
          onSubmit(message, files, pastedContent);
        }

        // Clear input after submission
        setInput("");
      },
      [model, setInput, onSubmit]
    );

    // Handle focus management
    const handleInputFocus = useCallback(() => {
      model.requestWaveAIFocus();
    }, [model]);

    const handleInputBlur = useCallback(() => {
      // Could add additional blur logic here
    }, []);

    // Handle model change
    const handleModelChange = useCallback(
      (modelId: string) => {
        // Update model selection in your system
        console.log("Model changed to:", modelId);
        // This could call model.setSelectedModel(modelId) if available
      },
      []
    );

    return (
      <div
        className={`improved-ai-panel-input ${isFocused ? "is-focused" : ""}`}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
      >
        <ImprovedChatInput
          onSendMessage={handleSendMessage}
          disabled={disabled}
          placeholder={placeholder}
          maxFiles={10}
          maxFileSize={50 * 1024 * 1024} // 50MB
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
            ".java",
            ".c",
            ".cpp",
            ".h",
            ".hpp",
            ".html",
            ".css",
            ".scss",
            ".sass",
            ".json",
            ".xml",
            ".yaml",
            ".yml",
            ".sh",
            ".bat",
            ".sql",
          ]}
          models={models}
          defaultModel="kronoscode-default"
          onModelChange={handleModelChange}
        />
      </div>
    );
  }
);

ImprovedAIPanelInput.displayName = "ImprovedAIPanelInput";

// ─── Alternative: Hook-based integration ────────────────────────────────────

/**
 * Hook to use ImprovedChatInput with WaveAIModel
 * Useful for more complex integrations or multiple chat instances
 */
export function useImprovedChatInput(model: WaveAIModel) {
  const [input, setInput] = useAtom(model.inputAtom);
  const isFocused = useAtomValue(model.isWaveAIFocusedAtom);
  const isChatEmpty = useAtomValue(model.isChatEmptyAtom);

  const handleSendMessage = useCallback(
    async (message: string, files: FileWithPreview[], pastedContent: PastedContent[]) => {
      // Handle files
      for (const file of files) {
        await model.addFile(file.file);
      }

      // Update input
      setInput(message);

      // Your custom logic here
      console.log({
        message,
        fileCount: files.length,
        pastedCount: pastedContent.length,
      });

      // Clear input
      setInput("");
    },
    [model, setInput]
  );

  return {
    input,
    setInput,
    isFocused,
    isChatEmpty,
    handleSendMessage,
  };
}

// ─── Usage Example ───────────────────────────────────────────────────────────

/**
 * Example of how to use the adapter in AcpChatPanel or similar:
 *
 * In your chat panel component:
 *
 * ```tsx
 * import { ImprovedAIPanelInput } from "@/app/aipanel/improved-aipanel-input";
 *
 * export const MyAiPanel = () => {
 *   const model = useMyAiModel(); // Your model instance
 *
 *   const handleSubmit = (message, files, pastedContent) => {
 *     // Send to AI backend
 *     model.sendMessage(message, {
 *       files: files.map(f => f.id),
 *       pastedContent,
 *     });
 *   };
 *
 *   return (
 *     <div className="ai-panel">
 *       <ChatMessageList messages={messages} />
 *       <ImprovedAIPanelInput
 *         model={model}
 *         onSubmit={handleSubmit}
 *         disabled={isLoading}
 *       />
 *     </div>
 *   );
 * };
 * ```
 */

// ─── CSS for the adapter ─────────────────────────────────────────────────────

/**
 * Add this to your stylesheet:
 *
 * .improved-ai-panel-input {
 *   width: 100%;
 *   display: flex;
 *   flex-direction: column;
 * }
 *
 * .improved-ai-panel-input.is-focused {
 *   // Optional focus styling
 * }
 */

export {};
