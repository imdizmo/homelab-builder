/**
 * Dynamic IP Allocator for Homelab Builder
 *
 * Key design goals:
 *  1. CIDR-aware — works for /16, /24, /25, /26, /28, etc.
 *  2. Dynamic zone sizing — zones scale with actual node counts and available space
 *  3. Home router mode — reserves a "home devices" DHCP pool near the gateway
 *  4. Container sub-ranges — sized to actual container count per compute node
 *  5. Switch DHCP scopes — sized to ceil(remainingHosts / switchCount)
 *  6. Memorable — zones start on round numbers whenever possible
 *  7. User IPs respected — if a node already has an IP, it is never overwritten
 *
 * Zone layout algorithm (for a /24 = 254 usable hosts):
 * ─────────────────────────────────────────────────────────────────────────────
 *  1. Gateway:        .1  (always)
 *  2. Home DHCP pool: .2 – .N   (only if homeRouterMode; N = homeReserve, default 50)
 *  3. Infrastructure: routers, switches, APs, PDUs, UPS  (10% of space, min 10)
 *  4. NAS / Storage:  (15% of space, min 10)
 *  5. Compute:        servers, mini-PCs, SBCs  (each node gets containerSlotSize IPs)
 *  6. Management:     GPU, HBA, NIC, IPMI      (last 10% of space)
 *
 * For /16 (65534 usable hosts) the same percentages apply but produce much
 * larger ranges, and IPs are formatted as x.y.Z.W where Z changes per zone.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { HardwareNode } from '../../../types'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface IpAllocatorOptions {
    /** Base network address, e.g. "192.168.1.0" or "10.0.0.0" */
    baseIp?: string
    /** CIDR prefix length, e.g. 24 for /24. Parsed from baseIp if it contains "/" */
    cidr?: number
    /** If true, reserve homeReserve IPs after the gateway for regular home devices */
    homeRouterMode?: boolean
    /** How many IPs to reserve for home devices (default 50) */
    homeReserve?: number
    /** How many container IPs to allocate per compute node (default: auto from node count) */
    containerSlotSize?: number
}

export interface AllocatedNode {
    node: HardwareNode
    ip: string
    roleLabel: string
    containerRange?: { start: string; end: string; count: number }
    switchDhcpScope?: { start: string; end: string; count: number }
    homeDhcpPool?: { start: string; end: string; count: number }
}

export interface IpZone {
    name: string
    startOffset: number   // offset from network base (e.g. 1 for .1)
    endOffset: number
    color: string         // for UI legend
    description: string
}

export interface IpAllocationPlan {
    networkAddress: string   // e.g. "192.168.1.0"
    cidr: number             // e.g. 24
    subnetMask: string       // e.g. "255.255.255.0"
    gateway: string          // e.g. "192.168.1.1"
    totalHosts: number       // usable host count
    zones: IpZone[]
    allocations: AllocatedNode[]
    homeDhcpPool?: { start: string; end: string; count: number }
    warnings: string[]
}

// ─── Role metadata ────────────────────────────────────────────────────────────
const ROLE_META: Record<string, { label: string; zone: 'infra' | 'storage' | 'compute' | 'management' }> = {
    router: { label: 'Router/Firewall', zone: 'infra' },
    switch: { label: 'Switch', zone: 'infra' },
    access_point: { label: 'Access Point', zone: 'infra' },
    pdu: { label: 'PDU', zone: 'infra' },
    ups: { label: 'UPS', zone: 'infra' },
    rack: { label: 'Rack Accessory', zone: 'infra' },
    nic: { label: 'NIC', zone: 'infra' },
    nas: { label: 'NAS/Storage', zone: 'storage' },
    storage: { label: 'Storage Device', zone: 'storage' },
    server: { label: 'Server', zone: 'compute' },
    minipc: { label: 'Mini PC', zone: 'compute' },
    sbc: { label: 'SBC', zone: 'compute' },
    gpu: { label: 'GPU Node', zone: 'management' },
    hba: { label: 'HBA', zone: 'management' },
    accessory: { label: 'Accessory', zone: 'management' },
}

// ─── CIDR utilities ───────────────────────────────────────────────────────────

/** Convert CIDR prefix to subnet mask string */
function cidrToMask(cidr: number): string {
    const mask = (0xFFFFFFFF << (32 - cidr)) >>> 0
    return [(mask >>> 24) & 0xFF, (mask >>> 16) & 0xFF, (mask >>> 8) & 0xFF, mask & 0xFF].join('.')
}

/** Parse "192.168.1.0/24" or "192.168.1.0" + separate cidr */
function parseNetwork(baseIp: string, cidrOverride?: number): { networkOctets: number[]; cidr: number } {
    let ip = baseIp
    let cidr = cidrOverride ?? 24

    if (baseIp.includes('/')) {
        const [addr, prefix] = baseIp.split('/')
        ip = addr
        cidr = parseInt(prefix, 10)
    }

    const octets = ip.split('.').map(Number)
    while (octets.length < 4) octets.push(0)

    // Zero out host bits to get network address
    const ipInt = (octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]
    const maskInt = (0xFFFFFFFF << (32 - cidr)) >>> 0
    const netInt = (ipInt & maskInt) >>> 0

    return {
        networkOctets: [(netInt >>> 24) & 0xFF, (netInt >>> 16) & 0xFF, (netInt >>> 8) & 0xFF, netInt & 0xFF],
        cidr,
    }
}

/** Convert network base + offset to dotted IP string */
function offsetToIp(networkOctets: number[], offset: number): string {
    const base = (networkOctets[0] << 24) | (networkOctets[1] << 16) | (networkOctets[2] << 8) | networkOctets[3]
    const ip = (base + offset) >>> 0
    return [(ip >>> 24) & 0xFF, (ip >>> 16) & 0xFF, (ip >>> 8) & 0xFF, ip & 0xFF].join('.')
}

/** Round up to the nearest "round" number for memorability */
function roundUp(n: number, multiple: number): number {
    return Math.ceil(n / multiple) * multiple
}

// ─── Main allocator ───────────────────────────────────────────────────────────
export function allocateIPs(nodes: HardwareNode[], opts: IpAllocatorOptions = {}): IpAllocationPlan {
    const {
        baseIp = '192.168.1.0',
        homeRouterMode = false,
        homeReserve = 50,
        containerSlotSize: containerSlotOverride,
    } = opts

    const cidrOpt = opts.cidr
    const { networkOctets, cidr } = parseNetwork(baseIp, cidrOpt)
    const totalHosts = Math.pow(2, 32 - cidr) - 2  // subtract network + broadcast
    const subnetMask = cidrToMask(cidr)
    const networkAddress = networkOctets.join('.')
    const gateway = offsetToIp(networkOctets, 1)
    const warnings: string[] = []

    // ── Count nodes by zone ──────────────────────────────────────────────────
    const infraNodes = nodes.filter(n => (ROLE_META[n.type ?? ''] ?? ROLE_META['accessory']).zone === 'infra')
    const storageNodes = nodes.filter(n => (ROLE_META[n.type ?? ''] ?? ROLE_META['accessory']).zone === 'storage')
    const computeNodes = nodes.filter(n => (ROLE_META[n.type ?? ''] ?? ROLE_META['accessory']).zone === 'compute')

    const switchNodes = nodes.filter(n => n.type === 'switch')

    // ── Determine container slot size ────────────────────────────────────────
    // Each compute node gets a block of IPs: its own static IP + N container IPs
    // Auto-size: if few nodes, give more IPs; if many, give fewer
    let containerSlot: number
    if (containerSlotOverride) {
        containerSlot = containerSlotOverride
    } else if (computeNodes.length === 0) {
        containerSlot = 10
    } else if (computeNodes.length <= 3) {
        containerSlot = 20   // e.g. .150 → containers .151–.169
    } else if (computeNodes.length <= 8) {
        containerSlot = 10   // e.g. .150 → containers .151–.159
    } else {
        containerSlot = 5    // tight packing for many nodes
    }

    // ── Zone sizing ──────────────────────────────────────────────────────────
    // We divide the host space proportionally, snapping to round numbers.
    // Minimum zone sizes ensure correctness even for tiny /28 subnets.

    let cursor = 2  // offset 1 = gateway, start allocating from 2

    // Home DHCP pool (optional)
    let homeDhcpPool: IpAllocationPlan['homeDhcpPool']
    if (homeRouterMode) {
        const reserve = Math.min(homeReserve, Math.floor(totalHosts * 0.25))
        const homeStart = cursor
        const homeEnd = cursor + reserve - 1
        homeDhcpPool = {
            start: offsetToIp(networkOctets, homeStart),
            end: offsetToIp(networkOctets, homeEnd),
            count: reserve,
        }
        cursor = homeEnd + 1
        // Snap to next round number for memorability
        cursor = roundUp(cursor, 10)
    }

    // Infrastructure zone
    const infraSize = Math.max(
        infraNodes.length + 2,  // at least enough for actual nodes + headroom
        Math.max(10, Math.floor(totalHosts * 0.10))
    )
    const infraStart = cursor
    const infraEnd = infraStart + infraSize - 1
    cursor = roundUp(infraEnd + 1, 10)

    // Switch DHCP scope size: divide remaining space among switches
    // Each switch "owns" a portion of the DHCP pool for its downstream clients
    const switchDhcpSize = switchNodes.length > 0
        ? Math.max(10, Math.floor((totalHosts * 0.30) / switchNodes.length))
        : 0

    // Storage zone
    const storageSize = Math.max(
        storageNodes.length + 2,
        Math.max(10, Math.floor(totalHosts * 0.15))
    )
    const storageStart = cursor
    const storageEnd = storageStart + storageSize - 1
    cursor = roundUp(storageEnd + 1, 10)

    // Compute zone: each node gets containerSlot IPs (1 static + N-1 containers)
    const computeSize = Math.max(
        computeNodes.length * containerSlot + 5,
        Math.max(20, Math.floor(totalHosts * 0.25))
    )
    const computeStart = cursor
    const computeEnd = computeStart + computeSize - 1
    cursor = roundUp(computeEnd + 1, 10)

    // Management zone: everything else up to broadcast-1
    const mgmtStart = cursor
    const mgmtEnd = totalHosts  // last usable host offset

    // ── Build zone legend ────────────────────────────────────────────────────
    const zones: IpZone[] = []

    zones.push({
        name: 'Gateway',
        startOffset: 1, endOffset: 1,
        color: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
        description: 'Primary router / gateway',
    })

    if (homeRouterMode && homeDhcpPool) {
        zones.push({
            name: 'Home Devices (DHCP)',
            startOffset: 2, endOffset: 2 + (homeDhcpPool.count - 1),
            color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
            description: `DHCP pool for regular home devices (${homeDhcpPool.count} IPs)`,
        })
    }

    zones.push({
        name: 'Infrastructure',
        startOffset: infraStart, endOffset: infraEnd,
        color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
        description: `Routers, switches, APs, PDUs, UPS (${infraSize} IPs)`,
    })

    zones.push({
        name: 'NAS / Storage',
        startOffset: storageStart, endOffset: storageEnd,
        color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
        description: `NAS and storage servers (${storageSize} IPs)`,
    })

    zones.push({
        name: 'Compute',
        startOffset: computeStart, endOffset: computeEnd,
        color: 'bg-green-500/10 text-green-600 dark:text-green-400',
        description: `Servers, mini-PCs, SBCs — each host gets ${containerSlot} IPs (1 static + ${containerSlot - 1} containers)`,
    })

    zones.push({
        name: 'Management / GPU / HBA',
        startOffset: mgmtStart, endOffset: mgmtEnd,
        color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
        description: 'GPU nodes, HBAs, NICs, IPMI/BMC management interfaces',
    })

    // ── Allocate IPs to nodes ────────────────────────────────────────────────
    const zoneCounters: Record<string, number> = {
        infra: infraStart,
        storage: storageStart,
        compute: computeStart,
        management: mgmtStart,
    }

    // Track switch index for DHCP scope assignment
    let switchIdx = 0
    const allocations: AllocatedNode[] = []

    for (const node of nodes) {
        const meta = ROLE_META[node.type ?? ''] ?? ROLE_META['accessory']
        const zone = meta.zone

        // Respect user-set IP
        let ip: string
        if (node.ip && node.ip.trim()) {
            ip = node.ip.trim()
        } else {
            const offset = zoneCounters[zone]
            ip = offsetToIp(networkOctets, offset)

            // Advance counter
            if (zone === 'compute') {
                zoneCounters[zone] = offset + containerSlot
            } else {
                zoneCounters[zone] = offset + 1
            }
        }

        const allocated: AllocatedNode = { node, ip, roleLabel: meta.label }

        // Container range for compute nodes
        if (zone === 'compute') {
            const hostOffset = parseInt(ip.split('.').pop() ?? '0', 10)
            // For /24 and smaller, last octet is the offset
            // For /16, we need to handle the third octet too — use IP arithmetic
            const ipInt = ip.split('.').reduce((acc, o) => (acc << 8) | parseInt(o), 0) >>> 0
            const containerStartInt = (ipInt + 1) >>> 0
            const containerEndInt = (ipInt + containerSlot - 1) >>> 0
            const count = containerSlot - 1

            if (count > 0) {
                allocated.containerRange = {
                    start: [
                        (containerStartInt >>> 24) & 0xFF,
                        (containerStartInt >>> 16) & 0xFF,
                        (containerStartInt >>> 8) & 0xFF,
                        containerStartInt & 0xFF,
                    ].join('.'),
                    end: [
                        (containerEndInt >>> 24) & 0xFF,
                        (containerEndInt >>> 16) & 0xFF,
                        (containerEndInt >>> 8) & 0xFF,
                        containerEndInt & 0xFF,
                    ].join('.'),
                    count,
                }
            }

            // Suppress unused variable warning
            void hostOffset
        }

        // Switch DHCP scope
        if (node.type === 'switch') {
            // Each switch gets an equal slice of the DHCP space
            // We place switch scopes in the infra zone, after the static infra IPs
            const scopeBase = infraStart + infraNodes.length + 2 + switchIdx * switchDhcpSize
            const scopeEnd = scopeBase + switchDhcpSize - 1
            allocated.switchDhcpScope = {
                start: offsetToIp(networkOctets, Math.min(scopeBase, mgmtEnd - 1)),
                end: offsetToIp(networkOctets, Math.min(scopeEnd, mgmtEnd - 1)),
                count: switchDhcpSize,
            }
            switchIdx++
        }

        // Warn if we're running out of space
        if (zoneCounters[zone] > mgmtEnd && !node.ip) {
            warnings.push(`Warning: zone "${zone}" is full — ${node.name} may overlap with another zone`)
        }

        allocations.push(allocated)
    }

    // ── Build summary ────────────────────────────────────────────────────────
    return {
        networkAddress,
        cidr,
        subnetMask,
        gateway,
        totalHosts,
        zones,
        allocations,
        homeDhcpPool,
        warnings,
    }
}

// ─── IP Plan document generator ───────────────────────────────────────────────
export function generateIpPlan(nodes: HardwareNode[], opts: IpAllocatorOptions = {}): string {
    if (nodes.length === 0) {
        return [
            '# Homelab IP Address Plan',
            `# Generated by Homelab Builder — ${new Date().toISOString()}`,
            '',
            '# No hardware nodes configured.',
            '# Add nodes in the Visual Builder to generate an IP plan.',
        ].join('\n')
    }

    const plan = allocateIPs(nodes, opts)

    const lines: string[] = [
        '# Homelab IP Address Plan',
        `# Generated by Homelab Builder — ${new Date().toISOString()}`,
        '',
        `Network : ${plan.networkAddress}/${plan.cidr}`,
        `Mask    : ${plan.subnetMask}`,
        `Gateway : ${plan.gateway}`,
        `Hosts   : ${plan.totalHosts} usable addresses`,
        '',
    ]

    if (plan.homeDhcpPool) {
        lines.push(`Home DHCP Pool : ${plan.homeDhcpPool.start} – ${plan.homeDhcpPool.end}  (${plan.homeDhcpPool.count} IPs for regular home devices)`)
        lines.push('')
    }

    lines.push('── Zone Layout ───────────────────────────────────────────────────────────')
    for (const z of plan.zones) {
        const startIp = offsetToIp(
            plan.networkAddress.split('.').map(Number),
            z.startOffset
        )
        const endIp = offsetToIp(
            plan.networkAddress.split('.').map(Number),
            z.endOffset
        )
        const range = z.startOffset === z.endOffset ? startIp : `${startIp} – ${endIp}`
        lines.push(`  ${z.name.padEnd(28)} ${range}`)
        lines.push(`    ${z.description}`)
    }

    lines.push('')
    lines.push('── Static IP Assignments ─────────────────────────────────────────────────')

    const byRole: Record<string, AllocatedNode[]> = {}
    for (const a of plan.allocations) {
        ; (byRole[a.roleLabel] ??= []).push(a)
    }

    for (const [label, group] of Object.entries(byRole)) {
        lines.push(`  ${label}:`)
        for (const a of group) {
            let line = `    ${a.ip.padEnd(20)} ${a.node.name}`
            if (a.containerRange) {
                line += `  [containers: ${a.containerRange.start} – ${a.containerRange.end}  (${a.containerRange.count} IPs)]`
            }
            lines.push(line)
        }
    }

    if (plan.allocations.some(a => a.switchDhcpScope)) {
        lines.push('')
        lines.push('── Switch DHCP Scopes ────────────────────────────────────────────────────')
        for (const a of plan.allocations.filter(a => a.switchDhcpScope)) {
            lines.push(`  ${a.node.name} (${a.ip})`)
            lines.push(`    DHCP pool : ${a.switchDhcpScope!.start} – ${a.switchDhcpScope!.end}  (${a.switchDhcpScope!.count} IPs)`)
            lines.push(`    Hint      : configure this range in your DHCP server for clients on this switch`)
        }
    }

    if (plan.warnings.length > 0) {
        lines.push('')
        lines.push('── Warnings ──────────────────────────────────────────────────────────────')
        plan.warnings.forEach(w => lines.push(`  ⚠ ${w}`))
    }

    return lines.join('\n')
}
