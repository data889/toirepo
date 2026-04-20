// Server-only by directory convention (src/server/). Centralized R2 S3
// client + bucket-name resolver — separates the basemap (tiles) bucket
// from the user-photo bucket so credentials may be split later.
//
// Note: no `'server-only'` import marker. Same trade-off as
// src/server/ratelimit/* — tsx-run scripts (e.g. scripts/upload-pmtiles.ts)
// import this transitively, and 'server-only' throws outside Next.js runtime.

import { S3Client } from '@aws-sdk/client-s3'

type BucketKind = 'tiles' | 'photos'

function requireEnv(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`Missing env: ${key}`)
  return v
}

let _s3: S3Client | null = null

export function getS3(): S3Client {
  if (_s3) return _s3
  _s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${requireEnv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: requireEnv('R2_SECRET_ACCESS_KEY'),
    },
  })
  return _s3
}

export function bucketName(kind: BucketKind): string {
  return kind === 'tiles' ? requireEnv('R2_BUCKET_NAME') : requireEnv('R2_PHOTOS_BUCKET_NAME')
}
