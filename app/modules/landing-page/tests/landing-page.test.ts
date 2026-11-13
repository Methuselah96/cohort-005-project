import { describe, it, expect } from "vitest";
import { landingStats, secondaryHeroAction } from "../index";

describe("landingStats", () => {
  it("pluralises the course and category counts", () => {
    expect(landingStats({ courseCount: 4, categoryCount: 5 })).toEqual([
      { value: "4", label: "courses" },
      { value: "5", label: "categories" },
      { value: "Self-paced", label: "on your schedule" },
    ]);
  });

  it("uses the singular for a count of one", () => {
    const [courses, categories] = landingStats({
      courseCount: 1,
      categoryCount: 1,
    });
    expect(courses).toEqual({ value: "1", label: "course" });
    expect(categories).toEqual({ value: "1", label: "category" });
  });

  it("uses the plural for a count of zero", () => {
    const [courses, categories] = landingStats({
      courseCount: 0,
      categoryCount: 0,
    });
    expect(courses).toEqual({ value: "0", label: "courses" });
    expect(categories).toEqual({ value: "0", label: "categories" });
  });
});

describe("secondaryHeroAction", () => {
  it("asks a visitor who is not signed in to create an account", () => {
    expect(secondaryHeroAction(false)).toEqual({
      to: "/signup",
      label: "Create a free account",
    });
  });

  it("sends a signed-in Person to their dashboard", () => {
    expect(secondaryHeroAction(true)).toEqual({
      to: "/dashboard",
      label: "Go to your dashboard",
    });
  });
});
