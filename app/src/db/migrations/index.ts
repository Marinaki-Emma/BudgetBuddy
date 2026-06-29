/**
 * Migration registry — import and register all migrations here in order.
 * To add a new migration:
 *   1. Create a new file: NNN_description.ts
 *   2. Export `id` (string) and `statements` (string[])
 *   3. Add it to the list below — ORDER MATTERS, never reorder existing ones
 */
import * as m001 from "./001_initial_schema";

export interface Migration {
  id: string;
  statements: string[];
}

export const migrations: Migration[] = [
  m001,
];