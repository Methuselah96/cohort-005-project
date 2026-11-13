export type LandingAction = { to: string; label: string };

export function chooseSecondaryAction(signedIn: boolean): LandingAction {
  return signedIn
    ? { to: "/dashboard", label: "Go to your dashboard" }
    : { to: "/signup", label: "Create a free account" };
}
