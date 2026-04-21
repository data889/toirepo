import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createTRPCRouter, withIpRateLimit, withUserRateLimit } from '../../trpc'
import { bucketName, getS3 } from '@/server/r2/client'

const CreateUploadUrlInputSchema = z.object({
  contentType: z.enum(['image/webp', 'image/jpeg']).default('image/webp'),
  contentLength: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024, 'Photo must be < 10MB'),
  kind: z.enum(['original', 'thumbnail']).default('original'),
})

const GetViewUrlsInputSchema = z.object({
  keys: z.array(z.string().min(1).max(300)).min(1).max(20),
})

export const photoRouter = createTRPCRouter({
  /**
   * Returns a presigned PUT URL for client-side direct upload to a private
   * R2 bucket. Called twice per photo (once for original, once for
   * thumbnail) by M5 Prompt 2's UploadPhoto component.
   */
  createUploadUrl: withUserRateLimit('photo:upload')
    .input(CreateUploadUrlInputSchema)
    .mutation(async ({ ctx, input }) => {
      const photoId = randomUUID()
      const ext = input.contentType === 'image/webp' ? 'webp' : 'jpg'
      const subfolder = input.kind === 'thumbnail' ? 'thumb' : 'orig'
      // Per-user namespacing makes audit logs and lifecycle rules easier
      // (e.g. "delete all photos by banned user X").
      const key = `submissions/${ctx.user.id}/${subfolder}/${photoId}.${ext}`

      const s3 = getS3()
      const command = new PutObjectCommand({
        Bucket: bucketName('photos'),
        Key: key,
        ContentType: input.contentType,
        ContentLength: input.contentLength,
      })
      const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 })

      return {
        photoId,
        key,
        uploadUrl,
        expiresIn: 300,
      }
    }),

  /**
   * Batch-returns presigned GET URLs (1h TTL) for viewing private photos.
   * Photos are stored in a private R2 bucket (decision A.1) — every render
   * path that needs to display a Photo calls this with the relevant keys.
   *
   * Single batch endpoint avoids N round-trips when a page shows multiple
   * photos: one toilet × 4 photos × 2 (original + thumbnail) = up to 8 keys.
   *
   * Public procedure (M7 P2.1): anonymous visitors opening a toilet drawer
   * need to see the photos as part of the signal for "is this place real /
   * usable." Gating views behind login killed UX for the read-only browse
   * flow. Defenses against scraping presigned URLs:
   *  - IP-based rate limit (`photo:view`, 60/min/IP) — see ratelimit/limits.ts
   *  - 1h presigned TTL caps the value of any leaked URL
   *  - R2 bandwidth monitoring lives at the bucket level
   * If scraping shows up, downgrade options include session-gated viewing
   * for non-thumbnail keys or per-IP daily caps on top of the per-min cap.
   */
  getViewUrls: withIpRateLimit('photo:view')
    .input(GetViewUrlsInputSchema)
    .query(async ({ input }) => {
      const s3 = getS3()
      const bucket = bucketName('photos')
      const results: Record<string, string> = {}
      await Promise.all(
        input.keys.map(async (key) => {
          const command = new GetObjectCommand({ Bucket: bucket, Key: key })
          results[key] = await getSignedUrl(s3, command, { expiresIn: 3600 })
        }),
      )
      return results
    }),
})
