'use client'

// Client-side image pipeline for toilet submissions. Runs in the browser
// before R2 upload to achieve two goals:
//   1. Strip EXIF (location, camera, timestamp) — Canvas redraw drops all
//      metadata because only pixel data is re-encoded.
//   2. Normalize size/format — WebP @ configured quality + max-edge clamp
//      keeps the private bucket small and render latency low.

export interface ProcessedImage {
  blob: Blob
  width: number
  height: number
  sizeBytes: number
}

// Hard cap on input file size — applied before decode so we reject
// multi-hundred-MB HEIC dumps from phones without spending memory on them.
const MAX_INPUT_BYTES = 15 * 1024 * 1024

const ORIGINAL_MAX_EDGE = 1920
const ORIGINAL_QUALITY = 0.8
const THUMBNAIL_MAX_EDGE = 400
const THUMBNAIL_QUALITY = 0.6

async function loadImage(file: File): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error('Failed to decode image'))
      img.src = url
    })
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

function fitToMaxEdge(
  width: number,
  height: number,
  maxEdge: number,
): { width: number; height: number } {
  if (width <= maxEdge && height <= maxEdge) return { width, height }
  if (width >= height) {
    const ratio = maxEdge / width
    return { width: maxEdge, height: Math.round(height * ratio) }
  }
  const ratio = maxEdge / height
  return { width: Math.round(width * ratio), height: maxEdge }
}

async function redrawToWebP(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  quality: number,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight
  const ctx = canvas.getContext('2d', { alpha: false })
  if (!ctx) throw new Error('Canvas 2D context unavailable')

  // Opaque white fill first — if the source has alpha, flattening here
  // prevents a greyscale-tinted output when the WebP encoder drops alpha.
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, targetWidth, targetHeight)
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight)

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', quality)
  })
  if (!blob) throw new Error('Canvas encode returned null blob')
  return blob
}

export async function processImageForUpload(file: File): Promise<{
  original: ProcessedImage
  thumbnail: ProcessedImage
}> {
  if (!file.type.startsWith('image/')) {
    throw new Error('File is not an image')
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('File is too large (max 15MB input)')
  }

  const img = await loadImage(file)

  const origDims = fitToMaxEdge(img.naturalWidth, img.naturalHeight, ORIGINAL_MAX_EDGE)
  const originalBlob = await redrawToWebP(img, origDims.width, origDims.height, ORIGINAL_QUALITY)

  const thumbDims = fitToMaxEdge(img.naturalWidth, img.naturalHeight, THUMBNAIL_MAX_EDGE)
  const thumbnailBlob = await redrawToWebP(
    img,
    thumbDims.width,
    thumbDims.height,
    THUMBNAIL_QUALITY,
  )

  return {
    original: {
      blob: originalBlob,
      width: origDims.width,
      height: origDims.height,
      sizeBytes: originalBlob.size,
    },
    thumbnail: {
      blob: thumbnailBlob,
      width: thumbDims.width,
      height: thumbDims.height,
      sizeBytes: thumbnailBlob.size,
    },
  }
}

export async function uploadViaPresignedUrl(url: string, blob: Blob): Promise<void> {
  const res = await fetch(url, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': blob.type },
  })
  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status} ${res.statusText}`)
  }
}
