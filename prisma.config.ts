import 'dotenv/config'
import { defineConfig } from 'prisma/config'
import { PrismaPg } from '@prisma/adapter-pg'

// Prisma 7 no longer accepts `url` / `directUrl` in schema.prisma's datasource.
// The CLI (migrate, db push, etc.) connects via `migrations.adapter` AND still
// requires `datasource.url` for shadow-db / schema diff operations.
// Runtime PrismaClient is constructed separately in src/server/db.ts with its
// own adapter instance.

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    adapter: async () =>
      new PrismaPg({
        connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
      }),
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
})
