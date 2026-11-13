import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { QuestionType } from "~/db/schema";
import { markdown } from "~/lib/text";
import { useTestDb } from "./test-db";

vi.mock("~/db", () => import("./test-db"));

const { computeResult, getQuizWithQuestions } = await import("../index.server");

let db: TestDb;
let studentId: number;
let quizId: number;
let mc: { id: number; right: number; wrong: number };
let tf: { id: number; right: number; wrong: number };

// The module has no way to author a quiz, so these rows go in directly.
function addQuestion(position: number, questionType: QuestionType) {
  const question = db
    .insert(schema.quizQuestions)
    .values({ quizId, questionText: `Q${position}`, questionType, position })
    .returning()
    .get();
  const option = (isCorrect: boolean) =>
    db
      .insert(schema.quizOptions)
      .values({
        questionId: question.id,
        optionText: String(isCorrect),
        isCorrect,
      })
      .returning()
      .get().id;
  const wrong = option(false);
  const right = option(true);
  return { id: question.id, right, wrong };
}

beforeEach(() => {
  db = createTestDb();
  useTestDb(db);
  const base = seedBaseData(db);
  studentId = base.user.id;
  const module = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "M", position: 1 })
    .returning()
    .get();
  const lesson = db
    .insert(schema.lessons)
    .values({
      moduleId: module.id,
      title: "L",
      content: markdown(""),
      position: 1,
    })
    .returning()
    .get();
  quizId = db
    .insert(schema.quizzes)
    .values({ lessonId: lesson.id, title: "Quiz", passingScore: 0.7 })
    .returning()
    .get().id;
  tf = addQuestion(2, QuestionType.TrueFalse);
  mc = addQuestion(1, QuestionType.MultipleChoice);
});

describe("getQuizWithQuestions", () => {
  it("returns the questions in position order, each with its options", () => {
    const quiz = getQuizWithQuestions(quizId);
    expect(quiz?.questions.map((q) => q.id)).toEqual([mc.id, tf.id]);
    expect(quiz?.questions[0].options.map((o) => o.id)).toEqual([
      mc.wrong,
      mc.right,
    ]);
    expect(quiz?.questions[1].options.map((o) => o.id)).toEqual([
      tf.wrong,
      tf.right,
    ]);
  });

  it("returns null for an unknown quiz", () => {
    expect(getQuizWithQuestions(quizId + 1)).toBeNull();
  });
});

describe("computeResult", () => {
  it("scores every question right as a passing A", () => {
    const result = computeResult(studentId, quizId, {
      [mc.id]: mc.right,
      [tf.id]: tf.right,
    });
    expect(result).toMatchObject({
      score: 1,
      passed: true,
      grade: "A",
      totalCorrect: 2,
      totalQuestions: 2,
    });
    expect(result?.questionResults).toEqual([
      {
        questionId: mc.id,
        correct: true,
        selectedOptionId: mc.right,
        correctOptionId: mc.right,
      },
      {
        questionId: tf.id,
        correct: true,
        selectedOptionId: tf.right,
        correctOptionId: tf.right,
      },
    ]);
  });

  it("marks an unanswered question wrong without revealing its answer", () => {
    const result = computeResult(studentId, quizId, { [tf.id]: tf.wrong });
    expect(result).toMatchObject({
      score: 0,
      passed: false,
      grade: "F",
      totalCorrect: 0,
    });
    expect(result?.questionResults).toEqual([
      {
        questionId: mc.id,
        correct: false,
        selectedOptionId: null,
        correctOptionId: null,
      },
      {
        questionId: tf.id,
        correct: false,
        selectedOptionId: tf.wrong,
        correctOptionId: tf.right,
      },
    ]);
  });

  it("does not pass at exactly 70%", () => {
    const ids = [3, 4, 5, 6, 7, 8, 9, 10].map((position) =>
      addQuestion(position, QuestionType.TrueFalse)
    );
    const answers = Object.fromEntries(
      [mc, tf, ...ids].map((q, i) => [q.id, i < 7 ? q.right : q.wrong])
    );
    const result = computeResult(studentId, quizId, answers);
    expect(result).toMatchObject({ score: 0.7, passed: false, grade: "C" });
  });

  it("records the attempt and only the answered questions", () => {
    const result = computeResult(studentId, quizId, { [mc.id]: mc.right });
    const attempts = db.select().from(schema.quizAttempts).all();
    expect(attempts).toMatchObject([
      { id: result?.attemptId, userId: studentId, quizId, score: 0.5 },
    ]);
    expect(db.select().from(schema.quizAnswers).all()).toMatchObject([
      {
        attemptId: result?.attemptId,
        questionId: mc.id,
        selectedOptionId: mc.right,
      },
    ]);
  });

  it("scores a quiz with no questions as zero", () => {
    const empty = db
      .insert(schema.quizzes)
      .values({ lessonId: 1, title: "Empty", passingScore: 0.7 })
      .returning()
      .get();
    expect(getQuizWithQuestions(empty.id)?.questions).toEqual([]);
    expect(computeResult(studentId, empty.id, {})).toMatchObject({
      score: 0,
      passed: false,
      totalQuestions: 0,
    });
  });

  it("returns null for an unknown quiz and records nothing", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(computeResult(studentId, quizId + 1, {})).toBeNull();
    expect(db.select().from(schema.quizAttempts).all()).toEqual([]);
  });
});
