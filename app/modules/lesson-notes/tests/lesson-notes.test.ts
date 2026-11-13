import { describe, expect, it } from "vitest";
import { describeLessonNote } from "~/modules/lesson-notes";
import { MAX_NOTE_LENGTH } from "~/lib/notes";

const saved = {
  body: "Result types beat throwing.",
  updatedAt: "2026-11-13T10:00:00Z",
};

describe("describeLessonNote", () => {
  it("is blank, with nothing to save, before the Student writes", () => {
    const state = describeLessonNote({
      saved: null,
      draft: "",
      isSaving: false,
    });
    expect(state.status).toEqual({ kind: "blank" });
    expect(state.canSave).toBe(false);
  });

  it("treats whitespace as blank", () => {
    const state = describeLessonNote({
      saved: null,
      draft: "  \n ",
      isSaving: false,
    });
    expect(state.status).toEqual({ kind: "blank" });
    expect(state.canSave).toBe(false);
  });

  it("has unsaved changes once the Student types a first note", () => {
    const state = describeLessonNote({
      saved: null,
      draft: "x",
      isSaving: false,
    });
    expect(state.status).toEqual({ kind: "unsaved" });
    expect(state.canSave).toBe(true);
  });

  it("is saved, with nothing to save, when the draft matches the saved note", () => {
    const state = describeLessonNote({
      saved,
      draft: saved.body,
      isSaving: false,
    });
    expect(state.status).toEqual({ kind: "saved", updatedAt: saved.updatedAt });
    expect(state.canSave).toBe(false);
  });

  it("has unsaved changes when the draft differs from the saved note", () => {
    const state = describeLessonNote({
      saved,
      draft: `${saved.body}!`,
      isSaving: false,
    });
    expect(state.status).toEqual({ kind: "unsaved" });
    expect(state.canSave).toBe(true);
  });

  it("cannot save again while a save is in flight", () => {
    const state = describeLessonNote({ saved, draft: "new", isSaving: true });
    expect(state.status).toEqual({ kind: "saving" });
    expect(state.canSave).toBe(false);
  });

  it("shows the server's error and lets the Student retry", () => {
    const state = describeLessonNote({
      saved,
      draft: "new",
      isSaving: false,
      error: "Something went wrong",
    });
    expect(state.status).toEqual({
      kind: "error",
      message: "Something went wrong",
    });
    expect(state.canSave).toBe(true);
  });

  it("drops a stale error once the draft matches the saved note", () => {
    const state = describeLessonNote({
      saved,
      draft: saved.body,
      isSaving: false,
      error: "Something went wrong",
    });
    expect(state.status.kind).toBe("saved");
  });

  it("refuses a draft over the limit and says by how much", () => {
    const state = describeLessonNote({
      saved: null,
      draft: "a".repeat(MAX_NOTE_LENGTH + 3),
      isSaving: false,
    });
    expect(state.status).toEqual({ kind: "too-long", overBy: 3 });
    expect(state.canSave).toBe(false);
    expect(state.remaining).toBe(-3);
  });

  it("allows a draft exactly at the limit", () => {
    const state = describeLessonNote({
      saved: null,
      draft: "a".repeat(MAX_NOTE_LENGTH),
      isSaving: false,
    });
    expect(state.status).toEqual({ kind: "unsaved" });
    expect(state.remaining).toBe(0);
  });

  it("counts remaining characters only near the limit", () => {
    const far = describeLessonNote({
      saved: null,
      draft: "a".repeat(MAX_NOTE_LENGTH - 201),
      isSaving: false,
    });
    const near = describeLessonNote({
      saved: null,
      draft: "a".repeat(MAX_NOTE_LENGTH - 200),
      isSaving: false,
    });
    expect(far.remaining).toBeNull();
    expect(near.remaining).toBe(200);
  });
});
