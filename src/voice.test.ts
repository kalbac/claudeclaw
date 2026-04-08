import { describe, it, expect } from 'vitest'
import { voiceCapabilities } from './voice.js'

describe('Voice', () => {
  it('reports capabilities', () => {
    const caps = voiceCapabilities()
    expect(caps).toHaveProperty('stt')
    expect(typeof caps.stt).toBe('boolean')
  })
})
