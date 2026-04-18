import 'dotenv/config'
import { defineConfig } from 'prisma/config'

// Prisma 7 no longer accepts `url` / `directUrl` in schema.prisma's datasource.
// The CLI (migrate, db push, etc.) connects via `datasource.url` here.
// The `adapter` pattern (@prisma/adapter-pg) is a RUNTIME concern — applied
// when constructing PrismaClient in src/server/db.ts — and not a field on
// this CLI config's migrations block (typings exclude it).
// Prefer DIRECT_URL (no pooler) then fall back to DATABASE_URL.

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
})
