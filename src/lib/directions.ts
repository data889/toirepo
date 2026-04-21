// Build a walking-directions URL that opens in the OS-native maps
// app when possible (Apple Maps on iOS / macOS Safari), else falls
// back to Google Maps web (every other browser). Intentionally does
// NOT support in-app navigation — SPEC §1.3 explicitly rules it out;
// we just hand off to a nav app the user already trusts.
//
// Detection is UA-based because there's no feature-test for
// "maps:// opens". On misdetection the user sees a broken link, so we
// err toward the safer fallback: only return the maps:// scheme for
// iOS + macOS Safari, where AppleMaps has been installed by default
// since OS X 10.9 / iOS 6.

export interface DirectionsCoord {
  latitude: number
  longitude: number
}

export type MapsProvider = 'apple' | 'google'

export function detectMapsProvider(userAgent: string): MapsProvider {
  const ua = userAgent.toLowerCase()
  // iPhone / iPad always get Apple Maps.
  if (/iphone|ipad|ipod/.test(ua)) return 'apple'
  // macOS Safari (not Chrome/Firefox on Mac — they don't trust
  // maps:// by default).
  const isMac = /macintosh|mac os x/.test(ua)
  const isSafari = /safari/.test(ua) && !/chrome|crios|fxios|edg/.test(ua)
  if (isMac && isSafari) return 'apple'
  return 'google'
}

/**
 * Walking-directions URL. `dirflg=w` = walking (Apple Maps);
 * `travelmode=walking` (Google Maps).
 */
export function buildDirectionsUrl(coord: DirectionsCoord, provider: MapsProvider): string {
  const { latitude, longitude } = coord
  if (provider === 'apple') {
    return `maps://?daddr=${latitude},${longitude}&dirflg=w`
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=walking`
}

/** Convenience combinator for the common case. */
export function openDirections(coord: DirectionsCoord, userAgent: string): string {
  return buildDirectionsUrl(coord, detectMapsProvider(userAgent))
}
