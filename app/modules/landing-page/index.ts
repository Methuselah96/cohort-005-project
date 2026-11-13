import { buildLandingStats, type LandingStat } from "./lib/stats";
import { chooseSecondaryAction, type LandingAction } from "./lib/actions";

export type { LandingStat, LandingAction };

export function landingStats(counts: {
  courseCount: number;
  categoryCount: number;
}): LandingStat[] {
  return buildLandingStats(counts);
}

export function secondaryHeroAction(signedIn: boolean): LandingAction {
  return chooseSecondaryAction(signedIn);
}
