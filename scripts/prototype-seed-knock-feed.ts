// PROTOTYPE, throw away. Wayfinder ticket "What does the Notification Feed look like in Cadence?" (#29).
// Triggers a handful of catalogue Notifications through the Knock Development
// workflow `prototype-feed-notification` so the feed variants have real data.
// Run: npm run prototype:feed-seed
process.loadEnvFile(".env");

const KEY = process.env.KNOCK_API_KEY!;
const WORKFLOW = "prototype-feed-notification";

type Person = { id: string; name: string; email: string };
const alex: Person = { id: "1", name: "Alex Rivera", email: "alex.rivera@ralph.dev" }; // Platform Admin
const sarah: Person = { id: "2", name: "Sarah Chen", email: "sarah.chen@ralph.dev" }; // Instructor
const emma: Person = { id: "5", name: "Emma Wilson", email: "emma.wilson@student.dev" }; // Student
const james: Person = { id: "6", name: "James Park", email: "james.park@student.dev" };
const olivia: Person = { id: "7", name: "Olivia Martinez", email: "olivia.martinez@student.dev" };
const bossy: Person = { id: "10", name: "Bossy McBossface", email: "bossy.mcbossface@student.dev" }; // Team Admin

type Seed = {
  to: Person;
  actor?: Person;
  data: {
    kind: string;
    title: string;
    body: string;
    url: string;
    needs_action: boolean;
  };
};

const seeds: Seed[] = [
  // Platform Admin
  {
    to: alex,
    actor: emma,
    data: {
      kind: "refund_request_raised",
      title: "Refund Request raised",
      body: "**Emma Wilson** asked for a refund on *Introduction to TypeScript* (Individual Purchase): \"The pace is too fast for me.\"",
      url: "/admin/refunds",
      needs_action: true,
    },
  },
  {
    to: alex,
    actor: bossy,
    data: {
      kind: "refund_request_raised",
      title: "Refund Request raised",
      body: "**Bossy McBossface** asked for a refund on *Design Systems with Tailwind* (Team Licence, 4 Unclaimed Seats): \"Team reorganised.\"",
      url: "/admin/refunds",
      needs_action: true,
    },
  },
  // Instructor
  {
    to: sarah,
    actor: james,
    data: {
      kind: "question_asked",
      title: "New Question",
      body: "**James Park** asked on *Installing and Configuring TypeScript*: \"Should `strict` be on from day one?\"",
      url: "/courses/introduction-to-typescript/lessons/2",
      needs_action: true,
    },
  },
  {
    to: sarah,
    actor: olivia,
    data: {
      kind: "question_asked",
      title: "New Question",
      body: "**Olivia Martinez** asked on *What is TypeScript?*: \"How is this different from JSDoc types?\"",
      url: "/courses/introduction-to-typescript/lessons/1",
      needs_action: true,
    },
  },
  {
    to: sarah,
    actor: alex,
    data: {
      kind: "course_status_changed",
      title: "Course status changed",
      body: "**Alex Rivera** changed *Design Systems with Tailwind* to **Archived**.",
      url: "/instructor/3",
      needs_action: false,
    },
  },
  // Student
  {
    to: emma,
    actor: sarah,
    data: {
      kind: "answer_posted",
      title: "Your Question was answered",
      body: "**Sarah Chen** answered your Question on *Your First TypeScript Program*.",
      url: "/courses/introduction-to-typescript/lessons/3",
      needs_action: false,
    },
  },
  {
    to: emma,
    actor: alex,
    data: {
      kind: "refund_request_declined",
      title: "Refund Request declined",
      body: "Your Refund Request for *Introduction to TypeScript* was declined: \"You've completed over half the course.\" You can raise a new one.",
      url: "/courses/introduction-to-typescript",
      needs_action: false,
    },
  },
  {
    to: emma,
    actor: alex,
    data: {
      kind: "role_changed",
      title: "Your role changed",
      body: "You're now an **Instructor**.",
      url: "/instructor",
      needs_action: false,
    },
  },
  // Team Admin
  {
    to: bossy,
    actor: olivia,
    data: {
      kind: "seat_claimed",
      title: "Seat claimed",
      body: "**Olivia Martinez** claimed a Seat on *Design Systems with Tailwind*. 3 Seats left.",
      url: "/team",
      needs_action: false,
    },
  },
  {
    to: bossy,
    actor: alex,
    data: {
      kind: "refund_request_approved",
      title: "Refund Request approved",
      body: "Your Refund Request for *Building REST APIs with Node.js* was approved. The 2 Unclaimed Seats are void.",
      url: "/team",
      needs_action: false,
    },
  },
];

for (const seed of seeds) {
  const res = await fetch(`https://api.knock.app/v1/workflows/${WORKFLOW}/trigger`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ recipients: [seed.to], actor: seed.actor, data: seed.data }),
  });
  console.log(res.status, seed.to.name, "<-", seed.data.kind, await res.text());
  await new Promise((r) => setTimeout(r, 1500)); // spread the timestamps a little
}
export {};
