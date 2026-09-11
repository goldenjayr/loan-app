import { describe, expect, it } from 'vitest'
import { generateShareToken, shareUrlForToken } from '@/lib/share-links'

describe('share link helpers', () => {
  it('generates opaque URL-safe tokens of sufficient length', () => {
    const a = generateShareToken()
    const b = generateShareToken()
    expect(a).not.toEqual(b)
    expect(a.length).toBeGreaterThanOrEqual(30)
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/)
  })

  it('builds share URLs from origin + token', () => {
    expect(shareUrlForToken('abcTOKEN', 'https://loans.dongje.app')).toBe(
      'https://loans.dongje.app/share/abcTOKEN'
    )
    expect(shareUrlForToken('abcTOKEN')).toBe('/share/abcTOKEN')
  })
})
