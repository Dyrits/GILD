import { Predicate } from "effect";

// Reading fields from a record of unknown shape, as a harness's JSON messages arrive.

/** A field of an unknown record, or undefined. */
export const fieldOf = (value: unknown, key: string): unknown =>
  Predicate.isObject(value) && Predicate.hasProperty(value, key) ? value[key] : void 0;

/** A string field of an unknown record, or null. */
export const textFieldOf = (value: unknown, key: string) => {
  const field = fieldOf(value, key);
  return typeof field === "string" ? field : null;
};

/** A number field of an unknown record, or 0. */
export const numberFieldOf = (value: unknown, key: string) => {
  const field = fieldOf(value, key);
  return typeof field === "number" ? field : 0;
};
