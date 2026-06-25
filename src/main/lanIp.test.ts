import { describe, it, expect } from 'vitest'
import type { NetworkInterfaceInfo } from 'os'
import { getPrimaryLanIp } from './lanIp'

type Ifaces = NodeJS.Dict<NetworkInterfaceInfo[]>

function iface(
  address: string,
  opts: Partial<NetworkInterfaceInfo> = {},
): NetworkInterfaceInfo {
  return {
    address,
    netmask: '255.255.255.0',
    family: 'IPv4',
    mac: '00:00:00:00:00:00',
    internal: false,
    cidr: null,
    ...opts,
  } as NetworkInterfaceInfo
}

describe('getPrimaryLanIp', () => {
  it('returns 127.0.0.1 when no interfaces', () => {
    expect(getPrimaryLanIp({})).toBe('127.0.0.1')
  })

  it('returns 127.0.0.1 when only loopback exists', () => {
    const ifaces: Ifaces = { lo: [iface('127.0.0.1', { internal: true })] }
    expect(getPrimaryLanIp(ifaces)).toBe('127.0.0.1')
  })

  it('picks the en0 address on a typical macOS machine', () => {
    const ifaces: Ifaces = {
      lo0: [iface('127.0.0.1', { internal: true })],
      en0: [iface('192.168.1.42')],
      utun0: [iface('10.8.0.2')],   // VPN tunnel — should be skipped
    }
    expect(getPrimaryLanIp(ifaces)).toBe('192.168.1.42')
  })

  it('skips VPN tunnel when en0 is also present (utun wins without fix)', () => {
    // utun appears first alphabetically but should be excluded
    const ifaces: Ifaces = {
      en0: [iface('192.168.0.10')],
      utun2: [iface('100.64.0.1')],
    }
    expect(getPrimaryLanIp(ifaces)).toBe('192.168.0.10')
  })

  it('handles Node 18+ numeric family value of 4', () => {
    const ifaces: Ifaces = {
      en0: [iface('10.0.0.5', { family: 4 as unknown as 'IPv4' })],
    }
    expect(getPrimaryLanIp(ifaces)).toBe('10.0.0.5')
  })

  it('skips link-local (169.254.x.x) addresses', () => {
    const ifaces: Ifaces = {
      en1: [iface('169.254.1.1'), iface('192.168.5.5')],
    }
    expect(getPrimaryLanIp(ifaces)).toBe('192.168.5.5')
  })

  it('falls back to first non-link-local IPv4 when no RFC1918 address exists', () => {
    const ifaces: Ifaces = {
      en0: [iface('203.0.113.7')],  // public IP (unusual but possible)
    }
    expect(getPrimaryLanIp(ifaces)).toBe('203.0.113.7')
  })

  it('picks eth0 address on Linux', () => {
    const ifaces: Ifaces = {
      lo: [iface('127.0.0.1', { internal: true })],
      eth0: [iface('192.168.100.20')],
    }
    expect(getPrimaryLanIp(ifaces)).toBe('192.168.100.20')
  })

  it('picks wlan0 on Linux when eth0 is absent', () => {
    const ifaces: Ifaces = {
      wlan0: [iface('172.20.0.55')],
    }
    expect(getPrimaryLanIp(ifaces)).toBe('172.20.0.55')
  })

  it('falls back to RFC1918 address on non-preferred interface when no preferred exists', () => {
    const ifaces: Ifaces = {
      // No en*/eth*/wlan* interface — only a named corporate adapter
      'Ethernet 2': [iface('10.10.10.10')],
    }
    expect(getPrimaryLanIp(ifaces)).toBe('10.10.10.10')
  })
})
