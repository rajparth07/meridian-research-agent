"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface LlmSettings {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export const PRESETS: Array<{ name: string; baseUrl: string; model: string }> = [
  { name: "OpenAI", baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  {
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
  },
  {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    model: "openai/gpt-4o-mini",
  },
  { name: "Ollama", baseUrl: "http://127.0.0.1:11434/v1", model: "llama3.1" },
];

export function SettingsDialog({
  open,
  onOpenChange,
  value,
  serverKey,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: LlmSettings;
  serverKey: boolean;
  onSave: (value: LlmSettings) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <SettingsForm
            key={`${value.apiKey}:${value.baseUrl}:${value.model}`}
            value={value}
            serverKey={serverKey}
            onSave={onSave}
            onOpenChange={onOpenChange}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function SettingsForm({
  value,
  serverKey,
  onSave,
  onOpenChange,
}: {
  value: LlmSettings;
  serverKey: boolean;
  onSave: (value: LlmSettings) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [draft, setDraft] = useState(value);
  const localModel = /localhost|127\.0\.0\.1|11434/.test(draft.baseUrl);

  return (
    <form
      className="contents"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          apiKey: draft.apiKey.trim(),
          baseUrl: draft.baseUrl.trim(),
          model: draft.model.trim(),
        });
        onOpenChange(false);
      }}
    >
        <DialogHeader>
          <DialogTitle>Model connection</DialogTitle>
          <DialogDescription>
            Meridian sends the question, source text, and its own notes to this
            model. The brief is whatever the model writes from those sources.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <Button
                key={preset.name}
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    baseUrl: preset.baseUrl,
                    model: preset.model,
                  }))
                }
              >
                {preset.name}
              </Button>
            ))}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="llm-base">Base URL</Label>
            <Input
              id="llm-base"
              value={draft.baseUrl}
              placeholder="https://api.openai.com/v1"
              onChange={(event) =>
                setDraft((current) => ({ ...current, baseUrl: event.target.value }))
              }
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="llm-model">Model</Label>
            <Input
              id="llm-model"
              value={draft.model}
              placeholder="gpt-4o-mini"
              onChange={(event) =>
                setDraft((current) => ({ ...current, model: event.target.value }))
              }
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="llm-key">API key</Label>
            <Input
              id="llm-key"
              type="password"
              autoComplete="off"
              value={draft.apiKey}
              placeholder={serverKey ? "Using the server key if left blank" : "sk-..."}
              onChange={(event) =>
                setDraft((current) => ({ ...current, apiKey: event.target.value }))
              }
            />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {localModel
              ? "A local server such as Ollama accepts any non-empty key. You can type ollama."
              : "The key stays in this browser. It is sent only to this app, then to the model provider. It is not written into research memory."}
            {serverKey ? " A key is also configured on the server." : ""}
          </p>
        </div>
        <DialogFooter>
          <Button type="submit">Save connection</Button>
        </DialogFooter>
    </form>
  );
}
