import type { NetworkInterfaceInfo } from 'os'

/**
 * Node 18+ changed os.networkInterfaces() to return family as the number 4
 * instead of the string 'IPv4'. Accept both forms.
 */
function isIPv4(family: string | number): boolean {
  return family === 'IPv4' || family === 4
}

function isLinkLocal(address: string): boolean {
  return address.startsWith('169.254.')
}

function isRfc1918(address: string): boolean {
  if (address.startsWith('10.')) return true
  if (address.startsWith('192.168.')) return true
  // 172.16.0.0/12 — 172.16.x.x through 172.31.x.x
  const second = parseInt(address.split('.')[1] ?? '0', 10)
  if (address.startsWith('172.') && second >= 16 && second <= 31) return true
  return false
}

// Prefer well-known LAN interface names (en0/en1 on macOS, eth0/wlan0 on
// Linux, Ethernet/Wi-Fi on Windows) over VPN tunnels (utun, tun, tap)
// and virtual/bridge interfaces.
function isPreferredIface(name: string): boolean {
  return /^(en\d|eth\d|wlan\d|Wi-Fi|Ethernet)/.test(name)
}

function isVirtualIface(name: string): boolean {
  return /^(utun|tun|tap|bridge|vmnet|veth|docker|lo)/.test(name)
}

/**
 * Return the best LAN IPv4 address to display as the host IP for multiplayer.
 *
 * Priority:
 *   1. Non-internal IPv4 on a preferred interface (en0, eth0, wlan0, …)
 *      that is also an RFC1918 address and not link-local
 *   2. Any non-internal, non-link-local RFC1918 IPv4
 *   3. Any non-internal, non-link-local IPv4 (covers unusual subnets)
 *   4. Fallback: 127.0.0.1
 */
export function getPrimaryLanIp(
  ifaces: NodeJS.Dict<NetworkInterfaceInfo[]>,
): string {
  const candidates: Array<{ address: string; preferred: boolean }> = []

  for (const [name, items] of Object.entries(ifaces)) {
    if (isVirtualIface(name)) continue
    for (const info of items ?? []) {
      if (!isIPv4(info.family)) continue
      if (info.internal) continue
      if (isLinkLocal(info.address)) continue
      candidates.push({
        address: info.address,
        preferred: isPreferredIface(name) && isRfc1918(info.address),
      })
    }
  }

  const preferred = candidates.find(c => c.preferred)
  if (preferred) return preferred.address

  const rfc1918 = candidates.find(c => isRfc1918(c.address))
  if (rfc1918) return rfc1918.address

  if (candidates.length > 0) return candidates[0]!.address

  return '127.0.0.1'
}
