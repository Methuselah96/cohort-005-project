# Knock (knock.app) for Cadence notifications

Researched 2026-11-11 against primary sources: docs.knock.app (the `.md` page sources and `llms-full.txt`), knock.app/pricing, the npm tarballs of the `@knocklabs/*` packages, webkit.org and MDN. Firebase docs are cited as the primary source for FCM itself.

## Question

Can Knock, on its free plan, give a React Router v8 SSR + TypeScript + SQLite/Drizzle app (Node server, Tailwind 4 + shadcn/ui) all of the following?

- an in-app notification feed
- web push to phones through the browser
- email
- user preferences
- identity and auth that use our own user IDs
- a safe dev/test story

## Verdict

**Partially yes.** Every requirement is available on the free plan except native web push.

- **In-app feed:** yes.
- **Email:** yes, but you bring your own provider for real users.
- **Preferences:** yes. Per-tenant preferences need Enterprise.
- **Identity and enhanced security:** yes.
- **Environments and sandboxing:** yes.
- **Web push:** not native. Knock's docs say it outright: "Knock does not have a first-party web push channel. Instead, you'll use FCM to send messages to a user's browser." ([tutorial](https://docs.knock.app/tutorials/sending-web-push-notifications-with-fcm)). Knock has no VAPID/Web Push protocol channel and ships no service worker of its own.

There are two workable web push paths:

1. **Knock FCM channel + Firebase JS SDK.** This is the path Knock documents. Firebase's `firebase-messaging-sw.js` service worker and a Firebase VAPID key produce a token. You store it as Knock channel data `{ tokens: [...] }`, and Knock sends through FCM HTTP v1.
2. **Knock webhook channel → our Node endpoint → `web-push` npm library with our own VAPID keys.** Our own service worker calls `PushManager.subscribe()`, and the subscriptions live in SQLite.

**Recommendation: path 2 (webhook + `web-push`).** Reasons:

- It uses only the standard Push API that WebKit documents for iOS 16.4+ Home Screen apps. Apple endpoints sit under `*.push.apple.com`.
- It avoids a Google/Firebase dependency.
- It avoids the FCM token → Firebase Installation ID (FID) migration happening now (see §2).
- We need our own service worker and manifest for the PWA anyway.

Path 2 has costs:

- We own subscription storage and pruning of expired subscriptions.
- Preferences gate this step under `channel_types.http`, not `push`.
- The webhook URL must be public HTTPS, so local dev needs sandbox mode or a tunnel.

Pick path 1 instead if you want Knock to manage push tokens, push-typed preferences and token deregistration for you.

## 1. In-app notification feed

- **Package:** `@knocklabs/react` (latest **0.15.1**, published 2026-11-06), built on `@knocklabs/react-core` 0.17.1 and `@knocklabs/client` 0.23.1 ([npm](https://www.npmjs.com/package/@knocklabs/react)).
  - Peer deps: React 17–19.
  - `next` and `@tanstack/react-router` are *optional* peers, used by the `./next` and `./tanstack` subpath exports. There is no React Router adapter (checked in package.json in the npm tarball).
- **Components:**
  - [`KnockProvider`](https://docs.knock.app/in-app-ui/react/sdk/components/knock-provider) and `KnockFeedProvider`.
  - [`NotificationIconButton`, `NotificationFeedPopover`, `NotificationFeed`, `NotificationCell`](https://docs.knock.app/in-app-ui/react/feed).
  - Also exported: `Avatar`, `UnseenBadge`, `MarkAsRead`, `EmptyFeed`, `NotificationFeedHeader`, `Button` and `ButtonGroup` (export list in the 0.15.1 bundle).
- **Headless:**
  - [`useKnockClient`, `useNotifications(knockClient, channelId, options)`, `useNotificationStore(feedClient)`](https://docs.knock.app/in-app-ui/react/headless/feed) return `{ items, metadata }`. `metadata` includes `unread_count` and `unseen_count`.
  - Also available: `useKnockFeed`, `usePreferences`, `useKnockAuthState`, `useAuthenticatedKnockClient` (react-core exports).
  - Headless hooks do **not** auto-mark items as seen. You call `markAllAsSeen()` or `markAsSeen()` yourself ([headless feed](https://docs.knock.app/in-app-ui/react/headless/feed)).
  - This is the route for a shadcn/Tailwind UI.
- **States and APIs:** `FeedClient` has the following ([reference](https://docs.knock.app/in-app-ui/javascript/sdk/feed-client)):
  - `markAsSeen` / `markAsUnseen`, `markAsRead` / `markAsUnread`, `markAsArchived` / `markAsUnarchived`, `markAsInteracted`.
  - `markAllAsSeen`, `markAllAsRead` and `markAllAsArchived`, which are deferred server-side.
  - `fetch` and `fetchNextPage`.
  - Events such as `items.received.realtime`.
  - Updates are optimistic. REST equivalents are `PUT/DELETE /v1/messages/:id/:status` and `POST /v1/messages/batch/:status` ([security page endpoint table](https://docs.knock.app/in-app-ui/security-and-authentication)).
- **Real-time:**
  - Knock runs a managed websocket service, and the SDK handles connect and reconnect ([socket behavior](https://docs.knock.app/in-app-ui/feeds/socket-behavior)).
  - `listenForUpdates()` / `teardown()` control the connection ([FeedClient](https://docs.knock.app/in-app-ui/javascript/sdk/feed-client)).
  - Optional `__experimentalCrossBrowserUpdates` uses BroadcastChannel to sync tabs ([feed](https://docs.knock.app/in-app-ui/react/feed)).
- **Styling** ([styling](https://docs.knock.app/in-app-ui/feeds/styling)):
  - CSS variables prefixed `--rnf-`.
  - Classes prefixed `rnf-`.
  - `renderItem` to override cells.
  - `colorMode` for light/dark.
  - The CSS import `@knocklabs/react/dist/index.css` is "Required … unless you're overriding the styling" ([feed](https://docs.knock.app/in-app-ui/react/feed)), so you can skip it. Going fully headless avoids it entirely.
  - The pre-built `NotificationFeed` renders a "Powered by Knock" footer when the account's `features.branding_required` flag is set (`NotificationFeed.mjs` in the 0.15.1 bundle). Headless UI avoids that footer.
- **SSR:**
  - The ESM entry of `@knocklabs/react` starts with `"use client"`. React Router ignores the directive, but it doesn't break anything.
  - `@knocklabs/client` guards browser globals: `typeof window !== "undefined"` before WebSocket, `typeof document` for visibility, `typeof self` for BroadcastChannel (`src/api.ts`, `src/pageVisibility.ts`, `src/clients/feed/feed.ts` in the 0.23.1 tarball). Importing it on the server should therefore be safe.
  - Data loads in effects, so SSR renders an empty or loading feed that hydrates on the client.
  - `KnockProvider`'s `enabled={false}` keeps the client idle, with no identify call, no requests and no socket, until identity or token is ready ([KnockProvider](https://docs.knock.app/in-app-ui/react/sdk/components/knock-provider)).
  - Knock has **no** documented SSR or React Router guide. The SSR import safety above is inferred from the source.

## 2. Web push (the key point)

- **No native web push.** The push providers are Amazon SNS, APNs, Expo, FCM and OneSignal ([push overview](https://docs.knock.app/integrations/push/overview)). The FCM tutorial says outright: "Knock does not have a first-party web push channel" ([tutorial](https://docs.knock.app/tutorials/sending-web-push-notifications-with-fcm)).
- **FCM supports web tokens.**
  - The FCM page says it sends "mobile or web push notifications". For web, "send the token to your app server and use the corresponding Knock SDK to set the channel data". Channel data is `tokens: string[]` or `devices`.
  - Overrides include a `webpush` key (FCM `WebpushConfig`).
  - Channel config is Project ID + Service Account JSON, plus sandbox mode and token deregistration ([FCM](https://docs.knock.app/integrations/push/firebase)).
  - The tutorial walks through the Firebase JS SDK, `firebase-messaging-sw.js`, the Firebase VAPID key, `getToken()` and `knock.user.setChannelData({ channelId, channelData: { tokens: [token] } })`. It explicitly blocks iOS unless the app is installed to the Home Screen ([tutorial](https://docs.knock.app/tutorials/sending-web-push-notifications-with-fcm)).
- **FCM caveat (flux):**
  - Firebase now marks the web `getToken()` registration-token API deprecated in favour of Firebase Installation IDs via `register()` / `onRegistered()` ([Firebase web client](https://firebase.google.com/docs/cloud-messaging/js/client)).
  - FCM HTTP v1 marks `token` deprecated for `fid`. During migration the `token` field still accepts FIDs ([projects.messages](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages), [Admin SDK send](https://firebase.google.com/docs/cloud-messaging/send/admin-sdk)).
  - Knock's docs still describe `tokens` only, so whether Knock sends FIDs through `token` long-term is unverified.
- **OneSignal:** Knock's OneSignal channel is documented for mobile only (tags: react native, ios, android). It sends via External ID = Knock user ID, and it assumes you already integrated the OneSignal SDK ([OneSignal](https://docs.knock.app/integrations/push/one-signal)). Knock doesn't say whether OneSignal *web* push subscribers are reachable through it, so that is unverified.
- **Webhook alternative:**
  - The webhook channel sends a configurable HTTP request (Liquid templating, request signing via `x-webhook-signature`, up to 8 retry attempts).
  - It rejects non-`https` URLs.
  - It supports sandbox mode and channel conditions ([webhook](https://docs.knock.app/integrations/webhook/overview)).
  - Preference channel types are `chat`, `email`, `http`, `in_app_feed`, `push` and `sms` (`@knocklabs/node` 1.41.1 `PreferenceSetChannelTypes`), so a webhook-delivered push counts as `http`.
  - `web-push` on npm: latest **4.0.0** was published 2026-11-06. The prior release was 3.6.7 (2024-01-16) ([npm](https://www.npmjs.com/package/web-push)). 4.0.0 is five days old, so vet it or pin 3.6.7.
- **Platform requirements:**
  - Push needs an active service worker, and the subscription endpoint is a secret capability URL ([MDN Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)).
  - `subscribe()` needs a secure context (HTTPS). `applicationServerKey` is the ECDSA P-256 VAPID public key. Chrome and Edge require `userVisibleOnly: true`. Subscription "should be done in response to a user gesture" (Firefox 72+ enforces this) ([MDN subscribe](https://developer.mozilla.org/en-US/docs/Web/API/PushManager/subscribe)).
  - The FCM SDK also requires HTTPS ([Firebase](https://firebase.google.com/docs/cloud-messaging/js/client)).
- **iOS/iPadOS** ([WebKit blog](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)):
  - Web Push for **Home Screen web apps** arrived in 16.4. The user must "Add to Home Screen".
  - The manifest `display` must be `standalone` or `fullscreen`.
  - Permission must be requested "in response to direct user interaction".
  - It uses the standard Push API + Notifications API + Service Workers.
  - No Apple Developer Program membership is needed.
  - Allow `*.push.apple.com` endpoints.
  - The Badging API is supported.
- **Limits:** Push messages count toward the plan's message quota like any channel ([plans](https://docs.knock.app/manage-your-account/knock-plans)). Knock pages don't state any web-push-specific limits; payload size limits come from the push services and weren't checked.

## 3. Email

- **Providers:** Amazon SES, Cloudflare Email, MailerSend, Mailgun, Mailjet, Mailtrap, Mandrill, Postmark, Resend, SendGrid, SMTP and SparkPost ([email overview](https://docs.knock.app/integrations/email/overview), [index](https://docs.knock.app/llms.txt)).
- **Built-in test provider ("Knock (testing only)"):**
  - Enabled by default in all environments.
  - **100 emails/month**.
  - Sends **only to the email addresses of members of your Knock account**. Other recipients get a `knock_recipient_not_allowed` error.
  - Past the limit, messages are marked `undelivered` until next month.
  - "Can I use this provider for production use? No." ([Knock test emails](https://docs.knock.app/integrations/email/knock-test))
- Every email channel has per-environment config, sandbox mode, CSS inlining, link/open tracking and a "To" override, which is useful to redirect dev mail ([Knock test](https://docs.knock.app/integrations/email/knock-test), [Resend](https://docs.knock.app/integrations/email/resend)).
- Free-plan emails apparently carry "Powered by Knock" branding: the docs have an FAQ on duplicate "Powered by Knock" in emails ([template testing](https://docs.knock.app/template-editor/testing-and-debugging)), and "Remove Knock branding" is a paid feature ([pricing](https://knock.app/pricing)).

## 4. Preferences

- **PreferenceSet:**
  - The keys are `categories`, `channels`, `channel_types` and `workflows`, plus `commercial_subscribed` on `default`.
  - They can nest per channel type, for example a category with `channel_types`.
  - Unset items default to `true`. A category `false` beats an explicit channel/channel-type `true`.
  - Source: [preferences overview](https://docs.knock.app/preferences/overview).
- **Defaults:**
  - You can set an environment-level default PreferenceSet in the dashboard or via the Management API.
  - Merge order: recipient > tenant default > environment default.
  - `__persistence_strategy__: "merge"` allows partial updates ([overview](https://docs.knock.app/preferences/overview)).
- **Conditions:** Conditions inside a PreferenceSet, for example per-resource muting. In batches they are evaluated only against the first activity ([preference conditions](https://docs.knock.app/preferences/preference-conditions)).
- **Tenant-level default preferences are Enterprise-only** ([plans](https://docs.knock.app/manage-your-account/knock-plans)). Preferences themselves are on Free ([pricing](https://knock.app/pricing)).
- **React:** There is no pre-built preference component, only a recipe for building your own `PreferenceCenter` with `@knocklabs/client` ([React preferences](https://docs.knock.app/in-app-ui/react/preferences)) and the headless `usePreferences` hook ([headless preferences](https://docs.knock.app/in-app-ui/react/headless/preferences)). A no-code hosted preference center (signed URL, `default` set only) also exists ([overview](https://docs.knock.app/preferences/overview)).

## 5. Identity, auth, triggering

- **Identity:**
  - Use your internal user ID as `id`, the only required property.
  - Identify directly with `PUT /v1/users/{id}` (Node `client.users.update(id, props)`), inline in a trigger or `KnockProvider`, or in bulk ([identifying recipients](https://docs.knock.app/managing-recipients/identifying-recipients)).
- **Feed auth:**
  - The client authenticates with the public API key + `user={{ id }}`.
  - Without enhanced security, "a request with your public key can act as any user".
- **Enhanced security:**
  - It requires a backend-signed **RS256** JWT with `sub` (recommended `iat`/`exp`), signed with the dashboard signing key in env var `KNOCK_SIGNING_KEY`.
  - The client passes it as `userToken`.
  - Optional UCAN-style `grants` can scope the token ([security](https://docs.knock.app/in-app-ui/security-and-authentication)).
  - The docs page imports `signUserToken` from `@knocklabs/node/lib/tokenSigner`. The current README imports it from the package root: `import { signUserToken } from '@knocklabs/node'`. Its options are `signingKey`, `expiresInSeconds` (default 3600), `grants` and `shouldGenerateJti` ([@knocklabs/node README](https://www.npmjs.com/package/@knocklabs/node)).
- **Node SDK:**
  - `@knocklabs/node` **1.41.1** (2026-11-10) is a Stainless-generated client.
  - Usage: `const knock = new Knock({ apiKey })`, where the key defaults to `KNOCK_API_KEY`.
  - Trigger: `await knock.workflows.trigger('key', { recipients, actor, data, tenant, cancellation_key, settings: { sandbox_mode, skip_delay } })` returns `workflow_run_id`. The workflow key is a positional first argument.
  - Up to 1000 recipients per call, 10 MB data ([trigger API](https://docs.knock.app/send-notifications/triggering-workflows/api), `resources/workflows.d.ts` in the tarball).
- **Idempotency:**
  - An `Idempotency-Key` header (≤255 chars) is honoured only on `POST /workflows/:key/trigger`, with a 24 h window.
  - Only 2xx responses are cached. A mismatched replay errors ([idempotent requests](https://docs.knock.app/api-reference/overview/idempotent-requests)).
  - The Node SDK auto-generates a key per request, so its own retries are safe. Pass `{ idempotencyKey }` in request options for app-level dedupe (`client.js` in 1.41.1).
- **Tenants:** Pass `tenant` on trigger to scope runs and feeds. You can use tenants on any plan, but per-tenant preferences, branding and translations are Enterprise ([plans FAQ](https://docs.knock.app/manage-your-account/knock-plans)).

## 6. Dev and test

- **Environments:**
  - Accounts created **after October 2026 start with a single environment**. Enabling environments adds Development below Production, can't be undone, and adds a commit → promote flow and optional branches.
  - Each environment has its own content, data, config and API keys ([version control overview](https://docs.knock.app/version-control/overview), [environments](https://docs.knock.app/version-control/environments)).
  - API triggers use the last *committed* version. The dashboard test runner uses the last *saved* draft ([testing workflows](https://docs.knock.app/send-notifications/testing-workflows)).
- **Avoiding real sends:**
  - Sandbox mode exists per channel per environment. It renders without handing off to the provider and doesn't count toward usage.
  - Per trigger, `settings.sandbox_mode: true` sandboxes the whole run, and `skip_delay` skips delays.
  - The test runner has the same toggles.
  - Channel conditions can, for example, restrict email to your own domain in dev.
  - The **in-app channel has no sandbox mode**, so use channel conditions or a dev environment ([plans](https://docs.knock.app/manage-your-account/knock-plans), [integrations overview](https://docs.knock.app/integrations/overview), [testing workflows](https://docs.knock.app/send-notifications/testing-workflows)).
  - The Knock CLI also has `workflow run` ([testing workflows](https://docs.knock.app/send-notifications/testing-workflows)).
- **Vitest:**
  - There is **no official mock or fake** in Knock's docs or in the `@knocklabs/node` package.
  - Wrap Knock behind our own module (e.g. `app/lib/notifications.server.ts`) and `vi.mock` that boundary.
  - Alternatively, use the SDK's `fetch` / `baseURL` (`KNOCK_BASE_URL`) constructor options to inject a fake transport (`client.d.ts` in 1.41.1).
  - For the client side, mock `@knocklabs/react` hooks, or keep the feed UI headless and feed it plain props.

## 7. Free plan limits

- The plan is now named **"Free (formerly known as our Developer plan)"**. Most features are on all plans, and a small set is Enterprise-only ([Knock plans](https://docs.knock.app/manage-your-account/knock-plans)).
- **Messages:** up to **10,000/month**. A message is one delivered message to one user on one channel, so email + in-app = 2.
  - There is no hard cap: "We don't hard cap your messages". Knock contacts you about billing ([pricing](https://knock.app/pricing)).
  - Usage accrues in every environment. Sandboxed messages don't count ([plans](https://docs.knock.app/manage-your-account/knock-plans)).
- **Seats and environments:** unlimited team members and unlimited environments ([pricing](https://knock.app/pricing)).
- **Branding:** "Remove Knock branding" is **No** on Free ([pricing](https://knock.app/pricing)). It shows in the pre-built feed footer and in emails (see §1, §3).
- **Retention:** logs 30 days. Feed retention unlimited ([pricing](https://knock.app/pricing)).
- **Not on Free:**
  - Per-tenant preferences and branding, translations (i18n), email client previews, custom roles, SAML SSO, SCIM, audit logs.
  - Batch render >10 items is Enterprise ([pricing](https://knock.app/pricing), [plans](https://docs.knock.app/manage-your-account/knock-plans)).
- **On Free:** preferences (Yes) and unlimited channels and workflows ([pricing](https://knock.app/pricing)). The pricing page has no row gating push or enhanced security mode, and the security docs show no plan restriction on it ([security](https://docs.knock.app/in-app-ui/security-and-authentication)).
- **Push channel groups** (APNs+FCM in one step) are on request via support ([push overview](https://docs.knock.app/integrations/push/overview)).
- **Starter** is $250/month for 50,000 messages ([pricing](https://knock.app/pricing)).
- None of these limits rules Cadence out.

## Open questions / unverified

- **FCM FIDs:** Whether Knock's FCM channel will move to the `fid` target, and whether storing an FID in `tokens` works today. FCM says `token` accepts FIDs "during the migration period"; Knock's docs don't mention FIDs.
- **Firebase on iOS:** Whether the Firebase JS messaging SDK works in iOS Home Screen web apps. Knock's tutorial implies it does, by gating iOS on PWA install, but Firebase's page doesn't name Safari/iOS.
- **OneSignal web push:** Whether Knock's OneSignal channel reaches OneSignal *web push* subscribers. It is documented for mobile only.
- **Enhanced security on Free:** Enhanced security mode availability on Free is inferred from the absence of gating, not from an explicit statement.
- **Exact branding placement:** Knock doesn't spell out where branding appears beyond the `branding_required` feed footer and the email FAQ, for example whether it shows in the hosted preference center.
- **SSR:** SSR safety of `@knocklabs/react` under React Router v8 is inferred from source guards. Knock has no SSR doc, and nothing was tested.
- **Webhook messages:** Whether webhook-channel messages count toward the 10k quota the same as other channels. The definition ("delivered … on a single channel") suggests yes.
