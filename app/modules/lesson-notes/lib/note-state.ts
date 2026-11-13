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
  // The server trims the body before it checks the length and stores it, so
  // compare and count what will be stored, not what is in the textarea.
  const body = draft.trim();
  const remaining = MAX_NOTE_LENGTH - body.length;
  const status = statusOf({ saved, body, isSaving, error, remaining });

  return {
    status,
    canSave: status.kind === "unsaved" || status.kind === "error",
    remaining: remaining <= WARN_WITHIN ? remaining : null,
  };
}

function statusOf({
  saved,
  body,
  isSaving,
  error,
  remaining,
}: {
  saved: SavedNote | null;
  body: string;
  isSaving: boolean;
  error?: string;
  remaining: number;
}): NoteStatus {
  if (isSaving) return { kind: "saving" };
  if (remaining < 0) return { kind: "too-long", overBy: -remaining };
  if (body === "") return { kind: "blank" };

  if (!saved || body !== saved.body) {
    return error ? { kind: "error", message: error } : { kind: "unsaved" };
  }
  return { kind: "saved", updatedAt: saved.updatedAt };
}
