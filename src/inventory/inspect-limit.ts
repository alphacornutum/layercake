/** Default UTF-8 byte ceiling for inspect tool success payloads (512 KiB). */
export const DEFAULT_INSPECT_MAX_BYTES = 524_288;

export class InspectSizeError extends Error {
  readonly size: number;
  readonly limit: number;

  constructor(size: number, limit: number) {
    super(
      `Inspect result exceeds size limit (${size} bytes > ${limit} bytes). ` +
        `Retry with a leaner detail (e.g. "overview") and/or narrower matchNames.`,
    );
    this.name = "InspectSizeError";
    this.size = size;
    this.limit = limit;
  }
}

/** Stringify `value` as JSON and hard-error if UTF-8 byte length exceeds `limit`. */
export function assertInspectWithinLimit(value: unknown, limit: number): string {
  const text = JSON.stringify(value, null, 2);
  const size = Buffer.byteLength(text, "utf8");
  if (size > limit) {
    throw new InspectSizeError(size, limit);
  }
  return text;
}
