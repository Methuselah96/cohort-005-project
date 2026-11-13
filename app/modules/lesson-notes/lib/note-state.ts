import { MAX_NOTE_LENGTH } from "~/lib/notes";

export type SavedNote = { body: string; updatedAt: string };

export type NoteStatus =
  | { kind: "saving" }
  | { kind: "too-long"; overBy: number }
  | { kind: "error"; message: string }
  | { kind: "unsaved" }
  | { kind: "saved"; updatedAt: string }
  | { kind: "blank" };

export type NoteState = {
  status: NoteStatus;
  canSave: boolean;
  /** Shown only once the draft gets close enough to the limit to matter. */
  remaining: number | null;
};

const WARN_WITHIN = 200;

export function noteState({
  saved,
  draft,
  isSaving,
  error,
}: {
  saved: SavedNote | null;
  draft: string;
  isSaving: boolean;
  error?: string;
}): NoteState {
  const remaining = MAX_NOTE_LENGTH - draft.length;
  const status = statusOf({ saved, draft, isSaving, error, remaining });

  return {
    status,
    canSave: status.kind === "unsaved" || status.kind === "error",
    remaining: remaining <= WARN_WITHIN ? remaining : null,
  };
}

function statusOf({
  saved,
  draft,
  isSaving,
  error,
  remaining,
}: {
  saved: SavedNote | null;
  draft: string;
  isSaving: boolean;
  error?: string;
  remaining: number;
}): NoteStatus {
  if (isSaving) return { kind: "saving" };
  if (remaining < 0) return { kind: "too-long", overBy: -remaining };
  if (draft.trim() === "") return { kind: "blank" };

  if (!saved || draft !== saved.body) {
    return error ? { kind: "error", message: error } : { kind: "unsaved" };
  }
  return { kind: "saved", updatedAt: saved.updatedAt };
}
