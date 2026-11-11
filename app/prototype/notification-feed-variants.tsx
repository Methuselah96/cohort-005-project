// PROTOTYPE, throw away. Wayfinder ticket #29: "What does the Notification Feed look like in Cadence?"
// Three variants of the Notification Feed, mounted in the real app layout and
// switched with ?variant=A|B|C (floating bar, or ← →). Data is the real Knock
// Development feed of whichever user the DevUI has selected.
//
//   A  Bell popover    bell in the sidebar header, badge = UNSEEN, opening marks all seen
//   B  Slide-over      sidebar nav item, badge = UNREAD, right-hand drawer with "Needs action" tab
//   C  Inbox page      sidebar nav item, badge = UNREAD, two-pane inbox replaces the page
import { useEffect, useRef, useState } from "react";
import { useFetcher, useNavigate, useRevalidator, useSearchParams } from "react-router";
import { Bell, Inbox, Archive, Check, X, ArrowRight, MailOpen, Mail } from "lucide-react";
import { cn } from "~/lib/utils";
import { UserAvatar } from "~/components/user-avatar";

export type FeedNotification = {
  id: string;
  insertedAt: string;
  seen: boolean;
  read: boolean;
  actorName: string | null;
  kind: string;
  title: string;
  html: string;
  url: string;
  needsAction: boolean;
};

export type FeedData = {
  items: FeedNotification[];
  unseenCount: number;
  unreadCount: number;
  error?: string;
} | null;

export const FEED_VARIANTS = [
  { key: "A", name: "Bell popover" },
  { key: "B", name: "Slide-over inbox" },
  { key: "C", name: "Inbox page" },
];

// ---------- shared plumbing (fine to share: not layout) ----------

function useFeedActions() {
  const fetcher = useFetcher();
  return (status: string, ids: string[] = []) => {
    const fd = new FormData();
    fd.set("status", status);
    ids.forEach((id) => fd.append("id", id));
    fetcher.submit(fd, { method: "post", action: "/api/prototype-notification-feed" });
  };
}

// Stand-in for Knock's real-time socket: re-run loaders every 10s.
export function useFeedPolling() {
  const { revalidate, state } = useRevalidator();
  useEffect(() => {
    const t = setInterval(() => state === "idle" && revalidate(), 10_000);
    return () => clearInterval(t);
  }, [revalidate, state]);
}

function ago(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function Body({ html, className }: { html: string; className?: string }) {
  return <div className={cn("[&_p]:m-0", className)} dangerouslySetInnerHTML={{ __html: html }} />;
}

function Count({ n, className }: { n: number; className?: string }) {
  if (n === 0) return null;
  return (
    <span className={cn("rounded-full bg-red-600 px-1.5 text-[11px] font-semibold leading-[18px] text-white", className)}>
      {n > 9 ? "9+" : n}
    </span>
  );
}

function FeedError({ feed }: { feed: FeedData }) {
  if (!feed?.error) return null;
  return <p className="p-4 text-sm text-destructive">Knock: {feed.error}</p>;
}

function useOpen(item: FeedNotification, act: ReturnType<typeof useFeedActions>, after?: () => void) {
  const navigate = useNavigate();
  return () => {
    if (!item.read) act("read", [item.id]);
    after?.();
    navigate(item.url);
  };
}

// ---------- Variant A: bell popover ----------

export function VariantAHeaderSlot({ feed }: { feed: FeedData }) {
  const [open, setOpen] = useState(false);
  const act = useFeedActions();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  if (!feed) return null;

  function toggle() {
    const next = !open;
    setOpen(next);
    // Opening the feed = you've seen everything in it. Unread stays until clicked.
    if (next && feed!.unseenCount > 0) act("seen", feed!.items.filter((i) => !i.seen).map((i) => i.id));
  }

  return (
    <div ref={ref} className="relative ml-auto">
      <button onClick={toggle} className="relative rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent" title="Notifications">
        <Bell className="size-5" />
        <Count n={feed.unseenCount} className="absolute -right-1 -top-1" />
      </button>
      {open && (
        <div className="fixed left-[13.5rem] top-2 z-50 flex max-h-[80vh] w-96 flex-col overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="font-semibold">Notifications</span>
            <button
              onClick={() => act("read")}
              disabled={feed.unreadCount === 0}
              className="text-xs text-primary hover:underline disabled:opacity-40"
            >
              Mark all as read
            </button>
          </div>
          <FeedError feed={feed} />
          <div className="overflow-y-auto">
            {feed.items.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">You're all caught up.</p>}
            {feed.items.map((item) => (
              <PopoverRow key={item.id} item={item} act={act} close={() => setOpen(false)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PopoverRow({ item, act, close }: { item: FeedNotification; act: ReturnType<typeof useFeedActions>; close: () => void }) {
  const open = useOpen(item, act, close);
  return (
    <button onClick={open} className={cn("flex w-full gap-3 border-b px-4 py-3 text-left text-sm hover:bg-muted/60", !item.read && "bg-primary/5")}>
      <UserAvatar name={item.actorName ?? "Cadence"} avatarUrl={null} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <Body html={item.html} className={cn(item.read && "text-muted-foreground")} />
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          {ago(item.insertedAt)}
          {item.needsAction && <span className="rounded bg-amber-100 px-1.5 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Needs action</span>}
        </div>
      </div>
      {!item.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-primary" />}
    </button>
  );
}

// ---------- Variant B: slide-over inbox ----------

export function VariantBNavSlot({ feed }: { feed: FeedData }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"action" | "all">("all");
  const act = useFeedActions();
  if (!feed) return null;

  const needsAction = feed.items.filter((i) => i.needsAction && !i.read);
  const shown = tab === "action" ? needsAction : feed.items;
  const today = shown.filter((i) => Date.now() - new Date(i.insertedAt).getTime() < 86_400_000);
  const earlier = shown.filter((i) => !today.includes(i));

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <Bell className="size-4" />
        Notifications
        <Count n={feed.unreadCount} className="ml-auto" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-[440px] flex-col bg-background shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-lg font-semibold">Notifications</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => act("read")} className="text-xs text-primary hover:underline">Mark all as read</button>
                <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-muted"><X className="size-4" /></button>
              </div>
            </div>
            <div className="flex gap-4 border-b px-5 text-sm">
              {(["all", "action"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn("-mb-px border-b-2 py-2", tab === t ? "border-primary font-medium" : "border-transparent text-muted-foreground")}
                >
                  {t === "all" ? `All (${feed.unreadCount} unread)` : `Needs action (${needsAction.length})`}
                </button>
              ))}
            </div>
            <FeedError feed={feed} />
            <div className="flex-1 overflow-y-auto">
              {shown.length === 0 && <p className="p-10 text-center text-sm text-muted-foreground">Nothing here.</p>}
              {[["Today", today], ["Earlier", earlier]].map(([label, list]) =>
                (list as FeedNotification[]).length === 0 ? null : (
                  <section key={label as string}>
                    <h3 className="bg-muted/50 px-5 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label as string}</h3>
                    {(list as FeedNotification[]).map((item) => (
                      <DrawerRow key={item.id} item={item} act={act} close={() => setOpen(false)} />
                    ))}
                  </section>
                )
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

function DrawerRow({ item, act, close }: { item: FeedNotification; act: ReturnType<typeof useFeedActions>; close: () => void }) {
  const open = useOpen(item, act, close);
  return (
    <div className={cn("group flex gap-3 border-b px-5 py-3 text-sm", !item.read ? "border-l-4 border-l-primary" : "border-l-4 border-l-transparent")}>
      <button onClick={open} className="min-w-0 flex-1 text-left">
        <div className={cn("font-medium", item.read && "font-normal text-muted-foreground")}>{item.title}</div>
        <Body html={item.html} className="mt-0.5 text-muted-foreground" />
        <div className="mt-1 text-xs text-muted-foreground">{ago(item.insertedAt)} ago{item.actorName && ` · ${item.actorName}`}</div>
      </button>
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100">
        <button onClick={() => act(item.read ? "unread" : "read", [item.id])} title={item.read ? "Mark unread" : "Mark read"} className="rounded p-1 hover:bg-muted">
          {item.read ? <Mail className="size-4" /> : <MailOpen className="size-4" />}
        </button>
        <button onClick={() => act("archived", [item.id])} title="Archive" className="rounded p-1 hover:bg-muted">
          <Archive className="size-4" />
        </button>
      </div>
    </div>
  );
}

// ---------- Variant C: inbox page ----------

export function VariantCNavSlot({ feed }: { feed: FeedData }) {
  const [params, setParams] = useSearchParams();
  if (!feed) return null;
  const active = params.get("inbox") === "1";
  return (
    <button
      onClick={() => setParams((p) => { p.set("inbox", "1"); return p; })}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
        active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Inbox className="size-4" />
      Inbox
      <Count n={feed.unreadCount} className="ml-auto" />
    </button>
  );
}

export function VariantCInbox({ feed }: { feed: FeedData }) {
  const act = useFeedActions();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (!feed) return <p className="p-8">Select a user from the DevUI panel.</p>;
  const selected = feed.items.find((i) => i.id === selectedId) ?? null;

  function select(item: FeedNotification) {
    setSelectedId(item.id);
    if (!item.read) act("read", [item.id]); // reading it in the pane counts as read
  }

  return (
    <div className="flex h-full">
      <div className="flex w-[380px] shrink-0 flex-col border-r">
        <div className="flex h-14 items-center justify-between border-b px-4">
          <h1 className="text-lg font-semibold">Inbox</h1>
          <button onClick={() => act("read")} className="text-xs text-primary hover:underline">Mark all as read</button>
        </div>
        <FeedError feed={feed} />
        <div className="flex-1 overflow-y-auto">
          {feed.items.map((item) => (
            <button
              key={item.id}
              onClick={() => select(item)}
              className={cn(
                "flex w-full items-start gap-2 border-b px-4 py-3 text-left text-sm",
                selected?.id === item.id ? "bg-accent" : "hover:bg-muted/50"
              )}
            >
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", item.read ? "bg-transparent" : "bg-primary")} />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <span className={cn("truncate", !item.read && "font-semibold")}>{item.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{ago(item.insertedAt)}</span>
                </div>
                <div className="truncate text-xs text-muted-foreground">{item.actorName ?? "Cadence"}</div>
              </div>
              {item.needsAction && !item.read && <span className="shrink-0 rounded bg-amber-100 px-1.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">Action</span>}
            </button>
          ))}
          {feed.items.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">Inbox zero.</p>}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <article className="mx-auto max-w-2xl p-10">
            <div className="flex items-center gap-3">
              <UserAvatar name={selected.actorName ?? "Cadence"} avatarUrl={null} className="size-10" />
              <div>
                <div className="font-medium">{selected.actorName ?? "Cadence"}</div>
                <div className="text-xs text-muted-foreground">{new Date(selected.insertedAt).toLocaleString()}</div>
              </div>
            </div>
            <h2 className="mt-6 text-2xl font-bold">{selected.title}</h2>
            <Body html={selected.html} className="prose mt-3 dark:prose-invert" />
            <div className="mt-8 flex gap-2">
              <button onClick={() => navigate(selected.url)} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
                {selected.needsAction ? "Take action" : "Open"} <ArrowRight className="size-4" />
              </button>
              <button onClick={() => act("unread", [selected.id])} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Mail className="size-4" /> Mark unread
              </button>
              <button onClick={() => { act("archived", [selected.id]); setSelectedId(null); }} className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                <Archive className="size-4" /> Archive
              </button>
            </div>
          </article>
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-muted-foreground">
            <Check className="size-8" />
            <p className="mt-2 text-sm">Select a Notification</p>
          </div>
        )}
      </div>
    </div>
  );
}
