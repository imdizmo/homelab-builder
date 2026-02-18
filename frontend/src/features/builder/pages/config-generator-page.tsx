import { useState, useCallback, useMemo } from "react"
import { useBuilderStore } from "../store/builder-store"
import {
    generateDockerCompose,
    generateDotEnv,
    generateAnsibleInventory,
    generateAnsiblePlaybook,
    generateNginxConfig,
    generateTraefikLabels,
    generateIpPlan,
} from "../lib/config-generator"
import { allocateIPs } from "../lib/ip-allocator"
import type { IpAllocatorOptions } from "../lib/ip-allocator"
import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import {
    Download, Upload, Copy, Check, FileCode, Server, Settings,
    Globe, Package, AlertCircle, ChevronDown, ChevronUp, Network, Home
} from "lucide-react"

type Tab = 'docker-compose' | 'env' | 'ansible-inventory' | 'ansible-playbook' | 'nginx' | 'traefik' | 'ip-plan'

const TABS: { id: Tab; label: string; icon: React.ElementType; ext: string }[] = [
    { id: 'docker-compose',     label: 'Docker Compose',    icon: Package,   ext: 'docker-compose.yml' },
    { id: 'env',                label: '.env',              icon: Settings,  ext: '.env' },
    { id: 'ansible-inventory',  label: 'Ansible Inventory', icon: Server,    ext: 'inventory.ini' },
    { id: 'ansible-playbook',   label: 'Ansible Playbook',  icon: FileCode,  ext: 'playbook.yml' },
    { id: 'nginx',              label: 'Nginx Config',      icon: Globe,     ext: 'nginx.conf' },
    { id: 'traefik',            label: 'Traefik Labels',    icon: Globe,     ext: 'traefik-labels.yml' },
    { id: 'ip-plan',            label: 'IP Address Plan',   icon: Network,   ext: 'ip-plan.txt' },
]

// ─── IP Zone Legend (dynamic from plan) ──────────────────────────────────────
const ZONE_COLORS = [
    'bg-gray-500/10 text-gray-600 dark:text-gray-400',
    'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    'bg-green-500/10 text-green-600 dark:text-green-400',
    'bg-violet-500/10 text-violet-600 dark:text-violet-400',
]

function IpLegend({ ipOpts }: { ipOpts: IpAllocatorOptions }) {
    const plan = useMemo(() => allocateIPs([], ipOpts), [ipOpts])

    const networkOctets = plan.networkAddress.split('.').map(Number)
    function offsetToIp(offset: number): string {
        const base = (networkOctets[0] << 24) | (networkOctets[1] << 16) | (networkOctets[2] << 8) | networkOctets[3]
        const ip = ((base + offset) >>> 0)
        return [(ip >>> 24) & 0xFF, (ip >>> 16) & 0xFF, (ip >>> 8) & 0xFF, ip & 0xFF].join('.')
    }

    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Network className="h-4 w-4 text-primary" />
                    IP Zone Layout — {plan.networkAddress}/{plan.cidr}
                    <span className="text-xs font-normal text-muted-foreground ml-1">({plan.totalHosts} usable hosts)</span>
                </h3>
                <span className="text-xs text-muted-foreground font-mono">{plan.subnetMask}</span>
            </div>
            <div className="divide-y">
                {plan.zones.map((z, i) => {
                    const startIp = offsetToIp(z.startOffset)
                    const endIp = offsetToIp(z.endOffset)
                    const range = z.startOffset === z.endOffset ? startIp : `${startIp} – ${endIp}`
                    return (
                        <div key={z.name} className="flex items-start gap-4 px-4 py-2.5">
                            <code className={`text-xs font-mono px-2 py-0.5 rounded shrink-0 mt-0.5 ${ZONE_COLORS[i % ZONE_COLORS.length]}`}>
                                {range}
                            </code>
                            <div>
                                <p className="text-sm font-medium">{z.name}</p>
                                <p className="text-xs text-muted-foreground">{z.description}</p>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ─── Code Block ───────────────────────────────────────────────────────────────
function CodeBlock({ content, filename }: { content: string; filename: string }) {
    const [copied, setCopied] = useState(false)

    const copy = () => {
        navigator.clipboard.writeText(content)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const download = () => {
        const blob = new Blob([content], { type: 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
    }

    return (
        <div className="rounded-xl border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-muted/60 border-b">
                <span className="text-xs font-mono text-muted-foreground">{filename}</span>
                <div className="flex gap-2">
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={copy}>
                        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied ? 'Copied!' : 'Copy'}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={download}>
                        <Download className="h-3.5 w-3.5 mr-1" /> Download
                    </Button>
                </div>
            </div>
            <pre className="overflow-auto p-4 text-xs font-mono bg-[#0d1117] text-[#e6edf3] max-h-[500px] leading-relaxed">
                <code>{content}</code>
            </pre>
        </div>
    )
}

// ─── Import Section ───────────────────────────────────────────────────────────
function ImportSection() {
    const importLab = useBuilderStore(s => s.importLab)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)

    const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (ev) => {
            const text = ev.target?.result as string
            const result = importLab(text)
            if (result.ok) {
                setSuccess(true)
                setError('')
                setTimeout(() => setSuccess(false), 3000)
            } else {
                setError(result.error ?? 'Import failed')
            }
        }
        reader.readAsText(file)
        e.target.value = ''
    }, [importLab])

    return (
        <label className="flex items-center gap-2 cursor-pointer">
            <input type="file" accept=".json,.homelab.json" className="hidden" onChange={handleFile} />
            <Button variant="outline" size="sm" asChild>
                <span>
                    {success
                        ? <><Check className="h-4 w-4 mr-2 text-green-500" /> Imported!</>
                        : <><Upload className="h-4 w-4 mr-2" /> Import Lab</>
                    }
                </span>
            </Button>
            {error && <span className="text-xs text-destructive">{error}</span>}
        </label>
    )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ConfigGeneratorPage() {
    const { selectedServices, hardwareNodes, exportLab } = useBuilderStore()
    const [activeTab, setActiveTab] = useState<Tab>('docker-compose')
    const [domain, setDomain] = useState('homelab.local')
    const [labName, setLabName] = useState('my-homelab')
    const [showSettings, setShowSettings] = useState(false)

    // IP settings
    const [baseIp, setBaseIp] = useState('192.168.1.0')
    const [cidr, setCidr] = useState(24)
    const [homeRouterMode, setHomeRouterMode] = useState(false)
    const [homeReserve, setHomeReserve] = useState(50)



    const ipOpts: IpAllocatorOptions = useMemo(() => ({
        baseIp,
        cidr,
        homeRouterMode,
        homeReserve,
    }), [baseIp, cidr, homeRouterMode, homeReserve])

    // Derive comprehensive service list from both Shopping List (selectedServices) AND Visual Builder placements (hardwareNodes)
    const allServices = useMemo(() => {
        const fromNodes = new Map<string, any>(); // Using any to avoid strict Service type construction for minimal mock

        hardwareNodes.forEach(node => {
            node.vms?.forEach(vm => {
                if (vm.type === 'container' || vm.type === 'vm') {
                     if (!fromNodes.has(vm.name)) {
                         fromNodes.set(vm.name, {
                             id: vm.id, // Use VM ID
                             name: vm.name,
                             description: 'Deployed in Visual Builder',
                             category: 'other',
                             icon: 'Package',
                             official_website: '',
                             docker_support: true,
                             is_active: true,
                             requirements: null,
                             created_at: new Date().toISOString()
                         });
                    }
                }
            })
        });

        // Start with selectedServices
        const combined = [...selectedServices];
        
        // Add any from nodes that aren't already in list (deduplicate by Name)
        fromNodes.forEach((svc, name) => {
            if (!combined.find(s => s.name === name)) {
                combined.push(svc);
            }
        });
        return combined;
    }, [selectedServices, hardwareNodes]);

    const hasContent = allServices.length > 0 || hardwareNodes.length > 0

    function getContent(tab: Tab): string {
        switch (tab) {
            case 'docker-compose':    return generateDockerCompose(allServices, hardwareNodes)
            case 'env':               return generateDotEnv(allServices)
            case 'ansible-inventory': return generateAnsibleInventory(hardwareNodes, ipOpts)
            case 'ansible-playbook':  return generateAnsiblePlaybook(allServices, hardwareNodes)
            case 'nginx':             return generateNginxConfig(allServices, domain)
            case 'traefik':           return generateTraefikLabels(allServices, domain)
            case 'ip-plan':           return generateIpPlan(hardwareNodes, ipOpts)
        }
    }

    const activeTabMeta = TABS.find(t => t.id === activeTab)!
    const content = getContent(activeTab)

    return (
        <div className="space-y-6 max-w-6xl mx-auto py-8">
            {/* Header */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Config Generator</h1>
                    <p className="text-muted-foreground mt-1">
                        Generate deployment configs from your Visual Builder design
                    </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                    <ImportSection />
                    <Button variant="outline" size="sm" onClick={() => exportLab(labName)} disabled={!hasContent}>
                        <Download className="h-4 w-4 mr-2" /> Export Lab (.homelab.json)
                    </Button>
                </div>
            </div>

            {/* Empty state */}
            {!hasContent && (
                <div className="rounded-xl border border-dashed p-12 text-center">
                    <AlertCircle className="h-10 w-10 text-muted-foreground/40 mx-auto mb-4" />
                    <h3 className="font-semibold text-lg mb-2">No lab design yet</h3>
                    <p className="text-muted-foreground text-sm mb-4">
                        Go to the <strong>Visual Builder</strong> and add services and hardware nodes, then come back here to generate configs.
                    </p>
                    <Button variant="outline" size="sm" asChild>
                        <a href="/builder">Open Visual Builder →</a>
                    </Button>
                </div>
            )}

            {hasContent && (
                <>
                    {/* Stats bar */}
                    <div className="flex flex-wrap gap-3">
                        <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm">
                            <Package className="h-4 w-4 text-primary" />
                            <span className="font-medium">{selectedServices.length}</span>
                            <span className="text-muted-foreground">services</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm">
                            <Server className="h-4 w-4 text-primary" />
                            <span className="font-medium">{hardwareNodes.length}</span>
                            <span className="text-muted-foreground">hardware nodes</span>
                        </div>
                        <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2 text-sm">
                            <Network className="h-4 w-4 text-primary" />
                            <span className="font-medium font-mono">{baseIp}/{cidr}</span>
                            <span className="text-muted-foreground">subnet</span>
                        </div>
                        {homeRouterMode && (
                            <div className="flex items-center gap-2 rounded-lg border border-amber-300/50 bg-amber-500/10 px-4 py-2 text-sm">
                                <Home className="h-4 w-4 text-amber-500" />
                                <span className="text-amber-600 dark:text-amber-400">{homeReserve} IPs reserved for home devices</span>
                            </div>
                        )}
                    </div>

                    {/* Settings panel */}
                    <div className="rounded-xl border bg-card overflow-hidden">
                        <button
                            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
                            onClick={() => setShowSettings(s => !s)}
                        >
                            <span className="flex items-center gap-2">
                                <Settings className="h-4 w-4 text-muted-foreground" />
                                Generator Settings
                            </span>
                            {showSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                        {showSettings && (
                            <div className="border-t px-4 py-4 space-y-4">
                                {/* Row 1: general */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Lab Name</label>
                                        <Input value={labName} onChange={e => setLabName(e.target.value)} placeholder="my-homelab" className="h-8 text-sm" />
                                        <p className="text-xs text-muted-foreground mt-1">Used for export filename</p>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Domain</label>
                                        <Input value={domain} onChange={e => setDomain(e.target.value)} placeholder="homelab.local" className="h-8 text-sm" />
                                        <p className="text-xs text-muted-foreground mt-1">Used in Nginx/Traefik configs</p>
                                    </div>
                                </div>

                                {/* Row 2: IP settings */}
                                <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">IP Address Settings</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Network Address</label>
                                            <Input value={baseIp} onChange={e => setBaseIp(e.target.value)} placeholder="192.168.1.0" className="h-8 text-sm font-mono" />
                                            <p className="text-xs text-muted-foreground mt-1">e.g. 192.168.1.0 or 10.0.0.0</p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Subnet Mask (CIDR)</label>
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm text-muted-foreground">/</span>
                                                <Input
                                                    type="number" min={8} max={30}
                                                    value={cidr}
                                                    onChange={e => setCidr(Math.min(30, Math.max(8, parseInt(e.target.value) || 24)))}
                                                    className="h-8 text-sm font-mono"
                                                />
                                            </div>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                /24 = 254 hosts · /16 = 65534 hosts
                                            </p>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                                                <span className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={homeRouterMode}
                                                        onChange={e => setHomeRouterMode(e.target.checked)}
                                                        className="rounded"
                                                    />
                                                    Home Router Mode
                                                </span>
                                            </label>
                                            {homeRouterMode ? (
                                                <>
                                                    <Input
                                                        type="number" min={10} max={200}
                                                        value={homeReserve}
                                                        onChange={e => setHomeReserve(Math.min(200, Math.max(10, parseInt(e.target.value) || 50)))}
                                                        className="h-8 text-sm font-mono"
                                                    />
                                                    <p className="text-xs text-muted-foreground mt-1">IPs reserved for home devices (DHCP)</p>
                                                </>
                                            ) : (
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    Enable to reserve IPs for regular home devices (phones, laptops, etc.)
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* IP Zone Legend — always visible when hardware nodes exist */}
                    {hardwareNodes.length > 0 && (
                        <IpLegend ipOpts={ipOpts} />
                    )}

                    {/* Tab bar */}
                    <div className="flex flex-wrap gap-2">
                        {TABS.map(tab => {
                            const Icon = tab.icon
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                        activeTab === tab.id
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'border-border hover:bg-muted'
                                    }`}
                                >
                                    <Icon className="h-4 w-4" />
                                    {tab.label}
                                </button>
                            )
                        })}
                    </div>

                    {/* Code block */}
                    <CodeBlock content={content} filename={activeTabMeta.ext} />

                    {/* Download all */}
                    <div className="flex items-center justify-between border-t pt-4 flex-wrap gap-3">
                        <p className="text-sm text-muted-foreground">
                            Download all configs as individual files, or export the full lab design as JSON.
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {TABS.map(tab => (
                                <Button
                                    key={tab.id}
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs"
                                    onClick={() => {
                                        const c = getContent(tab.id)
                                        const blob = new Blob([c], { type: 'text/plain' })
                                        const url = URL.createObjectURL(blob)
                                        const a = document.createElement('a')
                                        a.href = url
                                        a.download = tab.ext
                                        a.click()
                                        URL.revokeObjectURL(url)
                                    }}
                                >
                                    <Download className="h-3 w-3 mr-1" />
                                    {tab.ext}
                                </Button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}
