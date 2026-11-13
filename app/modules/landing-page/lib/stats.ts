export type LandingStat = { value: string; label: string };

function countLabel(count: number, singular: string, plural: string) {
  return count === 1 ? singular : plural;
}

export function buildLandingStats(counts: {
  courseCount: number;
  categoryCount: number;
}): LandingStat[] {
  return [
    {
      value: String(counts.courseCount),
      label: countLabel(counts.courseCount, "course", "courses"),
    },
    {
      value: String(counts.categoryCount),
      label: countLabel(counts.categoryCount, "category", "categories"),
    },
    { value: "Self-paced", label: "on your schedule" },
  ];
}
