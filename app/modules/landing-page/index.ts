import { buildLandingStats, type LandingStat } from "./lib/stats";
import { chooseSecondaryAction, type LandingAction } from "./lib/actions";

export type { LandingStat, LandingAction };

/**
 * The figures in the landing page's hero, worded for the counts given.
 */
export function landingStats(counts: {
  courseCount: number;
  categoryCount: number;
}): LandingStat[] {
  return buildLandingStats(counts);
}

/**
 * The hero's second call to action: a visitor is asked to sign up, a
 * signed-in Person is sent back to their dashboard.
 */
export function secondaryHeroAction(
  visitor: { id: number } | null
): LandingAction {
  return chooseSecondaryAction(visitor);
}
