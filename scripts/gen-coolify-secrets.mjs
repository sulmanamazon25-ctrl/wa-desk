#!/usr/bin/env node
/** Print random secrets for Coolify / .env.admin.local setup */
import { randomBytes } from "node:crypto";

console.log("Paste into Coolify env + .env.admin.local:\n");
console.log(`WA_DB_PASSWORD=${randomBytes(24).toString("base64url")}`);
console.log(`LICENSE_SIGNING_SECRET=${randomBytes(32).toString("hex")}`);
console.log(`ADMIN_API_KEY=${randomBytes(32).toString("hex")}`);
