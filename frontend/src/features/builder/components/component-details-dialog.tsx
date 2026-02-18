import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../../../components/ui/dialog"
import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"
import type { HardwareType, HardwareSpec } from "../../../types"

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (data: { name: string; details: HardwareSpec }) => void
    initialType: HardwareType
    initialName?: string
    initialDetails?: HardwareSpec
    title?: string // Added optional title prop as it's used in VisualBuilder
}

export function ComponentDetailsDialog({ open, onOpenChange, onConfirm, initialType, initialName, initialDetails, title }: Props) {
    const [name, setName] = useState(initialName || "")
    const [model, setModel] = useState(initialDetails?.model || "")
    const [spec, setSpec] = useState<HardwareSpec>(initialDetails || {})

    useEffect(() => {
        if (open) {
            setName(initialName || "")
            setModel(initialDetails?.model || "")
            setSpec(initialDetails || {})
        }
    }, [open, initialName, initialDetails])

    const handleConfirm = () => {
        onConfirm({
            name: name || `New ${initialType}`,
            details: { ...spec, model }
        })
        onOpenChange(false)
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{title || `Add ${initialType.toUpperCase()} Component`}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    {/* Name */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Name</Label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="col-span-3"
                            placeholder={`e.g. My ${initialType}`}
                            autoFocus
                        />
                    </div>

                    {/* Model - Always show */}
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="model" className="text-right">Model</Label>
                        <Input
                            id="model"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className="col-span-3"
                            placeholder="e.g. Samsung 980 Pro"
                        />
                    </div>

                    {/* CPU - Compute types */}
                    {['server', 'pc', 'minipc', 'sbc'].includes(initialType) && (
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="cpu" className="text-right">CPU</Label>
                            <Input
                                id="cpu"
                                value={spec.cpu || ''}
                                onChange={(e) => setSpec({...spec, cpu: e.target.value})}
                                className="col-span-3"
                                placeholder="e.g. i7-13700K"
                            />
                        </div>
                    )}

                    {/* RAM - Compute + GPU */}
                    {['server', 'pc', 'minipc', 'sbc', 'gpu', 'nas'].includes(initialType) && (
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="ram" className="text-right">
                                {initialType === 'gpu' ? 'VRAM' : 'RAM'}
                            </Label>
                            <Input
                                id="ram"
                                value={spec.ram || ''}
                                onChange={(e) => setSpec({...spec, ram: e.target.value})}
                                className="col-span-3"
                                placeholder={initialType === 'gpu' ? "e.g. 24GB" : "e.g. 32GB"}
                            />
                        </div>
                    )}

                    {/* Storage - Compute + Disk + NAS */}
                    {['server', 'pc', 'minipc', 'sbc', 'disk', 'nas'].includes(initialType) && (
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="storage" className="text-right">Storage</Label>
                            <Input
                                id="storage"
                                value={spec.storage || ''}
                                onChange={(e) => setSpec({...spec, storage: e.target.value})}
                                className="col-span-3"
                                placeholder="e.g. 4TB"
                            />
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleConfirm}>Add Component</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
