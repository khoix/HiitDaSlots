import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { playSound } from "../audio/playSfx";
import { SOUNDS } from "../audio/soundManifest";

interface Props {
  open: boolean;
  title: string;
  hint?: string;
  initialName?: string;
  confirmLabel?: string;
  onConfirm: (name: string) => void;
  onClose: () => void;
}

export default function SaveWorkoutNameModal({
  open,
  title,
  hint,
  initialName = "",
  confirmLabel = "Save",
  onConfirm,
  onClose,
}: Props) {
  const [name, setName] = useState(initialName);

  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const t = name.trim();
    if (!t) return;
    playSound(SOUNDS.uiConfirm);
    onConfirm(t);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-workout-name-title"
    >
      <div className="arcade-card rounded-xl p-6 w-full max-w-md border border-primary/30 shadow-[0_0_30px_hsl(var(--primary)/0.2)]">
        <div className="flex justify-between items-start gap-4 mb-4">
          <h2
            id="save-workout-name-title"
            className="text-xl font-display uppercase neon-text-primary tracking-wide"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={() => {
              playSound(SOUNDS.uiCancel);
              onClose();
            }}
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label="Close"
          >
            <X size={22} />
          </button>
        </div>
        {hint ? (
          <p className="text-sm text-muted-foreground font-sans mb-4">{hint}</p>
        ) : null}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="workout-save-name"
              className="text-xs uppercase font-display text-muted-foreground tracking-widest block mb-2"
            >
              Name
            </label>
            <input
              id="workout-save-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-sans text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              placeholder="e.g. Morning legs"
              autoFocus
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={() => {
                playSound(SOUNDS.uiCancel);
                onClose();
              }}
              className="px-4 py-2 rounded-lg text-muted-foreground hover:text-foreground font-display uppercase text-xs tracking-widest"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="arcade-btn-primary px-6 py-2 rounded-lg text-sm disabled:opacity-40"
            >
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
