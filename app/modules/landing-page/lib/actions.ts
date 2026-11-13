export type LandingAction = { to: string; label: string };

export function chooseSecondaryAction(
  visitor: { id: number } | null
): LandingAction {
  return visitor
    ? { to: "/dashboard", label: "Go to your dashboard" }
    : { to: "/signup", label: "Create a free account" };
}
