// PROTOTYPE, throw away. Wayfinder ticket #29: seen/read/archive writes for the
// Notification Feed variants. Revalidation re-runs the layout loader afterwards.
import type { Route } from "./+types/api.prototype-notification-feed";
import { getCurrentUserId } from "~/lib/session";
import { getFeed, setStatus, triggerSample, type FeedStatus } from "~/prototype/notification-feed-knock.server";

export async function action({ request }: Route.ActionArgs) {
  const userId = await getCurrentUserId(request);
  if (!userId) throw new Response("Select a user from the DevUI panel", { status: 401 });
  const form = await request.formData();
  const status = form.get("status") as FeedStatus | "reset" | "send";
  let ids = form.getAll("id").map(String);

  if (status === "send") {
    await triggerSample({ id: userId, name: String(form.get("name") ?? "") });
    await new Promise((r) => setTimeout(r, 1500)); // let Knock run the workflow before revalidating
    return { ok: true };
  }

  if (status === "reset") {
    // Put the current user's whole feed back to fresh: unseen, unread, unarchived.
    const all = [...(await getFeed(userId)).entries, ...(await getFeed(userId, true)).entries].map((e) => e.id);
    await setStatus(all, "unarchived");
    await setStatus(all, "unread");
    await setStatus(all, "unseen");
    return { ok: true };
  }
  if (ids.length === 0) ids = (await getFeed(userId)).entries.map((e) => e.id); // "all"
  await setStatus(ids, status);
  return { ok: true };
}
