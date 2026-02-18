
import { Router, Server, HardDrive, Wifi, CircuitBoard, Monitor } from "lucide-react"
import { Card } from "../../../components/ui/card"
import type { HardwareType } from "../../../types"

const HARDWARE_TOOLS: { type: HardwareType; label: string; icon: React.ElementType }[] = [
    { type: 'server', label: 'Server', icon: Server },
    { type: 'pc', label: 'PC / Workstation', icon: Monitor },
    { type: 'router', label: 'Router', icon: Router },
    { type: 'switch', label: 'Switch', icon: CircuitBoard },
    { type: 'access_point', label: 'Access Point', icon: Wifi },
    { type: 'nas', label: 'NAS', icon: HardDrive },
]

export function HardwareToolbox() {
    const onDragStart = (event: React.DragEvent, nodeType: HardwareType) => {
        event.dataTransfer.setData('application/reactflow', nodeType);
        event.dataTransfer.effectAllowed = 'move';
    };

    return (
        <Card className="p-4 w-64 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <h3 className="font-semibold mb-3 text-sm">Hardware Toolbox</h3>
            <div className="grid grid-cols-2 gap-2">
                {HARDWARE_TOOLS.map((tool) => (
                    <div
                        key={tool.type}
                        className="flex flex-col items-center justify-center p-3 border rounded-md cursor-grab hover:bg-muted/50 transition-colors bg-card"
                        onDragStart={(event) => onDragStart(event, tool.type)}
                        draggable
                    >
                        <tool.icon className="h-6 w-6 mb-2 text-primary" />
                        <span className="text-xs text-center">{tool.label}</span>
                    </div>
                ))}
            </div>
            <p className="text-xs text-muted-foreground mt-4 text-center">
                Drag nodes to the canvas
            </p>
        </Card>
    )
}
