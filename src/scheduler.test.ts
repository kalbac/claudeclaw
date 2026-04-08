import { describe, it, expect } from 'vitest'
import { computeNextRun } from './scheduler.js'

describe('Scheduler', () => {
  it('valid cron', () => {
    expect(computeNextRun('0 9 * * *')).toBeGreaterThan(0)
  })
  it('every minute', () => {
    const nr = computeNextRun('* * * * *')
    const now = Math.floor(Date.now() / 1000)
    expect(nr).toBeGreaterThan(now - 1)
    expect(nr).toBeLessThanOrEqual(now + 61)
  })
  it('weekday cron', () => {
    expect(computeNextRun('0 9 * * 1-5')).toBeGreaterThan(0)
  })
  it('invalid cron fallback', () => {
    const nr = computeNextRun('invalid')
    const now = Math.floor(Date.now() / 1000)
    expect(nr).toBeGreaterThan(now)
    expect(nr).toBeLessThanOrEqual(now + 7200)
  })
})
