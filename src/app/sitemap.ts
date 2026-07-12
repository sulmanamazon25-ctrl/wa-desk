import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://wasup.com";

const ROUTES = [
  "",
  "/pricing",
  "/download",
  "/how-it-works",
  "/for/small-business",
  "/contact",
  "/support",
  "/vs/wati",
  "/vs/respond-io",
  "/vs/interakt",
  "/terms",
  "/privacy",
  "/acceptable-use",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ROUTES.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path.startsWith("/vs") ? 0.7 : 0.8,
  }));
}
