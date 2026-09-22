import { describe, expect, it, beforeEach } from 'vitest'
import { setStorageBackend, createMemoryBackend, writeJSON } from './Storage'
import { DEFAULT_SETTINGS, MAX_SAVED_SERVERS, loadSettings, saveSettings } from './Settings'
import { DEFAULT_SESSION_PORT } from '../network/MultiplayerTypes'

describe('Settings — session address', () => {
  beforeEach(() => setStorageBackend(createMemoryBackend()))

  it('defaults to the port both halves of the project agree on', () => {
    expect(loadSettings().lastSessionPort).toBe(DEFAULT_SESSION_PORT)
    expect(DEFAULT_SETTINGS.lastJoinHost).toBe('127.0.0.1')
  })

  it('round-trips the port and host a player chose', () => {
    saveSettings({ lastSessionPort: 45455, lastJoinHost: 'pi.local' })
    const loaded = loadSettings()
    expect(loaded.lastSessionPort).toBe(45455)
    expect(loaded.lastJoinHost).toBe('pi.local')
  })

  it('round-trips saved addresses, which saveSettings must take whole', () => {
    saveSettings({
      savedServers: [
        { label: 'Alpha', host: '192.168.1.50', port: 45454 },
        { label: '', host: '192.168.1.50', port: 45455 },
      ],
    })
    expect(loadSettings().savedServers).toEqual([
      { label: 'Alpha', host: '192.168.1.50', port: 45454 },
      { label: '', host: '192.168.1.50', port: 45455 },
    ])
  })

  it('hands back a fresh array each load, so a caller mutating it cannot leak', () => {
    const first = loadSettings()
    first.savedServers.push({ label: 'scratch', host: 'x', port: 1 })
    expect(loadSettings().savedServers).toHaveLength(0)
    // The module-level default must be untouched too.
    expect(DEFAULT_SETTINGS.savedServers).toHaveLength(0)
  })

  it('drops stored entries that are not usable addresses', () => {
    // localStorage is hand-editable and survives across versions, so the stored
    // list is untrusted input rather than a SavedServer[].
    writeJSON('settings', {
      savedServers: [
        { label: 'good', host: '10.0.0.5', port: 45454 },
        { label: 'no host', host: '   ', port: 45454 },
        { label: 'port too low', host: '10.0.0.6', port: 80 },
        { label: 'port not a number', host: '10.0.0.7', port: 'abc' },
        { label: 'fractional port', host: '10.0.0.8', port: 45454.5 },
        'not even an object',
        null,
      ],
    })
    expect(loadSettings().savedServers).toEqual([
      { label: 'good', host: '10.0.0.5', port: 45454 },
    ])
  })

  it('caps a runaway stored list', () => {
    writeJSON('settings', {
      savedServers: Array.from({ length: MAX_SAVED_SERVERS + 15 }, (_, i) => ({
        label: `s${i}`,
        host: '10.0.0.1',
        port: 45454,
      })),
    })
    expect(loadSettings().savedServers).toHaveLength(MAX_SAVED_SERVERS)
  })

  it('leaves unrelated settings alone when the address changes', () => {
    saveSettings({ callsign: 'VIPER', glocEnabled: true })
    saveSettings({ lastSessionPort: 45460 })
    const loaded = loadSettings()
    expect(loaded.callsign).toBe('VIPER')
    expect(loaded.glocEnabled).toBe(true)
    expect(loaded.lastSessionPort).toBe(45460)
  })
})
