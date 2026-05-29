const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function appPath(path: string) {
  if (!BASE_PATH) return path;
  if (!path.startsWith("/")) return path;
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) return path;
  return `${BASE_PATH}${path}`;
}

export async function apiFetch<T = unknown>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(appPath(input), {
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
