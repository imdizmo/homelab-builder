
import { useEffect, useState } from "react"
import { useBuilderStore, NON_NETWORK_TYPES } from "../store/builder-store"
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card"
import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"
import { X, Trash2, Save, AlertCircle, Wand2 } from "lucide-react"
import { VMManager } from "./vm-manager"
import { InternalComponentManager } from "./internal-component-manager"

const IP_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

export function NodePropertiesPanel() {
    const { selectedNodeId, hardwareNodes, selectNode, updateHardware, removeHardware, autoAssignIP } = useBuilderStore()
    
    const [name, setName] = useState("")
    const [ip, setIp] = useState("")
    const [mask, setMask] = useState("")
    const [gateway, setGateway] = useState("")
    const [model, setModel] = useState("")
    const [cpu, setCpu] = useState("")
    const [ram, setRam] = useState("")
    const [storage, setStorage] = useState("")
    const [errors, setErrors] = useState<{ip?: string, mask?: string, gateway?: string}>({})

    const selectedNode = hardwareNodes.find(n => n.id === selectedNodeId)

    useEffect(() => {
        if (selectedNode) {
            setName(selectedNode.name)
            setIp(selectedNode.ip || "")
            setMask(selectedNode.subnet_mask || "")
            setGateway(selectedNode.gateway || "")
            setModel(selectedNode.details?.model || "")
            setCpu(selectedNode.details?.cpu || "")
            setRam(selectedNode.details?.ram || "")
            setStorage(selectedNode.details?.storage || "")
            setErrors({})
        }
    }, [selectedNode])

    if (!selectedNode) return null

    const validate = () => {
        const newErrors: typeof errors = {}
        if (ip && !IP_REGEX.test(ip)) newErrors.ip = "Invalid IPv4"
        if (mask && !IP_REGEX.test(mask)) newErrors.mask = "Invalid mask"
        if (gateway && !IP_REGEX.test(gateway)) newErrors.gateway = "Invalid gateway"
        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSave = () => {
        if (!validate()) return
        updateHardware(selectedNode.id, { 
            name, 
            ip, 
            subnet_mask: mask, 
            gateway,
            details: { ...selectedNode.details, model, cpu, ram, storage }
        })
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave()
    }

    const handleDelete = () => {
        removeHardware(selectedNode.id)
        selectNode(null)
    }

    const handleAutoIP = () => {
        const assigned = autoAssignIP(selectedNode.id)
        if (assigned) setIp(assigned)
        else alert("No router with a configured IP found. Add a Router and set its IP first.")
    }

    const isRouter = selectedNode.type === 'router'
    const supportsVMs = ['server', 'pc', 'nas', 'minipc', 'sbc'].includes(selectedNode.type)
    const isNetworked = !NON_NETWORK_TYPES.includes(selectedNode.type)

    return (
        <Card className="absolute top-4 right-4 w-80 shadow-xl z-10 border-l animate-in slide-in-from-right-10 bg-background/95 backdrop-blur max-h-[calc(100vh-6rem)] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between py-3 bg-muted/50 border-b shrink-0">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                    Node Properties
                    <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider">
                        {selectedNode.type}
                    </span>
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => selectNode(null)} className="h-6 w-6 rounded-full hover:bg-destructive/10 hover:text-destructive">
                    <X className="h-4 w-4" />
                </Button>
            </CardHeader>

            <CardContent className="space-y-4 pt-4 overflow-y-auto flex-1">
                {/* Name */}
                <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input
                        id="name" value={name}
                        onChange={e => setName(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="e.g. Main Router"
                    />
                </div>

                {/* IP Address */}
                <div className="space-y-2">
                    <div className="flex justify-between items-center">
                        <Label htmlFor="ip">
                            IP Address
                            {!isNetworked && <span className="text-[10px] text-muted-foreground font-normal ml-1">(Optional)</span>}
                        </Label>
                        <div className="flex items-center gap-1">
                            {errors.ip && <span className="text-[10px] text-destructive flex items-center"><AlertCircle className="h-3 w-3 mr-0.5"/>{errors.ip}</span>}
                            {!isRouter && isNetworked && (
                                <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px] text-primary" onClick={handleAutoIP}>
                                    <Wand2 className="h-3 w-3 mr-0.5" /> Auto
                                </Button>
                            )}
                        </div>
                    </div>
                    <Input
                        id="ip"
                        value={ip}
                        onChange={e => setIp(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={isRouter ? "192.168.1.1" : (isNetworked ? "auto from router" : "no ip")}
                        className={errors.ip ? "border-destructive focus-visible:ring-destructive" : ""}
                    />
                </div>

                {/* Router-specific: Subnet Mask + Gateway */}
                {isRouter && (
                    <>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <Label htmlFor="mask">Subnet Mask</Label>
                                {errors.mask && <span className="text-[10px] text-destructive">{errors.mask}</span>}
                            </div>
                            <Input
                                id="mask"
                                value={mask}
                                onChange={(e) => setMask(e.target.value)}
                                placeholder="255.255.255.0"
                                className={errors.mask ? "border-destructive" : ""}
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <Label htmlFor="gateway">Gateway</Label>
                                {errors.gateway && <span className="text-[10px] text-destructive">{errors.gateway}</span>}
                            </div>
                            <Input
                                id="gateway"
                                value={gateway}
                                onChange={(e) => setGateway(e.target.value)}
                                placeholder="192.168.1.1"
                                className={errors.gateway ? "border-destructive" : ""}
                            />
                        </div>
                        <p className="text-[10px] text-muted-foreground bg-primary/5 rounded-md px-2 py-1.5">
                            💡 Set this router's IP to enable auto-assignment for other nodes.
                        </p>
                    </>
                )}

                {/* Hardware Specs (Model, CPU, RAM, Storage) */}
                <div className="space-y-3 pt-2 border-t">
                     <div className="space-y-1">
                        <Label htmlFor="model" className="text-xs text-muted-foreground">Model</Label>
                        <Input
                            id="model"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className="h-8 text-xs"
                            placeholder="e.g. Raspberry Pi 4"
                        />
                    </div>
                    
                    {['server', 'pc', 'minipc', 'sbc', 'nas'].includes(selectedNode.type) && (
                        <div className="space-y-1">
                            <Label htmlFor="cpu" className="text-xs text-muted-foreground">CPU</Label>
                            <Input
                                id="cpu"
                                value={cpu}
                                onChange={(e) => setCpu(e.target.value)}
                                className="h-8 text-xs"
                                placeholder="e.g. i5-12400"
                            />
                        </div>
                    )}

                    {['server', 'pc', 'minipc', 'sbc', 'nas', 'gpu'].includes(selectedNode.type) && (
                        <div className="space-y-1">
                            <Label htmlFor="ram" className="text-xs text-muted-foreground">
                                {selectedNode.type === 'gpu' ? 'VRAM' : 'RAM'}
                            </Label>
                            <Input
                                id="ram"
                                value={ram}
                                onChange={(e) => setRam(e.target.value)}
                                className="h-8 text-xs"
                                placeholder={selectedNode.type === 'gpu' ? "e.g. 12GB" : "e.g. 16GB"}
                            />
                        </div>
                    )}

                    {['server', 'pc', 'minipc', 'sbc', 'nas', 'disk'].includes(selectedNode.type) && (
                        <div className="space-y-1">
                            <Label htmlFor="storage" className="text-xs text-muted-foreground">Storage</Label>
                            <Input
                                id="storage"
                                value={storage}
                                onChange={(e) => setStorage(e.target.value)}
                                className="h-8 text-xs"
                                placeholder="e.g. 512GB NVMe"
                            />
                        </div>
                    )}
                </div>

                {/* Save / Delete */}
                <div className="flex gap-2 border-t pt-4">
                    <Button onClick={handleSave} className="flex-1" size="sm">
                        <Save className="h-4 w-4 mr-2" /> Save Changes
                    </Button>
                    <Button onClick={handleDelete} variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>

                {/* Component Manager (GPUs, Disks, etc) */}
                <InternalComponentManager nodeId={selectedNode.id} />

                {/* VM Manager (servers, PCs, NAS) */}
                {supportsVMs && (
                    <div className="border-t pt-4">
                        <VMManager nodeId={selectedNode.id} />
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
