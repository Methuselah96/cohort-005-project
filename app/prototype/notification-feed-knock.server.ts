// PROTOTYPE, throw away. Wayfinder ticket #29: thin Knock feed client for the
// Notification Feed UI variants. Reads with public key + signed user token
// (the production path); writes seen/read/archived with the secret key.
import { createSign } from "node:crypto";

try {
  process.loadEnvFile(".env");
} catch {}

const API = "https://api.knock.app/v1";
const env = (k: string) => process.env[k]!;

function signUserToken(userId: string) {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const input = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ sub: userId, iat: now, exp: now + 3600 })}`;
  const pem = Buffer.from(env("KNOCK_SIGNING_KEY"), "base64").toString("utf8");
  const sig = createSign("RSA-SHA256").update(input).sign(pem).toString("base64url");
  return `${input}.${sig}`;
}

export type FeedItem = {
  id: string;
  inserted_at: string;
  seen_at: string | null;
  read_at: string | null;
  archived_at: string | null;
  actors: { id: string; name?: string }[];
  data: { kind: string; title: string; body: string; url: string; needs_action: boolean };
};

export type Feed = {
  entries: FeedItem[];
  meta: { unseen_count: number; unread_count: number; total_count: number };
};

export async function getFeed(userId: number, archived = false): Promise<Feed> {
  const url = `${API}/users/${userId}/feeds/${env("KNOCK_FEED_CHANNEL_ID")}?page_size=50&archived=${archived ? "only" : "exclude"}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env("KNOCK_PUBLIC_API_KEY")}`,
      "X-Knock-User-Token": signUserToken(String(userId)),
    },
  });
  if (!res.ok) throw new Error(`Knock feed ${res.status}: ${await res.text()}`);
  return res.json();
}

// Fires one fresh Notification at a user, so "something new arrives" can be judged.
export async function triggerSample(user: { id: number; name: string }) {
  const res = await fetch(`${API}/workflows/prototype-feed-notification/trigger`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("KNOCK_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      recipients: [{ id: String(user.id), name: user.name }],
      actor: { id: "3", name: "Marcus Johnson" },
      data: {
        kind: "answer_posted",
        title: "Your Question was answered",
        body: `**Marcus Johnson** answered your Question on *Designing Resource URLs* (sent ${new Date().toLocaleTimeString()}).`,
        url: "/courses/building-rest-apis-with-nodejs",
        needs_action: false,
      },
    }),
  });
  if (!res.ok) throw new Error(`Knock trigger ${res.status}: ${await res.text()}`);
}

export type FeedStatus = "seen" | "read" | "archived" | "unseen" | "unread" | "unarchived";

export async function setStatus(messageIds: string[], status: FeedStatus) {
  if (messageIds.length === 0) return;
  const res = await fetch(`${API}/messages/batch/${status}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env("KNOCK_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message_ids: messageIds }),
  });
  if (!res.ok) throw new Error(`Knock ${status} ${res.status}: ${await res.text()}`);
}
