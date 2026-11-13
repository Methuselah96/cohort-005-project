import { noteState, type NoteState, type SavedNote } from "./lib/note-state";

export type { NoteState, NoteStatus, SavedNote } from "./lib/note-state";

/**
 * What the lesson's note editor should say and allow, given what is saved,
 * what the Student has typed, and how the last save went.
 */
export function describeLessonNote(input: {
  saved: SavedNote | null;
  draft: string;
  isSaving: boolean;
  error?: string;
}): NoteState {
  return noteState(input);
}
