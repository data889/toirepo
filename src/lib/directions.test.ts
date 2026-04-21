import { describe, it, expect } from 'vitest'
import { buildDirectionsUrl, detectMapsProvider } from './directions'

describe('detectMapsProvider', () => {
  it('detects iPhone as apple', () => {
    expect(
      detectMapsProvider(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605 Safari/605',
      ),
    ).toBe('apple')
  })

  it('detects iPad as apple', () => {
    expect(
      detectMapsProvider(
        'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605 Safari/605',
      ),
    ).toBe('apple')
  })

  it('detects macOS Safari as apple', () => {
    expect(
      detectMapsProvider(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605 Version/17 Safari/605',
      ),
    ).toBe('apple')
  })

  it('detects macOS Chrome as google (not Safari)', () => {
    expect(
      detectMapsProvider(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537 Chrome/126 Safari/537',
      ),
    ).toBe('google')
  })

  it('detects Android Chrome as google', () => {
    expect(
      detectMapsProvider(
        'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537 Chrome/126 Mobile Safari/537',
      ),
    ).toBe('google')
  })

  it('detects Windows Firefox as google', () => {
    expect(detectMapsProvider('Mozilla/5.0 (Windows NT 10.0) Gecko/20100101 Firefox/128')).toBe(
      'google',
    )
  })
})

describe('buildDirectionsUrl', () => {
  const tokyoStation = { latitude: 35.6812, longitude: 139.7671 }

  it('builds Apple Maps walking URL', () => {
    expect(buildDirectionsUrl(tokyoStation, 'apple')).toBe(
      'maps://?daddr=35.6812,139.7671&dirflg=w',
    )
  })

  it('builds Google Maps walking URL', () => {
    expect(buildDirectionsUrl(tokyoStation, 'google')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=35.6812,139.7671&travelmode=walking',
    )
  })
})
