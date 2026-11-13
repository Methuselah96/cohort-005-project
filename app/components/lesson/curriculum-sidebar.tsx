import { useState } from "react";
import { Link } from "react-router";
import { CheckCircle2, ChevronDown, Circle, PlayCircle } from "lucide-react";
import { LessonProgressStatus } from "~/db/schema";
import { cn } from "~/lib/utils";

type SidebarCourse = { id: number; title: string; slug: string };
type SidebarModule = {
  id: number;
  title: string;
  lessons: Array<{ id: number; title: string }>;
};

export function CurriculumSidebar({
  course,
  curriculum,
  currentLessonId,
  lessonProgressMap,
  enrolled,
}: {
  course: SidebarCourse;
  curriculum: SidebarModule[];
  currentLessonId: number;
  lessonProgressMap: Record<number, string>;
  enrolled: boolean;
}) {
  const [expandedModules, toggleModule] = useExpandedModules(
    curriculum,
    currentLessonId
  );

  return (
    <aside className="hidden w-72 shrink-0 border-r border-border lg:block">
      <div className="sticky top-0 flex h-screen flex-col overflow-y-auto">
        <div className="border-b border-border p-4">
          <Link
            to={`/courses/${course.slug}`}
            className="text-sm font-semibold hover:text-primary"
          >
            {course.title}
          </Link>
        </div>

        <nav className="flex-1 p-2">
          {curriculum.map((mod) => (
            <SidebarModuleItem
              key={mod.id}
              mod={mod}
              courseSlug={course.slug}
              expanded={expandedModules.has(mod.id)}
              onToggle={() => toggleModule(mod.id)}
              currentLessonId={currentLessonId}
              lessonStatus={(id) =>
                enrolled ? lessonProgressMap[id] : undefined
              }
            />
          ))}
        </nav>
      </div>
    </aside>
  );
}

function SidebarModuleItem({
  mod,
  courseSlug,
  expanded,
  onToggle,
  currentLessonId,
  lessonStatus,
}: {
  mod: SidebarModule;
  courseSlug: string;
  expanded: boolean;
  onToggle: () => void;
  currentLessonId: number;
  lessonStatus: (lessonId: number) => string | undefined;
}) {
  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground/80 hover:bg-muted"
      >
        <ChevronDown
          className={cn(
            "size-4 shrink-0 transition-transform",
            !expanded && "-rotate-90"
          )}
        />
        <span className="flex-1 text-left">{mod.title}</span>
      </button>

      {expanded && (
        <ul className="ml-4 space-y-0.5 py-1">
          {mod.lessons.map((l) => (
            <li key={l.id}>
              <SidebarLessonLink
                to={`/courses/${courseSlug}/lessons/${l.id}`}
                title={l.title}
                isCurrent={l.id === currentLessonId}
                status={lessonStatus(l.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The current lesson's module starts expanded. */
function useExpandedModules(
  curriculum: SidebarModule[],
  currentLessonId: number
) {
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    const currentModuleId = curriculum.find((m) =>
      m.lessons.some((l) => l.id === currentLessonId)
    )?.id;
    return new Set(currentModuleId ? [currentModuleId] : []);
  });

  function toggle(moduleId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  }

  return [expanded, toggle] as const;
}

function SidebarLessonLink({
  to,
  title,
  isCurrent,
  status,
}: {
  to: string;
  title: string;
  isCurrent: boolean;
  status: string | undefined;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
        isCurrent
          ? "bg-primary/10 font-medium text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      <LessonStatusIcon status={status} />
      <span className="truncate">{title}</span>
    </Link>
  );
}

function LessonStatusIcon({ status }: { status: string | undefined }) {
  if (status === LessonProgressStatus.Completed) {
    return <CheckCircle2 className="size-3.5 shrink-0 text-green-500" />;
  }
  if (status === LessonProgressStatus.InProgress) {
    return <PlayCircle className="size-3.5 shrink-0 text-blue-500" />;
  }
  return <Circle className="size-3.5 shrink-0" />;
}
