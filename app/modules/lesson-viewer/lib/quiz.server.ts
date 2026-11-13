import { db } from "~/db";
import {
  quizzes,
  quizQuestions,
  quizOptions,
  quizAttempts,
  quizAnswers,
} from "~/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";

export function getQuizById(quizId: number) {
  return db.select().from(quizzes).where(eq(quizzes.id, quizId)).get();
}

export function getQuizByLessonId(lessonId: number) {
  return db.select().from(quizzes).where(eq(quizzes.lessonId, lessonId)).get();
}

function getQuestions(quizId: number) {
  return db
    .select()
    .from(quizQuestions)
    .where(eq(quizQuestions.quizId, quizId))
    .orderBy(quizQuestions.position)
    .all();
}

type Question = ReturnType<typeof getQuestions>[number];
type Option = typeof quizOptions.$inferSelect;

function getOptionsByQuestion(questions: Question[]) {
  const options = db
    .select()
    .from(quizOptions)
    .where(
      inArray(
        quizOptions.questionId,
        questions.map((question) => question.id)
      )
    )
    .orderBy(quizOptions.id)
    .all();

  const byQuestion = new Map<number, Option[]>();
  for (const option of options) {
    const list = byQuestion.get(option.questionId) ?? [];
    list.push(option);
    byQuestion.set(option.questionId, list);
  }
  return byQuestion;
}

export function getQuizWithQuestions(quizId: number) {
  const quiz = getQuizById(quizId);
  if (!quiz) return null;

  const questions = getQuestions(quizId);
  const options = getOptionsByQuestion(questions);
  return {
    ...quiz,
    questions: questions.map((question) => ({
      ...question,
      options: options.get(question.id) ?? [],
    })),
  };
}

export function getBestAttempt(userId: number, quizId: number) {
  return db
    .select()
    .from(quizAttempts)
    .where(
      and(eq(quizAttempts.userId, userId), eq(quizAttempts.quizId, quizId))
    )
    .orderBy(desc(quizAttempts.score))
    .limit(1)
    .get();
}

export function calculateGrade(score: number): string {
  if (score >= 0.9) return "A";
  if (score >= 0.8) return "B";
  if (score >= 0.7) return "C";
  if (score >= 0.6) return "D";
  return "F";
}

export type QuestionResult = {
  questionId: number;
  correct: boolean;
  selectedOptionId: number | null;
  correctOptionId: number | null;
};

function gradeQuestion(
  question: Question,
  options: Option[],
  selected: number | undefined
): QuestionResult {
  if (!selected) {
    return {
      questionId: question.id,
      correct: false,
      selectedOptionId: null,
      correctOptionId: null,
    };
  }
  const correctOptionId =
    options.find((option) => option.isCorrect)?.id ?? null;
  return {
    questionId: question.id,
    correct: selected === correctOptionId,
    selectedOptionId: selected,
    correctOptionId,
  };
}

function recordAttempt(input: {
  userId: number;
  quizId: number;
  score: number;
  passed: boolean;
  questionResults: QuestionResult[];
}) {
  const { userId, quizId, score, passed, questionResults } = input;
  return db.transaction((tx) => {
    const attempt = tx
      .insert(quizAttempts)
      .values({ userId, quizId, score, passed })
      .returning()
      .get();

    for (const result of questionResults) {
      if (result.selectedOptionId === null) continue;
      tx.insert(quizAnswers)
        .values({
          attemptId: attempt.id,
          questionId: result.questionId,
          selectedOptionId: result.selectedOptionId,
        })
        .run();
    }
    return attempt;
  });
}

export function computeResult(
  userId: number,
  quizId: number,
  selectedAnswers: Record<number, number>
) {
  try {
    if (!getQuizById(quizId)) {
      console.error("quiz not found");
      return null;
    }

    const questions = getQuestions(quizId);
    const options = getOptionsByQuestion(questions);
    const questionResults = questions.map((question) =>
      gradeQuestion(
        question,
        options.get(question.id) ?? [],
        selectedAnswers[question.id]
      )
    );

    const totalCorrect = questionResults.filter((r) => r.correct).length;
    const total = questions.length;
    const score = total > 0 ? totalCorrect / total : 0;
    const passed = score > 0.7;
    const attempt = recordAttempt({
      userId,
      quizId,
      score,
      passed,
      questionResults,
    });

    return {
      attemptId: attempt.id,
      score,
      passed,
      grade: calculateGrade(score),
      totalCorrect,
      totalQuestions: total,
      questionResults,
    };
  } catch (error) {
    console.error(error);
    return null;
  }
}
