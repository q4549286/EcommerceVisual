export async function apiFetch<T = unknown>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {})
    }
  });
  let data: { ok?: boolean; error?: string } & Record<string, unknown> = {};
  try {
    data = await response.json();
  } catch {
    data = { ok: response.ok };
  }
  if (!response.ok || data.ok === false) {
    throw new Error(typeof data.error === "string" ? data.error : `请求失败（${response.status}）`);
  }
  return data as T;
}
