// PROTOTYPE, throw away: print a user's Knock feed. npx tsx scripts/prototype-peek-feed.ts <userId>
import { getFeed } from "../app/prototype/notification-feed-knock.server";
const f = await getFeed(Number(process.argv[2] ?? 2));
console.log(JSON.stringify(f.meta), f.entries.length);
console.log(JSON.stringify(f.entries[0], null, 1)?.slice(0, 1500));
