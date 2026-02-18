import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Service, HardwareNode } from '../../../types'

interface BuilderState {
    selectedServices: Service[]
    hardwareNodes: HardwareNode[]
    addService: (service: Service) => void
    removeService: (serviceId: string) => void
    toggleService: (service: Service) => void

    selectedNodeId: string | null
    selectNode: (nodeId: string | null) => void

    addHardware: (node: HardwareNode) => void
    removeHardware: (nodeId: string) => void
    updateHardware: (nodeId: string, updates: Partial<HardwareNode>) => void

    clear: () => void

    // Computed (helper getters usually, or derived state)
    totalCpu: () => number
    totalRam: () => number
    totalStorage: () => number
}

export const useBuilderStore = create<BuilderState>()(
    persist(
        (set, get) => ({
            selectedServices: [],
            hardwareNodes: [],
            selectedNodeId: null,

            addService: (service) =>
                set((state) => ({
                    selectedServices: [...state.selectedServices, service]
                })),
            removeService: (serviceId) =>
                set((state) => ({
                    selectedServices: state.selectedServices.filter((s) => s.id !== serviceId)
                })),
            toggleService: (service) => {
                const { selectedServices } = get()
                const exists = selectedServices.find((s) => s.id === service.id)
                if (exists) {
                    get().removeService(service.id)
                } else {
                    get().addService(service)
                }
            },

            selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

            addHardware: (node) =>
                set((state) => ({
                    hardwareNodes: [...state.hardwareNodes, node]
                })),
            removeHardware: (nodeId) =>
                set((state) => ({
                    hardwareNodes: state.hardwareNodes.filter((n) => n.id !== nodeId),
                    selectedNodeId: state.selectedNodeId === nodeId ? null : state.selectedNodeId
                })),
            updateHardware: (nodeId, updates) =>
                set((state) => ({
                    hardwareNodes: state.hardwareNodes.map((n) =>
                        n.id === nodeId ? { ...n, ...updates } : n
                    )
                })),

            clear: () => set({ selectedServices: [], hardwareNodes: [] }),

            totalCpu: () => get().selectedServices.reduce((acc, s) => acc + (s.requirements?.min_cpu_cores || 0), 0),
            totalRam: () => get().selectedServices.reduce((acc, s) => acc + (s.requirements?.min_ram_mb || 0), 0),
            totalStorage: () => get().selectedServices.reduce((acc, s) => acc + (s.requirements?.min_storage_gb || 0), 0),
        }),
        {
            name: 'homelab-builder-storage',
            partialize: (state) => ({
                selectedServices: state.selectedServices,
                hardwareNodes: state.hardwareNodes
            }), // Persist hardware too
        }
    )
)
