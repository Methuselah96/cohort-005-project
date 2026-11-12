import { describe, it, expect, beforeEach } from "vitest";
import { createTestDb, seedBaseData } from "~/test/setup";
import * as schema from "~/db/schema";
import { UserRole } from "~/db/schema";
import { getNote, listNotesForStudent, saveNote } from "./notes.server";

type TestDb = ReturnType<typeof createTestDb>;

const NOW = new Date(2026, 9, 6, 12, 0, 0);

function minutesAfter(minutes: number) {
  return new Date(NOW.getTime() + minutes * 60_000);
}

let db: TestDb;
let base: ReturnType<typeof seedBaseData>;
let lessonIds: number[];

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);

  const module = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();

  lessonIds = [1, 2].map(
    (position) =>
      db
        .insert(schema.lessons)
        .values({ moduleId: module.id, title: `Lesson ${position}`, position })
        .returning()
        .get().id
  );
});

describe("saving a Note", () => {
  it("creates a Note with the body trimmed", () => {
    saveNote(db, base.user.id, lessonIds[0], "  # not a heading *  ", NOW);

    expect(getNote(db, base.user.id, lessonIds[0])).toEqual({
      body: "# not a heading *",
      updatedAt: NOW.toISOString(),
    });
  });

  it("replaces the body and moves the last-edited time on when saved again", () => {
    saveNote(db, base.user.id, lessonIds[0], "First thought", NOW);
    const later = minutesAfter(30);

    const result = saveNote(
      db,
      base.user.id,
      lessonIds[0],
      "Second thought",
      later
    );

    expect(result).toMatchObject({
      ok: true,
      note: {
        body: "Second thought",
        createdAt: NOW.toISOString(),
        updatedAt: later.toISOString(),
      },
    });
    expect(listNotesForStudent(db, base.user.id)).toHaveLength(1);
  });

  it("accepts a Note of exactly 2,000 characters", () => {
    expect(
      saveNote(db, base.user.id, lessonIds[0], "a".repeat(2000), NOW)
    ).toMatchObject({ ok: true });
  });

  it("refuses a Note over 2,000 characters, without saving it", () => {
    expect(
      saveNote(db, base.user.id, lessonIds[0], "a".repeat(2001), NOW)
    ).toEqual({ ok: false, error: "A note must be 2000 characters or fewer." });
    expect(getNote(db, base.user.id, lessonIds[0])).toBeUndefined();
  });

  it("removes the Note when saved empty", () => {
    saveNote(db, base.user.id, lessonIds[0], "Something", NOW);

    saveNote(db, base.user.id, lessonIds[0], "   ", minutesAfter(1));

    expect(getNote(db, base.user.id, lessonIds[0])).toBeUndefined();
  });

  it("never leaves a Student with two Notes on one Lesson", () => {
    saveNote(db, base.user.id, lessonIds[0], "Mine", NOW);

    expect(() =>
      db
        .insert(schema.notes)
        .values({ userId: base.user.id, lessonId: lessonIds[0], body: "Dupe" })
        .run()
    ).toThrow(/UNIQUE/);
  });
});

describe("listing a Student's Notes", () => {
  it("lists only that Student's Notes, most recently edited first, with Lesson and Course", () => {
    const other = db
      .insert(schema.users)
      .values({
        name: "Other",
        email: "other@example.com",
        role: UserRole.Student,
      })
      .returning()
      .get();
    saveNote(db, base.user.id, lessonIds[0], "On lesson 1", NOW);
    saveNote(db, base.user.id, lessonIds[1], "On lesson 2", minutesAfter(5));
    saveNote(db, other.id, lessonIds[0], "Someone else's", minutesAfter(10));
    saveNote(
      db,
      base.user.id,
      lessonIds[0],
      "On lesson 1, edited",
      minutesAfter(15)
    );

    expect(listNotesForStudent(db, base.user.id)).toMatchObject([
      {
        lessonId: lessonIds[0],
        body: "On lesson 1, edited",
        lessonTitle: "Lesson 1",
        courseTitle: "Test Course",
        courseSlug: "test-course",
      },
      { lessonId: lessonIds[1], body: "On lesson 2" },
    ]);
  });
});
