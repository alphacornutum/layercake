export * from "../shared/resolve";

/** Helper bundle: Node callers strip this terminal entrypoint before concatenation. */
export function main(): string {
  return "";
}
