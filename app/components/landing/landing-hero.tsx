import { Link } from "react-router";
import { ArrowRight, BookOpen, Sparkles, User } from "lucide-react";
import { Button } from "~/components/ui/button";
import { CourseImage } from "~/components/course-image";
import type { LandingAction, LandingStat } from "~/modules/landing-page";

export type HeroCourse = {
  title: string;
  slug: string;
  coverImageUrl: string | null;
  instructorName: string | null;
  categoryName: string | null;
  lessonCount: number;
};

export function LandingHero({
  stats,
  secondaryAction,
  spotlight,
}: {
  stats: LandingStat[];
  secondaryAction: LandingAction;
  spotlight: HeroCourse | null;
}) {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/5" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-16 px-6 py-20 lg:grid-cols-[1.15fr_1fr] lg:py-28">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            Courses for developers, by developers
          </p>
          <h1 className="mt-6 text-5xl font-bold tracking-tight sm:text-6xl">
            Learn to code,
            <br />
            <span className="text-muted-foreground">at your own pace</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Structured courses built by experienced instructors. Track your
            progress, take quizzes, and build real-world skills.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link to="/courses">
                Browse Courses
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to={secondaryAction.to}>{secondaryAction.label}</Link>
            </Button>
          </div>
          <HeroStats stats={stats} />
        </div>
        {spotlight && <HeroSpotlight course={spotlight} />}
      </div>
    </section>
  );
}

function HeroStats({ stats }: { stats: LandingStat[] }) {
  return (
    <ul className="mt-12 flex flex-wrap gap-x-10 gap-y-4 border-t border-border pt-8">
      {stats.map((stat) => (
        <li key={stat.label}>
          <p className="text-2xl font-bold">{stat.value}</p>
          <p className="text-sm text-muted-foreground">{stat.label}</p>
        </li>
      ))}
    </ul>
  );
}

function HeroSpotlight({ course }: { course: HeroCourse }) {
  return (
    <Link
      to={`/courses/${course.slug}`}
      className="group relative hidden lg:block"
    >
      <div className="absolute -inset-3 rotate-2 rounded-2xl bg-primary/10" />
      <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-xl transition-shadow group-hover:shadow-2xl">
        <CourseImage
          src={course.coverImageUrl}
          alt={course.title}
          className="aspect-video w-full object-cover"
        />
        <div className="p-6">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">
            New{course.categoryName ? ` in ${course.categoryName}` : ""}
          </p>
          <h2 className="mt-2 text-xl font-semibold leading-snug group-hover:text-primary">
            {course.title}
          </h2>
          <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <User className="size-4" />
              {course.instructorName ?? "Instructor"}
            </span>
            <span className="flex items-center gap-1.5">
              <BookOpen className="size-4" />
              {course.lessonCount} lessons
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
