import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { markdown } from "~/lib/text";
import { useTestDb } from "./test-db";

vi.mock("~/db", () => import("./test-db"));

const { getLessonThread } = await import("../index.server");

let db: TestDb;
let lessonId: number;
let studentId: number;
let instructorId: number;

// Writing a comment goes through notifications; the thread only reads rows.
function addComment(
  authorId: number,
  parentId: number | null = null,
  deletedAt: string | null = null
) {
  return db
    .insert(schema.comments)
    .values({
      lessonId,
      userId: authorId,
      parentId,
      body: markdown(`by ${authorId}`),
      deletedAt,
    })
    .returning()
    .get().id;
}

beforeEach(() => {
  db = createTestDb();
  useTestDb(db);
  const base = seedBaseData(db);
  studentId = base.user.id;
  instructorId = base.instructor.id;
  const module = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "M", position: 1 })
    .returning()
    .get();
  lessonId = db
    .insert(schema.lessons)
    .values({ moduleId: module.id, title: "L", position: 1 })
    .returning()
    .get().id;
});

describe("getLessonThread", () => {
  it("nests replies under their question and marks the instructor", () => {
    const question = addComment(studentId);
    const answer = addComment(instructorId, question);

    const thread = getLessonThread(lessonId);

    expect(thread).toHaveLength(1);
    expect(thread[0]).toMatchObject({
      id: question,
      body: `by ${studentId}`,
      author: { id: studentId, isInstructor: false },
    });
    expect(thread[0].replies).toMatchObject([
      { id: answer, author: { id: instructorId, isInstructor: true } },
    ]);
  });

  it("blanks a deleted question that still has replies", () => {
    const question = addComment(studentId, null, "2026-11-13T10:00:00Z");
    addComment(instructorId, question);

    expect(getLessonThread(lessonId)).toMatchObject([
      { id: question, deleted: true, body: "", editedAt: null },
    ]);
  });

  it("hides a deleted question once it has no replies left", () => {
    const question = addComment(studentId, null, "2026-11-13T10:00:00Z");
    addComment(instructorId, question, "2026-11-13T11:00:00Z");

    expect(getLessonThread(lessonId)).toEqual([]);
  });

  it("is empty for an unknown lesson", () => {
    expect(getLessonThread(lessonId + 1)).toEqual([]);
  });
});
