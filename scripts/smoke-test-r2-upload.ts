// Run with: pnpm smoke:r2
// End-to-end check that the photos R2 bucket accepts presigned PUT,
// HEAD-confirms, and DELETE-cleans-up. Bypasses tRPC entirely — talks
// straight to R2 with the same SDK + creds the photoRouter uses.

import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const accountId = process.env.R2_ACCOUNT_ID
const ak = process.env.R2_ACCESS_KEY_ID
const sk = process.env.R2_SECRET_ACCESS_KEY
const bucket = process.env.R2_PHOTOS_BUCKET_NAME

if (!accountId || !ak || !sk || !bucket) {
  console.error('❌ Missing R2 env (need R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,')
  console.error('   R2_SECRET_ACCESS_KEY, R2_PHOTOS_BUCKET_NAME)')
  process.exit(1)
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: ak, secretAccessKey: sk },
})

async function main() {
  const key = `smoke-test/${Date.now()}.bin`
  const payload = new Uint8Array(1024).fill(42)

  console.log(`📤 Generating presigned PUT URL for key: ${key}`)
  const url = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: 'application/octet-stream',
      ContentLength: payload.length,
    }),
    { expiresIn: 300 },
  )

  console.log('⬆️  Uploading 1KB via presigned PUT...')
  const res = await fetch(url, {
    method: 'PUT',
    body: payload,
    headers: { 'Content-Type': 'application/octet-stream' },
  })

  if (!res.ok) {
    console.error(`❌ Upload failed: ${res.status} ${res.statusText}`)
    console.error(await res.text())
    process.exit(1)
  }
  console.log(`✅ Upload success: ${res.status}`)

  console.log('🔍 Verifying with HEAD...')
  const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
  console.log(`✅ Head OK: ${head.ContentLength} bytes`)

  console.log('🗑  Cleaning up test object...')
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }))
  console.log('✅ Cleanup done')

  console.log('\n🎉 R2 upload chain fully working')
}

main().catch((e) => {
  console.error('❌ Smoke failed:', e)
  process.exit(1)
})
