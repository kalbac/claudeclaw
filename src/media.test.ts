import { describe, it, expect } from 'vitest'
import { buildPhotoMessage, buildDocumentMessage, cleanupOldUploads } from './media.js'

describe('Media', () => {
  it('photo message', () => {
    expect(buildPhotoMessage('/tmp/p.jpg')).toContain('Photo attached')
  })
  it('photo with caption', () => {
    expect(buildPhotoMessage('/tmp/p.jpg', 'cap')).toContain('cap')
  })
  it('document message', () => {
    expect(buildDocumentMessage('/tmp/d.pdf', 'r.pdf')).toContain('Document')
  })
  it('cleanup returns number', () => {
    expect(typeof cleanupOldUploads()).toBe('number')
  })
})
