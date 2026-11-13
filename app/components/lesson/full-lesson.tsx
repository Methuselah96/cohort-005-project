import { useCallback, useEffect, useState } from "react";
import { Link, useFetcher, useNavigate } from "react-router";
import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Github,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent } from "~/components/ui/card";
import { CommentThread } from "~/components/comment-thread";
import { YouTubePlayer } from "~/components/youtube-player";
import { LessonProgressStatus } from "~/db/schema";
import { cn, formatDuration } from "~/lib/utils";
import { CurriculumSidebar } from "./curriculum-sidebar";
import { LessonBreadcrumb } from "./lesson-breadcrumb";
import { LessonNote } from "./lesson-note";
import { QuizSection } from "./quiz-section";
import type { Route } from "../../routes/+types/courses.$slug.lessons.$lessonId";

type LessonLoaderData = Route.ComponentProps["loaderData"];

const AUTOPLAY_KEY = "cadence-autoplay";

function useAutoplay() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    try {
      setEnabled(localStorage.getItem(AUTOPLAY_KEY) === "true");
    } catch {
      /* silently fail */
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(AUTOPLAY_KEY, String(next));
      } catch {
        /* silently fail */
      }
      return next;
    });
  }, []);

  return [enabled, toggle] as const;
}

type FullLessonData = Extract<LessonLoaderData, { view: "full" }>;
type NavLesson = FullLessonData["nextLesson"];

export function FullLesson({ data }: { data: FullLessonData }) {
  const {
    course,
    curriculum,
    module: mod,
    lesson,
    enrolled,
    currentUserId,
    lessonProgressMap,
  } = data;

  return (
    <div className="flex">
      <CurriculumSidebar
        course={course}
        curriculum={curriculum}
        currentLessonId={lesson.id}
        lessonProgressMap={lessonProgressMap}
        enrolled={enrolled}
      />

      <div className="flex-1 p-6 lg:p-8">
        <LessonBreadcrumb
          course={course}
          mod={mod}
          lessonTitle={lesson.title}
        />

        <div className="mx-auto max-w-4xl">
          <LessonHeader
            lesson={lesson}
            bookmarked={currentUserId ? data.bookmarked : null}
          />
          <LessonBody data={data} />

          <LessonActivities data={data} />

          <LessonResponses data={data} />

          <LessonPager
            course={course}
            prevLesson={data.prevLesson}
            nextLesson={data.nextLesson}
          />
        </div>
      </div>
    </div>
  );
}

/** Notes and Questions & Discussion share one panel: both are where the
 * Student responds to the lesson. Both are confidential. */
function LessonResponses({ data }: { data: FullLessonData }) {
  return (
    <Card className="mb-8">
      <CardContent className="space-y-8">
        {data.currentUserId && (
          <>
            <LessonNote key={data.lesson.id} note={data.note} />
            <hr />
          </>
        )}
        <CommentThread
          comments={data.comments}
          currentUserId={data.currentUserId}
          canModerate={data.canModerate}
          canPost
          instructorName={data.instructorName}
        />
      </CardContent>
    </Card>
  );
}

/** The quiz and the completion controls, for an enrolled Student only. */
function LessonActivities({ data }: { data: FullLessonData }) {
  const { course, lesson, quiz } = data;
  if (!data.enrolled || !data.currentUserId) return null;

  return (
    <>
      {quiz && (
        <LessonQuiz
          lessonId={lesson.id}
          quiz={quiz}
          bestAttempt={data.bestAttempt}
        />
      )}
      <CompletionControls
        courseSlug={course.slug}
        lessonId={lesson.id}
        lessonStatus={data.lessonStatus}
        nextLesson={data.nextLesson}
      />
    </>
  );
}

function LessonQuiz({
  lessonId,
  quiz,
  bestAttempt,
}: {
  lessonId: number;
  quiz: NonNullable<FullLessonData["quiz"]>;
  bestAttempt: FullLessonData["bestAttempt"];
}) {
  const quizFetcher = useFetcher({ key: `quiz-${lessonId}` });
  return (
    <QuizSection
      quiz={quiz}
      bestAttempt={bestAttempt}
      quizResult={quizFetcher.data?.quizResult ?? null}
      quizFetcher={quizFetcher}
      isSubmitting={quizFetcher.state !== "idle"}
    />
  );
}

function LessonHeader({
  lesson,
  bookmarked,
}: {
  lesson: FullLessonData["lesson"];
  /** Null when nobody is signed in, so there is nothing to bookmark. */
  bookmarked: boolean | null;
}) {
  return (
    <>
      <div className="mb-2 flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold">{lesson.title}</h1>
        {bookmarked !== null && <BookmarkToggle bookmarked={bookmarked} />}
      </div>
      <div className="mb-6 flex items-center gap-3">
        {lesson.durationMinutes && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="size-4" />
            {formatDuration(lesson.durationMinutes, true, false, false)}
          </div>
        )}
        {lesson.githubRepoUrl && (
          <a
            href={lesson.githubRepoUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="outline" size="sm">
              <Github className="mr-1.5 size-4" />
              Open Code
            </Button>
          </a>
        )}
      </div>
    </>
  );
}

function LessonBody({ data }: { data: FullLessonData }) {
  const { lesson, contentHtml, enrolled, currentUserId } = data;
  const [autoplay, toggleAutoplay] = useAutoplay();

  return (
    <>
      {lesson.videoUrl && (
        <YouTubePlayer
          videoUrl={lesson.videoUrl}
          lessonId={lesson.id}
          title={lesson.title}
          startPosition={data.lastWatchPosition}
          durationMinutes={lesson.durationMinutes}
          watchProgress={data.watchProgress}
          trackingEnabled={enrolled && !!currentUserId}
          autoplay={autoplay}
          onToggleAutoplay={toggleAutoplay}
        />
      )}

      {contentHtml && (
        <div
          className="prose prose-neutral dark:prose-invert mb-8 max-w-none"
          // oxlint-disable-next-line react/no-danger -- the instructor wrote this Markdown
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />
      )}

      {!contentHtml && !lesson.videoUrl && (
        <Card className="mb-8">
          <CardContent className="py-12 text-center text-muted-foreground">
            No content has been added to this lesson yet.
          </CardContent>
        </Card>
      )}
    </>
  );
}

function CompletionControls({
  courseSlug,
  lessonId,
  lessonStatus,
  nextLesson,
}: {
  courseSlug: string;
  lessonId: number;
  lessonStatus: FullLessonData["lessonStatus"];
  nextLesson: NavLesson;
}) {
  const fetcher = useFetcher({ key: `mark-complete-${lessonId}` });
  const navigate = useNavigate();
  const isMarking =
    fetcher.state !== "idle" &&
    fetcher.formData?.get("intent") === "mark-complete";
  const justCompleted = fetcher.data?.success;
  const isCompleted =
    lessonStatus === LessonProgressStatus.Completed || justCompleted;

  useEffect(() => {
    if (justCompleted && nextLesson) {
      navigate(`/courses/${courseSlug}/lessons/${nextLesson.id}`);
    }
  }, [justCompleted, nextLesson, courseSlug, navigate]);

  if (isCompleted) {
    return <CompletedBanner courseSlug={courseSlug} nextLesson={nextLesson} />;
  }

  return (
    <fetcher.Form method="post" className="mb-8">
      <input type="hidden" name="intent" value="mark-complete" />
      {nextLesson ? (
        <Button disabled={isMarking}>
          {isMarking ? (
            "Completing..."
          ) : (
            <>
              Up next: {nextLesson.title}
              <ChevronRight className="ml-1 size-4" />
            </>
          )}
        </Button>
      ) : (
        <Button disabled={isMarking}>
          <CheckCircle2 className="mr-2 size-4" />
          {isMarking ? "Marking..." : "Mark as Complete"}
        </Button>
      )}
    </fetcher.Form>
  );
}

function CompletedBanner({
  courseSlug,
  nextLesson,
}: {
  courseSlug: string;
  nextLesson: NavLesson;
}) {
  return (
    <div className="mb-8 flex items-center gap-3">
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle2 className="size-5" />
        <span className="font-medium">Lesson completed</span>
      </div>
      {nextLesson && (
        <Link to={`/courses/${courseSlug}/lessons/${nextLesson.id}`}>
          <Button variant="outline" size="sm">
            Up next: {nextLesson.title}
            <ChevronRight className="ml-1 size-4" />
          </Button>
        </Link>
      )}
    </div>
  );
}

function LessonPager({
  course,
  prevLesson,
  nextLesson,
}: {
  course: { slug: string; title: string };
  prevLesson: NavLesson;
  nextLesson: NavLesson;
}) {
  return (
    <div className="flex items-center justify-between border-t pt-6">
      {prevLesson ? (
        <PagerLink
          to={`/courses/${course.slug}/lessons/${prevLesson.id}`}
          label="Previous"
          title={prevLesson.title}
          direction="back"
        />
      ) : (
        <div />
      )}

      {nextLesson ? (
        <PagerLink
          to={`/courses/${course.slug}/lessons/${nextLesson.id}`}
          label="Next"
          title={nextLesson.title}
          direction="forward"
          alignRight
        />
      ) : (
        <PagerLink
          to={`/courses/${course.slug}`}
          label="Back to"
          title={course.title}
          direction="forward"
        />
      )}
    </div>
  );
}

function PagerLink({
  to,
  label,
  title,
  direction,
  alignRight = false,
}: {
  to: string;
  label: string;
  title: string;
  direction: "back" | "forward";
  alignRight?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground",
        alignRight && "text-right"
      )}
    >
      {direction === "back" && <ChevronLeft className="size-4" />}
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="font-medium text-foreground">{title}</div>
      </div>
      {direction === "forward" && <ChevronRight className="size-4" />}
    </Link>
  );
}

function BookmarkToggle({ bookmarked }: { bookmarked: boolean }) {
  const fetcher = useFetcher<{ ok: boolean }>();
  const isSaving = fetcher.state !== "idle";

  return (
    <fetcher.Form method="post">
      <input type="hidden" name="intent" value="toggle-bookmark" />
      <Button type="submit" variant="outline" size="sm" disabled={isSaving}>
        {bookmarked ? (
          <BookmarkCheck className="mr-1.5 size-4" />
        ) : (
          <Bookmark className="mr-1.5 size-4" />
        )}
        {bookmarked ? "Bookmarked" : "Bookmark"}
      </Button>
    </fetcher.Form>
  );
}
