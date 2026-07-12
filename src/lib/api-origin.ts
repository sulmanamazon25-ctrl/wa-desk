/** Remote API base for split deploy (frontend on one host, API on another). */
export function apiOrigin(): string {
  return (process.env.NEXT_PUBLIC_API_ORIGIN || "").replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  const base = apiOrigin();
  const p = path.startsWith("/") ? path : `/${path}`;
  return base ? `${base}${p}` : p;
}
