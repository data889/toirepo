// Upload the Tokyo pmtiles subset from T7 Shield to Cloudflare R2.
// Run: pnpm pmtiles:upload  (reads R2_* from .env.local via --env-file)

import { readFile, stat } from 'node:fs/promises'
import { HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const ACCESS_KEY = process.env.R2_ACCESS_KEY_ID
const SECRET_KEY = process.env.R2_SECRET_ACCESS_KEY
const BUCKET = process.env.R2_BUCKET_NAME
const PUBLIC_URL = process.env.R2_PUBLIC_URL

if (!ACCOUNT_ID || !ACCESS_KEY || !SECRET_KEY || !BUCKET || !PUBLIC_URL) {
  console.error('❌ Missing R2 env vars. Check .env.local for:')
  console.error('   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,')
  console.error('   R2_BUCKET_NAME, R2_PUBLIC_URL')
  process.exit(1)
}

const LOCAL_FILE = '/Volumes/T7 Shield/toirepo-data/processed/tokyo.pmtiles'
const REMOTE_KEY = 'tokyo.pmtiles'

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
})

async function main() {
  const stats = await stat(LOCAL_FILE).catch(() => null)
  if (!stats) {
    console.error(`❌ ${LOCAL_FILE} does not exist.`)
    console.error('   Run `pnpm pmtiles:extract` first.')
    process.exit(1)
  }

  const sizeMB = (stats.size / 1024 / 1024).toFixed(1)
  console.log(`📦 Local file: ${LOCAL_FILE} (${sizeMB} MB)`)

  // Single-shot PutObject tops out at 5GB. Above that we'd need
  // CreateMultipartUpload + UploadPart + CompleteMultipartUpload, which
  // this script does not implement. Tokyo-region subsets are well under
  // 5GB so this is a guard, not a constraint.
  if (stats.size > 5 * 1024 * 1024 * 1024) {
    console.error('❌ File > 5GB — single-part PutObject unsupported. Needs multipart upload.')
    process.exit(1)
  }

  // Probe for an existing remote object so the operator knows they're
  // overwriting.
  const existing = await s3
    .send(new HeadObjectCommand({ Bucket: BUCKET, Key: REMOTE_KEY }))
    .catch(() => null)

  if (existing) {
    const existingMB = (Number(existing.ContentLength) / 1024 / 1024).toFixed(1)
    console.log(`⚠️  Remote already has ${REMOTE_KEY} (${existingMB} MB) — will overwrite`)
  }

  console.log('⬆️  Uploading to R2...')
  const body = await readFile(LOCAL_FILE)

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: REMOTE_KEY,
      Body: body,
      ContentType: 'application/vnd.pmtiles',
      // 7 days in seconds. MapLibre + pmtiles.js issues many small Range
      // requests — a short-to-medium cache window keeps origin load down
      // while still letting us push updates within a week.
      CacheControl: 'public, max-age=604800',
    }),
  )

  console.log('✅ Upload complete')
  console.log(`   Public URL: ${PUBLIC_URL}/${REMOTE_KEY}`)
  console.log('')
  console.log('Next: pnpm pmtiles:verify')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
