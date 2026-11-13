import type { TestDb } from "~/test/setup";

// lesson-viewer reads the app's shared connection from `~/db`. Tests mock
// that module with this one and point it at a fresh in-memory database.
let current: TestDb | undefined;

export function useTestDb(testDb: TestDb) {
  current = testDb;
}

export const db = new Proxy({} as TestDb, {
  get(_target, prop) {
    if (!current) throw new Error("Call useTestDb() before using the db");
    const value = Reflect.get(current, prop);
    return typeof value === "function" ? value.bind(current) : value;
  },
});
