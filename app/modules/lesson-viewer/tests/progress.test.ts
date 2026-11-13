import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { LessonProgressStatus } from "~/db/schema";
import { useTestDb } from "./test-db";

vi.mock("~/db", () => import("./test-db"));

const { getLessonProgress, markLessonComplete, markLessonInProgress } =
  await import("../index.server");

const NOW = new Date("2026-11-13T10:00:00.000Z");

let studentId: number;
let lessonId: number;

beforeEach(() => {
  const db: TestDb = createTestDb();
  useTestDb(db);
  const base = seedBaseData(db);
  studentId = base.user.id;
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

describe("lesson progress", () => {
  it("completes a lesson the Student never opened, at the given time", () => {
    markLessonComplete(studentId, lessonId, NOW);
    expect(getLessonProgress(studentId, lessonId)).toMatchObject({
      status: LessonProgressStatus.Completed,
      completedAt: NOW.toISOString(),
    });
  });

  it("completes a lesson in progress, at the given time", () => {
    markLessonInProgress(studentId, lessonId);
    markLessonComplete(studentId, lessonId, NOW);
    expect(getLessonProgress(studentId, lessonId)).toMatchObject({
      status: LessonProgressStatus.Completed,
      completedAt: NOW.toISOString(),
    });
  });

  it("keeps a completed lesson completed when it is viewed again", () => {
    markLessonComplete(studentId, lessonId, NOW);
    markLessonInProgress(studentId, lessonId);
    expect(getLessonProgress(studentId, lessonId)?.status).toBe(
      LessonProgressStatus.Completed
    );
  });
});
