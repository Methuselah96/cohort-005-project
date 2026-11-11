# Use Knock as the notification vendor

Cadence sends Notifications through one hosted vendor, and that vendor is Knock. Knock was the only candidate that met the whole brief on its free plan: 10K messages a month, a headless feed API with unread and unseen counts, a Node SDK, preferences it stores by category × channel, and signed user tokens that production requires (RS256 JWTs our server signs for whoever is in the session, so the DevUI switcher keeps working). The comparison is in [Which hosted notification vendor fits Cadence?](https://github.com/Methuselah96/cohort-005-project/issues/23).

## Considered Options

- **Courier.** The runner-up and the fallback. It has scoped, expiring JWTs, topic × channel preferences and pay-as-you-go pricing ($0.005 per send). Web push would still need OneSignal or FCM.
- **MagicBell.** The only strong option with native web push, but its free tier is just 1K deliveries a month. We rejected it because web push is only an optional extra channel for Cadence (email is the default out-of-app channel; see [How far can web push reach without a native app?](https://github.com/Methuselah96/cohort-005-project/issues/24)).
- **Novu Cloud.** Rejected. Its feed auth is a static HMAC of the subscriber id with no expiry, and its preferences have no categories.
- **SuprSend.** Rejected. Vendor-stored preferences aren't on the free plan, and category preferences need the $250/mo Business plan.

## Consequences

- Knock has no web push of its own. If Cadence offers web push, it goes through Firebase Cloud Messaging, which means a Firebase project, the Firebase SDK and a service worker.
- The jump to paid is steep: $250/mo for 50K messages on Starter. If that ever matters, Courier is the fallback.
- Moving off Knock would mean rebuilding the feed integration and token signing and migrating the stored preferences.
