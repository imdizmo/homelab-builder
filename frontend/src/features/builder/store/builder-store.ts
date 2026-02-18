import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
    type Node,
    type Edge,
    type OnNodesChange,
    type OnEdgesChange,
    type OnConnect,
    applyNodeChanges,
    applyEdgeChanges,
    addEdge,
    type Connection,
} from '@xyflow/react'
import type { Service, HardwareNode, VirtualMachine, HardwareType, HardwareComponent } from '../../../types'

// ─── Role-based IP zone config (mirrors ip-allocator.ts logic) ───────────────
// Each role has: base offset in /24, step between nodes, container slots per node
const ROLE_ZONE: Record<string, { base: number; step: number; label: string }> = {
    router: { base: 1, step: 1, label: 'Router' },
    switch: { base: 10, step: 1, label: 'Switch' },
    access_point: { base: 50, step: 1, label: 'AP' },
    // Moved utilities to 80-99 range to free up 100+ for NAS/Servers
    ups: { base: 80, step: 1, label: 'UPS' },
    pdu: { base: 85, step: 1, label: 'PDU' },
    disk: { base: 90, step: 1, label: 'Disk' },

    // Compute nodes (Step 10 allows 9 containers per node)
    nas: { base: 100, step: 10, label: 'NAS' }, // 100, 110, 120...
    server: { base: 150, step: 10, label: 'Server' },
    pc: { base: 160, step: 10, label: 'PC' },
    minipc: { base: 170, step: 10, label: 'Mini PC' },
    sbc: { base: 180, step: 10, label: 'SBC' },

    gpu: { base: 190, step: 1, label: 'GPU' },
    // Fallback starts at 200
    hba: { base: 195, step: 1, label: 'HBA' },
    pcie: { base: 198, step: 1, label: 'PCIe' },
}
const FALLBACK_ZONE = { base: 200, step: 1, label: 'Device' }

// Types that never get an IP address
export const NON_NETWORK_TYPES: HardwareType[] = ['disk', 'gpu', 'hba', 'pcie', 'pdu', 'ups']

/** Parse gateway like "192.168.1.1" → prefix "192.168.1" */
function subnetPrefix(gateway: string): string {
    const parts = gateway.split('.')
    return parts.length >= 3 ? parts.slice(0, 3).join('.') : '192.168.1'
}

/**
 * Collect ALL IPs that are "in use" — static node IPs AND their container sub-ranges.
 * A server at .150 with step=10 reserves .150–.159 entirely.
 */
/**
 * Collect ALL used IP octets from nodes and VMs, identifying block reservations.
 * Used by assignIP to ensure new nodes don't overlap with existing blocks.
 */
function collectUsedOffsets(nodes: HardwareNode[]): Set<number> {
    const used = new Set<number>()
    for (const n of nodes) {
        if (!n.ip) continue
        const lastOctet = parseInt(n.ip.split('.')[3] ?? '0', 10)
        if (isNaN(lastOctet)) continue
        const zone = ROLE_ZONE[n.type] ?? FALLBACK_ZONE
        // Reserve the full block (node IP + container IPs)
        for (let i = 0; i < zone.step; i++) {
            used.add(lastOctet + i)
        }
        // Also reserve any explicitly assigned VM IPs
        for (const vm of n.vms ?? []) {
            if (vm.ip) {
                const vmOctet = parseInt(vm.ip.split('.')[3] ?? '0', 10)
                if (!isNaN(vmOctet)) used.add(vmOctet)
            }
        }
    }
    return used
}

/**
 * Collect only explicitly assigned IPs (Nodes and VMs), without block reservations.
 * Used by assignVMIP to find free slots within a host's block.
 */
function collectUsedIPs(nodes: HardwareNode[]): Set<number> {
    const used = new Set<number>()
    for (const n of nodes) {
        if (n.ip) {
            const octet = parseInt(n.ip.split('.')[3] ?? '0', 10)
            if (!isNaN(octet)) used.add(octet)
        }
        for (const vm of n.vms ?? []) {
            if (vm.ip) {
                const octet = parseInt(vm.ip.split('.')[3] ?? '0', 10)
                if (!isNaN(octet)) used.add(octet)
            }
        }
    }
    return used
}

/**
 * Assign the next available IP for a given hardware type.
 * Respects role zones and container block reservations.
 */
function assignIP(type: HardwareType | string, gateway: string, nodes: HardwareNode[]): string {
    if (NON_NETWORK_TYPES.includes(type as HardwareType)) return ''

    const prefix = subnetPrefix(gateway)
    const zone = ROLE_ZONE[type] ?? FALLBACK_ZONE
    const usedOffsets = collectUsedOffsets(nodes)

    // Find next free slot in this role's zone
    for (let offset = zone.base; offset < 250; offset += zone.step) {
        // Check that the entire block [offset, offset+step) is free
        let blockFree = true
        for (let i = 0; i < zone.step; i++) {
            if (usedOffsets.has(offset + i)) { blockFree = false; break }
        }
        if (blockFree) return `${prefix}.${offset}`
    }
    return ''
}

/**
 * Assign next available VM/container IP within the host node's reserved block.
 * e.g. server at .150 → containers get .151, .152, … .159
 * Falls back to global zone assignment if host has no IP.
 */
function assignVMIP(hostNode: HardwareNode, allNodes: HardwareNode[]): string {
    // FIX: Use collectUsedIPs (granular) instead of collectUsedOffsets (blocks)
    // This allows VMs to be assigned within the host's reserved block.
    const usedOffsets = collectUsedIPs(allNodes)

    if (hostNode.ip) {
        const prefix = subnetPrefix(hostNode.ip)
        const hostOctet = parseInt(hostNode.ip.split('.')[3] ?? '0', 10)
        const zone = ROLE_ZONE[hostNode.type] ?? FALLBACK_ZONE

        console.log(`[assignVMIP] Host: ${hostNode.name} IP: ${hostNode.ip} ZoneStep: ${zone.step}`)

        // Container IPs start at hostOctet+1, end at hostOctet+step-1
        for (let i = 1; i < zone.step; i++) {
            const candidate = hostOctet + i
            if (!usedOffsets.has(candidate)) {
                console.log(`[assignVMIP] Found candidate: ${prefix}.${candidate}`)
                return `${prefix}.${candidate}`
            }
        }
        console.log(`[assignVMIP] No free slots in block`)
        return '' // block full
    }

    // Host has no IP yet — fall back to global zone for this type
    const gateway = findGateway(allNodes)
    if (!gateway) return ''
    return assignIP(hostNode.type, gateway, allNodes)
}

/** Find the gateway IP from any router node */
function findGateway(nodes: HardwareNode[]): string | null {
    return nodes.find(n => n.type === 'router' && n.ip)?.ip ?? null
}

interface BuilderState {
    // Data Logic
    selectedServices: Service[]
    hardwareNodes: HardwareNode[]

    addService: (service: Service) => void
    removeService: (serviceId: string) => void
    toggleService: (service: Service) => void

    // Visual Logic (React Flow Source of Truth)
    nodes: Node[]
    edges: Edge[]
    onNodesChange: OnNodesChange
    onEdgesChange: OnEdgesChange
    onConnect: OnConnect

    // Selection
    selectedNodeId: string | null
    selectNode: (nodeId: string | null) => void

    // Hardware Actions
    addHardware: (node: HardwareNode) => void
    removeHardware: (nodeId: string) => void
    updateHardware: (nodeId: string, updates: Partial<HardwareNode>) => void
    duplicateHardware: (nodeId: string) => void

    addInternalComponent: (nodeId: string, component: HardwareComponent) => void
    removeInternalComponent: (nodeId: string, componentId: string) => void
    updateInternalComponent: (nodeId: string, componentId: string, updates: Partial<HardwareComponent>) => void

    // VM / Container Management
    addVM: (nodeId: string, vm: VirtualMachine) => void
    removeVM: (nodeId: string, vmId: string) => void
    updateVM: (nodeId: string, vmId: string, updates: Partial<VirtualMachine>) => void

    // Auto-IP: assign next available IP to a node from the router's subnet
    autoAssignIP: (nodeId: string) => string | null
    reassignAllIPs: () => void

    // Purchase Tracking
    boughtItems: string[]           // item names that have been marked as bought
    markAsBought: (itemName: string) => void
    unmarkAsBought: (itemName: string) => void
    showBought: boolean
    setShowBought: (v: boolean) => void

    clear: () => void

    // Export / Import
    exportLab: (name?: string) => void
    importLab: (json: string) => { ok: boolean; error?: string }

    // Computed getters
    totalCpu: () => number
    totalRam: () => number
    totalStorage: () => number
}

export const useBuilderStore = create<BuilderState>()(
    persist(
        (set, get) => ({
            selectedServices: [],
            hardwareNodes: [],
            nodes: [],
            edges: [],
            selectedNodeId: null,
            boughtItems: [],
            showBought: false,

            onNodesChange: (changes) => {
                set({ nodes: applyNodeChanges(changes, get().nodes) });
            },
            onEdgesChange: (changes) => {
                set({ edges: applyEdgeChanges(changes, get().edges) });
            },
            onConnect: (connection: Connection) => {
                const state = get()
                const newEdges = addEdge(connection, state.edges)
                set({ edges: newEdges })

                // Auto-assign IP when a node is connected to a router or switch
                const { source, target } = connection
                if (!source || !target) return

                const sourceNode = state.hardwareNodes.find(n => n.id === source)
                const targetNode = state.hardwareNodes.find(n => n.id === target)

                // Determine which end is the infrastructure (router/switch) and which is the new device
                const isInfra = (n: HardwareNode) => n.type === 'router' || n.type === 'switch'

                let deviceNode: HardwareNode | undefined
                if (sourceNode && isInfra(sourceNode) && targetNode && !targetNode.ip) {
                    deviceNode = targetNode
                } else if (targetNode && isInfra(targetNode) && sourceNode && !sourceNode.ip) {
                    deviceNode = sourceNode
                }

                if (deviceNode) {
                    const gateway = findGateway([...state.hardwareNodes])
                    if (gateway) {
                        const ip = assignIP(deviceNode.type, gateway, state.hardwareNodes)
                        if (ip) {
                            // Assign IP to the node
                            get().updateHardware(deviceNode.id, { ip })

                            // Also assign IPs to any VMs/Containers inside that node
                            const updatedNode = get().hardwareNodes.find(n => n.id === deviceNode!.id)
                            if (updatedNode && updatedNode.vms && updatedNode.vms.length > 0) {
                                let updatedVMs = [...updatedNode.vms]
                                let changed = false
                                updatedVMs = updatedVMs.map(vm => {
                                    if (!vm.ip) {
                                        const vmIp = assignVMIP(updatedNode, get().hardwareNodes)
                                        if (vmIp) {
                                            changed = true
                                            return { ...vm, ip: vmIp }
                                        }
                                    }
                                    return vm
                                })
                                if (changed) {
                                    get().updateHardware(updatedNode.id, { vms: updatedVMs })
                                }
                            }
                        }
                    }
                }
            },

            addService: (service) => {
                set((state) => {
                    const newNode: Node = {
                        id: service.id,
                        type: 'service',
                        data: { label: service.name },
                        position: { x: Math.random() * 400, y: Math.random() * 400 + 300 },
                    };
                    return {
                        selectedServices: [...state.selectedServices, service],
                        nodes: [...state.nodes, newNode]
                    };
                });
            },

            removeService: (serviceId) => {
                set((state) => ({
                    selectedServices: state.selectedServices.filter((s) => s.id !== serviceId),
                    nodes: state.nodes.filter((n) => n.id !== serviceId),
                    edges: state.edges.filter((e) => e.source !== serviceId && e.target !== serviceId)
                }));
            },

            toggleService: (service) => {
                const { selectedServices } = get()
                const exists = selectedServices.find((s) => s.id === service.id)
                if (exists) get().removeService(service.id)
                else get().addService(service)
            },

            selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

            addHardware: (hardwareNode) => {
                set((state) => {
                    // Auto-assign IP for routers immediately (they define the gateway)
                    // For other nodes: assign only if a gateway already exists
                    let nodeWithIP = hardwareNode
                    if (!hardwareNode.ip) {
                        if (hardwareNode.type === 'router') {
                            // First router gets the gateway IP
                            const existingRouter = state.hardwareNodes.find(n => n.type === 'router' && n.ip)
                            if (!existingRouter) {
                                nodeWithIP = { ...hardwareNode, ip: '192.168.1.1' }
                            } else {
                                const ip = assignIP('router', existingRouter.ip!, state.hardwareNodes)
                                if (ip) nodeWithIP = { ...hardwareNode, ip }
                            }
                        } else {
                            // Other nodes: only auto-assign if gateway exists
                            const gateway = findGateway(state.hardwareNodes)
                            if (gateway) {
                                const ip = assignIP(hardwareNode.type, gateway, state.hardwareNodes)
                                if (ip) nodeWithIP = { ...hardwareNode, ip }
                            }
                        }
                    }

                    const reactFlowNode: Node = {
                        id: nodeWithIP.id,
                        type: 'hardware',
                        position: { x: nodeWithIP.x, y: nodeWithIP.y },
                        data: { label: nodeWithIP.name, ...nodeWithIP }
                    };

                    return {
                        hardwareNodes: [...state.hardwareNodes, nodeWithIP],
                        nodes: [...state.nodes, reactFlowNode]
                    };
                });
            },

            removeHardware: (nodeId) =>
                set((state) => ({
                    hardwareNodes: state.hardwareNodes.filter((n) => n.id !== nodeId),
                    nodes: state.nodes.filter((n) => n.id !== nodeId),
                    edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
                    selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId
                })),

            updateHardware: (nodeId, updates) =>
                set((state) => ({
                    hardwareNodes: state.hardwareNodes.map((n) =>
                        n.id === nodeId ? { ...n, ...updates } : n
                    ),
                    nodes: state.nodes.map((n) =>
                        n.id === nodeId ? { ...n, data: { ...n.data, ...updates, label: updates.name ?? n.data.label } } : n
                    )
                })),

            duplicateHardware: (nodeId) => {
                const state = get()
                const orig = state.hardwareNodes.find(n => n.id === nodeId)
                if (!orig) return
                const newId = `node-${Date.now()}`
                const gateway = findGateway(state.hardwareNodes)
                const newIp = gateway ? assignIP(orig.type, gateway, state.hardwareNodes) : ''
                const dup: HardwareNode = {
                    ...orig,
                    id: newId,
                    name: `${orig.name} (copy)`,
                    ip: newIp,
                    x: orig.x + 40,
                    y: orig.y + 40,
                    vms: [],  // don't duplicate VMs
                }
                const rfNode: Node = {
                    id: newId,
                    type: 'hardware',
                    position: { x: dup.x, y: dup.y },
                    data: { label: dup.name, ...dup },
                }
                set({
                    hardwareNodes: [...state.hardwareNodes, dup],
                    nodes: [...state.nodes, rfNode],
                    selectedNodeId: newId,
                })
            },

            addInternalComponent: (nodeId, component) => {
                set((state) => {
                    const updated = state.hardwareNodes.map(n =>
                        n.id === nodeId
                            ? { ...n, internal_components: [...(n.internal_components || []), component] }
                            : n
                    )
                    return {
                        hardwareNodes: updated,
                        nodes: state.nodes.map(n =>
                            n.id === nodeId
                                ? { ...n, data: { ...n.data, internal_components: updated.find(h => h.id === nodeId)?.internal_components } }
                                : n
                        )
                    }
                })
            },

            removeInternalComponent: (nodeId, componentId) => {
                set((state) => {
                    const updated = state.hardwareNodes.map(n =>
                        n.id === nodeId
                            ? { ...n, internal_components: (n.internal_components || []).filter(c => c.id !== componentId) }
                            : n
                    )
                    return {
                        hardwareNodes: updated,
                        nodes: state.nodes.map(n =>
                            n.id === nodeId
                                ? { ...n, data: { ...n.data, internal_components: updated.find(h => h.id === nodeId)?.internal_components } }
                                : n
                        )
                    }
                })
            },

            updateInternalComponent: (nodeId, componentId, updates) => {
                set((state) => {
                    const updated = state.hardwareNodes.map(n =>
                        n.id === nodeId
                            ? {
                                ...n,
                                internal_components: (n.internal_components || []).map(c =>
                                    c.id === componentId ? { ...c, ...updates } : c
                                )
                            }
                            : n
                    )
                    return {
                        hardwareNodes: updated,
                        nodes: state.nodes.map(n =>
                            n.id === nodeId
                                ? { ...n, data: { ...n.data, internal_components: updated.find(h => h.id === nodeId)?.internal_components } }
                                : n
                        )
                    }
                })
            },

            // ── VM Management ──────────────────────────────────────────────────
            addVM: (nodeId, vm) => {
                set((state) => {
                    let updatedNodes = [...state.hardwareNodes]; // Clone array
                    const hostIndex = updatedNodes.findIndex(n => n.id === nodeId);
                    if (hostIndex === -1) return state;

                    let hostNode = updatedNodes[hostIndex];

                    // 1. Self-healing: If host has no IP, try to assign one (requires Gateway)
                    if (!hostNode.ip) {
                        const gateway = findGateway(updatedNodes);
                        if (gateway) {
                            console.log(`[addVM] Host ${hostNode.name} has no IP. Attempting to assign...`);
                            const newHostIp = assignIP(hostNode.type, gateway, updatedNodes);
                            if (newHostIp) {
                                console.log(`[addVM] Assigned host IP: ${newHostIp}`);
                                hostNode = { ...hostNode, ip: newHostIp };
                                updatedNodes[hostIndex] = hostNode;
                            }
                        }
                    }

                    // 2. Auto-assign IP to VM if needed
                    let vmWithIP = vm;
                    if (!vm.ip) {
                        if (hostNode.ip) {
                            // Use updatedNodes so checks include the newly assigned host IP (if any)
                            const containerIP = assignVMIP(hostNode, updatedNodes);
                            if (containerIP) vmWithIP = { ...vm, ip: containerIP };
                        } else {
                            console.log(`[addVM] Host has no IP (no gateway?), cannot assign VM IP.`);
                        }
                    }

                    // 3. Update the host with the new VM
                    const finalHost = { ...hostNode, vms: [...(hostNode.vms || []), vmWithIP] };
                    updatedNodes[hostIndex] = finalHost;

                    return {
                        hardwareNodes: updatedNodes,
                        // Sync React Flow node data so the card re-renders
                        nodes: state.nodes.map(n =>
                            n.id === nodeId
                                ? {
                                    ...n,
                                    data: {
                                        ...n.data,
                                        ip: finalHost.ip, // Update displayed IP
                                        vms: finalHost.vms
                                    }
                                }
                                : n
                        )
                    }
                })
            },

            removeVM: (nodeId, vmId) => {
                set((state) => {
                    const updated = state.hardwareNodes.map(n =>
                        n.id === nodeId
                            ? { ...n, vms: (n.vms || []).filter(v => v.id !== vmId) }
                            : n
                    )
                    return {
                        hardwareNodes: updated,
                        nodes: state.nodes.map(n =>
                            n.id === nodeId
                                ? { ...n, data: { ...n.data, vms: updated.find(h => h.id === nodeId)?.vms } }
                                : n
                        )
                    }
                })
            },

            updateVM: (nodeId, vmId, updates) => {
                set((state) => {
                    const updated = state.hardwareNodes.map(n =>
                        n.id === nodeId
                            ? { ...n, vms: (n.vms || []).map(v => v.id === vmId ? { ...v, ...updates } : v) }
                            : n
                    )
                    return {
                        hardwareNodes: updated,
                        nodes: state.nodes.map(n =>
                            n.id === nodeId
                                ? { ...n, data: { ...n.data, vms: updated.find(h => h.id === nodeId)?.vms } }
                                : n
                        )
                    }
                })
            },

            autoAssignIP: (nodeId) => {
                const state = get()
                const gateway = findGateway(state.hardwareNodes)
                if (!gateway) return null
                const node = state.hardwareNodes.find(n => n.id === nodeId)
                if (!node) return null
                const ip = assignIP(node.type, gateway, state.hardwareNodes)
                if (ip) {
                    get().updateHardware(nodeId, { ip })
                    return ip
                }
                return null
            },

            reassignAllIPs: () => {
                set((state) => {
                    const gateway = findGateway(state.hardwareNodes)
                    if (!gateway) return state // No gateway, can't assign

                    // 1. Reset all non-static IPs (simple approach: reset all non-router IPs)
                    let newNodes = state.hardwareNodes.map(n => {
                        if (n.type === 'router') return n // Keep routers as anchors
                        if (NON_NETWORK_TYPES.includes(n.type)) return { ...n, ip: '' }
                        return { ...n, ip: '' }
                    })

                    const finalNodes: HardwareNode[] = []
                    // First pass: add routers (they have IPs)
                    newNodes.filter(n => n.type === 'router').forEach(n => finalNodes.push(n))

                    // Second pass: assign others sequentially
                    newNodes.filter(n => n.type !== 'router').forEach(n => {
                        const ip = assignIP(n.type, gateway, finalNodes)
                        const nodeWithIp = { ...n, ip: ip || undefined }

                        // Re-assign IPs to VMs sequentially
                        if (nodeWithIp.vms && nodeWithIp.vms.length > 0 && nodeWithIp.ip) {
                            const updatedVMs: VirtualMachine[] = []
                            let tempNode = { ...nodeWithIp, vms: [] as VirtualMachine[] }

                            for (const vm of nodeWithIp.vms) {
                                // Important: We must pass 'tempNode' which has the accumulated VMs so far
                                // AND include it in the 'allNodes' list so collectUsedOffsets sees it.
                                const vmIp = assignVMIP(tempNode, [...finalNodes, tempNode])
                                const newVm = { ...vm, ip: vmIp || undefined }
                                updatedVMs.push(newVm)

                                // Update tempNode for next iteration so collectUsedOffsets sees this VM
                                tempNode = { ...tempNode, vms: updatedVMs }
                            }
                            nodeWithIp.vms = updatedVMs
                        }

                        finalNodes.push(nodeWithIp)
                    })

                    // 3. Update state
                    return {
                        hardwareNodes: finalNodes,
                        nodes: state.nodes.map(rfNode => {
                            const updated = finalNodes.find(h => h.id === rfNode.id)
                            if (updated) {
                                return {
                                    ...rfNode,
                                    data: {
                                        ...rfNode.data,
                                        ip: updated.ip,
                                        vms: updated.vms,
                                        internal_components: updated.internal_components
                                    }
                                }
                            }
                            return rfNode
                        })
                    }
                })
            },

            // ── Purchase Tracking ──────────────────────────────────────────────
            markAsBought: (itemName) =>
                set((state) => ({ boughtItems: [...new Set([...state.boughtItems, itemName])] })),

            unmarkAsBought: (itemName) =>
                set((state) => ({ boughtItems: state.boughtItems.filter(n => n !== itemName) })),

            setShowBought: (v) => set({ showBought: v }),

            clear: () => set({ selectedServices: [], hardwareNodes: [], nodes: [], edges: [], boughtItems: [] }),

            // ── Export / Import ────────────────────────────────────────────────
            exportLab: (name = 'my-homelab') => {
                const { selectedServices, hardwareNodes, nodes, edges } = get()
                const payload = {
                    version: 1,
                    name,
                    exportedAt: new Date().toISOString(),
                    selectedServices,
                    hardwareNodes,
                    nodes,
                    edges,
                }
                const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${name.replace(/[^a-z0-9]/gi, '-')}.homelab.json`
                a.click()
                URL.revokeObjectURL(url)
            },

            importLab: (json: string) => {
                try {
                    const payload = JSON.parse(json)
                    if (!payload.version || !Array.isArray(payload.selectedServices)) {
                        return { ok: false, error: 'Invalid .homelab.json format' }
                    }
                    set({
                        selectedServices: payload.selectedServices ?? [],
                        hardwareNodes: payload.hardwareNodes ?? [],
                        nodes: payload.nodes ?? [],
                        edges: payload.edges ?? [],
                    })
                    return { ok: true }
                } catch {
                    return { ok: false, error: 'Failed to parse JSON' }
                }
            },

            totalCpu: () => get().selectedServices.reduce((acc, s) => acc + (s.requirements?.min_cpu_cores || 0), 0),
            totalRam: () => get().selectedServices.reduce((acc, s) => acc + (s.requirements?.min_ram_mb || 0), 0),
            totalStorage: () => get().selectedServices.reduce((acc, s) => acc + (s.requirements?.min_storage_gb || 0), 0),
        }),
        {
            name: 'homelab-builder-storage',
            partialize: (state) => ({
                selectedServices: state.selectedServices,
                hardwareNodes: state.hardwareNodes,
                nodes: state.nodes,
                edges: state.edges,
                boughtItems: state.boughtItems,
                showBought: state.showBought,
            }),
        }
    )
)
