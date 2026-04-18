// Verify the uploaded pmtiles is HTTP-Range-accessible from R2's public URL
// and that the file's magic bytes are intact. This is what MapLibre +
// pmtiles.js needs to render the basemap.

const PUBLIC_URL = process.env.R2_PUBLIC_URL
const KEY = 'tokyo.pmtiles'

if (!PUBLIC_URL) {
  console.error('❌ Missing R2_PUBLIC_URL')
  process.exit(1)
}

const url = `${PUBLIC_URL}/${KEY}`
console.log(`🔍 Verifying pmtiles HTTP Range at: ${url}`)

async function main() {
  // 1. HEAD to confirm the object exists and R2 advertises Range support.
  const head = await fetch(url, { method: 'HEAD' })
  if (!head.ok) {
    console.error(`❌ HEAD ${head.status} ${head.statusText}`)
    process.exit(1)
  }
  const size = head.headers.get('content-length')
  const acceptRanges = head.headers.get('accept-ranges')
  console.log(`   Content-Length: ${size}`)
  console.log(`   Accept-Ranges:  ${acceptRanges}`)

  if (acceptRanges !== 'bytes') {
    console.error('❌ R2 did not advertise Accept-Ranges: bytes')
    process.exit(1)
  }

  // 2. GET with Range: bytes=0-15 — pmtiles header lives at offset 0, and
  // the first 7 bytes are the "PMTiles" magic.
  const range = await fetch(url, { headers: { Range: 'bytes=0-15' } })

  if (range.status !== 206) {
    console.error(`❌ Range request expected 206 Partial Content, got ${range.status}`)
    process.exit(1)
  }

  const buf = new Uint8Array(await range.arrayBuffer())
  const magic = new TextDecoder().decode(buf.slice(0, 7))

  if (magic !== 'PMTiles') {
    console.error(`❌ Magic bytes mismatch: got "${magic}" expected "PMTiles"`)
    process.exit(1)
  }

  console.log('✅ Range request works (HTTP 206)')
  console.log('✅ Magic bytes correct (PMTiles)')
  console.log('')
  console.log('pmtiles is MapLibre-ready over the pmtiles:// protocol.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
