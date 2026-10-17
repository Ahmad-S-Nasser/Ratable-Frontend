/** What a call to the API gives back, with the API's own error code (for example "reason_required") on failure. */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

type Raw<T> = Promise<{ data?: T; error?: unknown; response: Response }>;

export async function unwrap<T>(call: Raw<T>): Promise<ApiResult<T>> {
  try {
    const { data, error, response } = await call;
    if (response.ok) return { ok: true, data: data as T };
    const code = typeof error === "object" && error !== null && "error" in error ? String((error as { error: unknown }).error) : "unknown";
    return { ok: false, status: response.status, error: code };
  } catch {
    return { ok: false, status: 0, error: "network" };
  }
}

/** Calls that return a file (a proof) are not described by the JSON schema, so they use fetch directly. */
export async function fetchBlob(url: string): Promise<{ ok: true; blob: Blob } | { ok: false; status: number }> {
  try {
    const response = await fetch(url, { credentials: "same-origin" });
    return response.ok ? { ok: true, blob: await response.blob() } : { ok: false, status: response.status };
  } catch {
    return { ok: false, status: 0 };
  }
}
