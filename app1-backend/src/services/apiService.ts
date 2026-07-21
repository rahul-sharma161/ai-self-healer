// In-memory stand-in for responses returned by an upstream API.
const responses: Record<string, unknown> = {
  ok: { data: { items: [{ id: 1 }, { id: 2 }] } },
  broken: { error: 'upstream returned 500' },
};

interface ApiResponse {
  data: { items: unknown[] };
}

/** Returns the number of items in the named upstream API response. */
export function countItems(key: string): number {
  const res = responses[key] as ApiResponse;
  return res.data.items.length;
}
