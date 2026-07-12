export function verifyAdminAuth(req: Request): boolean {
  const expected = process.env.ADMIN_API_KEY?.trim();
  if (!expected) return false;
  const auth = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return auth === expected;
}

export function adminUnauthorized(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
