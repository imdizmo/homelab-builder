
import type { Service, HardwareNode } from "../../../types"
import { HARDWARE_CATALOG } from "../data/hardware-catalog"

export interface Offer {
    store: "Amazon" | "Allegro" | "eBay" | "Local" | "Vendor"
    price: number
    currency: "USD" | "PLN" | "EUR"
    condition: "new" | "used"
    url: string
}

export interface ShoppingItem {
    name: string
    category: string
    priority: 'essential' | 'recommended' | 'optional' | 'manual'
    offers: Offer[]
}

const AMAZON_DE = "https://www.amazon.de/s?k="
const ALLEGRO_PL = "https://allegro.pl/listing?string="
const EBAY_COM = "https://www.ebay.com/sch/i.html?_nkw="

export function generateShoppingList(services: Service[], hardwareNodes: HardwareNode[] = []): ShoppingItem[] {
    const items: ShoppingItem[] = []

    const totalRam = services.reduce((acc, s) => acc + (s.requirements?.min_ram_mb || 0), 0)
    const totalStorage = services.reduce((acc, s) => acc + (s.requirements?.min_storage_gb || 0), 0)
    const totalCpu = services.reduce((acc, s) => acc + (s.requirements?.min_cpu_cores || 0), 0)

    // 1. Compute Unit (Auto-generated based on software requirements)
    let computeName = "Mini PC Intel N100"
    if (totalCpu > 8 || totalRam > 16384) {
        computeName = "Dell Optiplex Micro i5-8500T"
    } else if (totalCpu > 4) {
        computeName = "Lenovo ThinkCentre Tiny Ryzen 5"
    }

    // Only add generic compute if NO server/pc hardware nodes are explicitly added
    const hasExplicitCompute = hardwareNodes.some(n => n.type === 'server' || n.type === 'pc')

    if (!hasExplicitCompute) {
        items.push({
            name: computeName,
            category: "Compute",
            priority: "essential",
            offers: [
                {
                    store: "Amazon",
                    price: 159.99,
                    currency: "EUR",
                    condition: "new",
                    url: `${AMAZON_DE}${encodeURIComponent(computeName)}`
                },
                {
                    store: "Allegro",
                    price: 700,
                    currency: "PLN",
                    condition: "used",
                    url: `${ALLEGRO_PL}${encodeURIComponent(computeName)}`
                },
                {
                    store: "eBay",
                    price: 120,
                    currency: "USD",
                    condition: "used",
                    url: `${EBAY_COM}${encodeURIComponent(computeName)}`
                }
            ]
        })
    }

    // 2. RAM (Auto-generated)
    if (!hasExplicitCompute) {
        let ramSize = 8
        if (totalRam > 8192) ramSize = 16
        if (totalRam > 16384) ramSize = 32
        if (totalRam > 32768) ramSize = 64

        items.push({
            name: `DDR4 SODIMM ${ramSize}GB`,
            category: "Memory",
            priority: "recommended",
            offers: [
                { store: "Amazon", price: 20 + ramSize, currency: "EUR", condition: "new", url: `${AMAZON_DE}DDR4 SODIMM ${ramSize}GB` },
                { store: "Allegro", price: (20 + ramSize) * 4, currency: "PLN", condition: "new", url: `${ALLEGRO_PL}DDR4 SODIMM ${ramSize}GB` }
            ]
        })
    }

    // 3. Storage (Auto-generated)
    if (!hasExplicitCompute) {
        const storageSize = Math.max(512, totalStorage * 1.5)
        let diskName = `NVMe SSD ${storageSize >= 1000 ? '1TB' : '512GB'}`

        items.push({
            name: diskName,
            category: "Storage",
            priority: "essential",
            offers: [
                { store: "Amazon", price: storageSize >= 1000 ? 59 : 39, currency: "EUR", condition: "new", url: `${AMAZON_DE}${encodeURIComponent(diskName)}` },
                { store: "Allegro", price: storageSize >= 1000 ? 250 : 160, currency: "PLN", condition: "new", url: `${ALLEGRO_PL}${encodeURIComponent(diskName)}` }
            ]
        })
    }

    // 4. Custom Hardware Nodes (Router, Switch, NAS, Custom Server)
    hardwareNodes.forEach(node => {
        const catalogItems = HARDWARE_CATALOG[node.type] || []
        // Default to first catalog item as "Recommended"
        const recommendedItem = catalogItems[0]

        if (recommendedItem) {
            items.push({
                name: `${node.name} (${recommendedItem.model})`,
                category: node.type.charAt(0).toUpperCase() + node.type.slice(1).replace('_', ' '),
                priority: "manual",
                offers: catalogItems.map(item => ({
                    store: "Vendor", // Simplified
                    price: item.price_est || 0,
                    currency: item.currency as "USD" | "EUR" || "EUR",
                    condition: "new",
                    url: item.url || "#"
                }))
            })
        } else {
            // Generic fallback
            items.push({
                name: node.name,
                category: "Custom Hardware",
                priority: "manual",
                offers: []
            })
        }
    })

    return items
}
