import { useState } from "react";
import { useFetcher } from "react-router";
import { Lock, NotebookPen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { cn, formatRelativeTime } from "~/lib/utils";
import {
  describeLessonNote,
  type NoteState,
  type NoteStatus,
  type SavedNote,
} from "~/modules/lesson-notes";

export function LessonNote({ note }: { note: SavedNote | null }) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [draft, setDraft] = useState(note?.body ?? "");
  const state = describeLessonNote({
    saved: note,
    draft,
    isSaving: fetcher.state !== "idle",
    error: fetcher.data?.error,
  });

  return (
    <section aria-labelledby="notes-heading">
      <div className="mb-4 flex items-center gap-2">
        <NotebookPen className="size-5 text-primary" />
        <h2 id="notes-heading" className="text-xl font-semibold">
          Your notes
        </h2>
        <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="size-3" />
          Only you can see these
        </span>
      </div>

      <fetcher.Form method="post">
        <input type="hidden" name="intent" value="save-note" />
        <Textarea
          name="body"
          rows={4}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Jot down what clicked, what didn't, and what to come back to..."
          aria-describedby="notes-status"
          className="min-h-24 resize-y"
        />
        <NoteFooter state={state} />
      </fetcher.Form>
    </section>
  );
}

function NoteFooter({
  state: { status, canSave, remaining },
}: {
  state: NoteState;
}) {
  return (
    <div className="mt-3 flex items-center gap-3">
      <p
        id="notes-status"
        aria-live="polite"
        suppressHydrationWarning
        className={cn(
          "text-xs",
          status.kind === "error" || status.kind === "too-long"
            ? "text-red-600"
            : "text-muted-foreground"
        )}
      >
        <StatusText status={status} />
      </p>
      {remaining !== null && (
        <span
          className={cn(
            "text-xs tabular-nums",
            remaining < 0 ? "text-red-600" : "text-muted-foreground"
          )}
        >
          {remaining.toLocaleString("en")} left
        </span>
      )}
      <Button
        type="submit"
        size="sm"
        variant="outline"
        className="ml-auto"
        disabled={!canSave}
      >
        {status.kind === "saving" ? "Saving..." : "Save note"}
      </Button>
    </div>
  );
}

function StatusText({ status }: { status: NoteStatus }) {
  switch (status.kind) {
    case "saving":
      return "Saving...";
    case "too-long":
      return `${status.overBy.toLocaleString("en")} characters over the limit`;
    case "error":
      return status.message;
    case "unsaved":
      return "Unsaved changes";
    case "saved":
      return `Saved ${formatRelativeTime(status.updatedAt)}`;
    case "blank":
      return "";
  }
}
