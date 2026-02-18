
import type { HardwareSpec } from "../../../types"

export const HARDWARE_CATALOG: Record<string, HardwareSpec[]> = {
    'router': [
        { model: 'Ubiquiti Dream Machine Pro', price_est: 379, currency: 'EUR', url: 'https://store.ui.com/us/en/pro/category/all-unifi-gateway-consoles/products/udm-pro' },
        { model: 'MikroTik RB5009', price_est: 220, currency: 'EUR', url: 'https://mikrotik.com/product/rb5009ug_s_in' },
        { model: 'PfSense / OPNsense Mini PC', price_est: 300, currency: 'EUR', url: 'https://protectli.com/' }
    ],
    'switch': [
        { model: 'Ubiquiti USW-Lite-8-PoE', price_est: 109, currency: 'EUR', url: 'https://store.ui.com/' },
        { model: 'TP-Link TL-SG108PE', price_est: 60, currency: 'EUR', url: 'https://www.tp-link.com/' },
        { model: 'MikroTik CSS610', price_est: 99, currency: 'EUR', url: 'https://mikrotik.com/' }
    ],
    'nas': [
        { model: 'Synology DS923+', price_est: 599, currency: 'EUR', url: 'https://www.synology.com/' },
        { model: 'QNAP TS-464', price_est: 550, currency: 'EUR', url: 'https://www.qnap.com/' },
        { model: 'DIY TrueNAS (Jonsbo N1 Case)', price_est: 450, currency: 'EUR', url: 'https://www.truenas.com/' }
    ],
    'access_point': [
        { model: 'Ubiquiti U6 Pro', price_est: 159, currency: 'EUR', url: 'https://store.ui.com/' },
        { model: 'TP-Link EAP660 HD', price_est: 180, currency: 'EUR', url: 'https://www.tp-link.com/' }
    ],
    'server': [
        { model: 'Dell PowerEdge R730 (Refurb)', price_est: 400, currency: 'EUR', url: 'https://www.ebay.com/' },
        { model: 'Intel NUC 13 Pro', price_est: 500, currency: 'EUR', url: 'https://www.intel.com/' }
    ]
}
