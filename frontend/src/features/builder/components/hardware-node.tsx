
import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Server, Router, CircuitBoard, HardDrive, Wifi, Monitor } from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { cn } from '../../../lib/utils';
import type { HardwareType } from '../../../types';

type HardwareNodeData = {
    label: string;
    type: HardwareType;
    ip?: string;
    status?: 'online' | 'offline' | 'warning';
};

const ICONS = {
    server: Server,
    pc: Monitor,
    router: Router,
    switch: CircuitBoard,
    access_point: Wifi,
    nas: HardDrive
};

export const HardwareNode = memo(({ data, selected }: NodeProps) => {
    // Cast data safely
    const nodeData = data as unknown as HardwareNodeData;
    const Icon = ICONS[nodeData.type] || Server;

    // Type-based styling
    const colorClass = 
        nodeData.type === 'router' ? 'border-purple-500 bg-purple-500/10' :
        nodeData.type === 'switch' ? 'border-blue-500 bg-blue-500/10' :
        nodeData.type === 'server' ? 'border-orange-500 bg-orange-500/10' :
        nodeData.type === 'nas' ? 'border-green-500 bg-green-500/10' :
        'border-gray-500 bg-gray-500/10';

    return (
        <div className="relative group">
            <Handle type="target" position={Position.Top} className="!bg-muted-foreground w-3 h-3" />
            
            <Card className={cn(
                "w-48 transition-all duration-200 border-2 overflow-hidden shadow-sm",
                colorClass,
                selected ? "ring-2 ring-primary shadow-lg scale-105" : "hover:border-primary/50"
            )}>
                {/* Header */}
                <div className={cn(
                    "px-3 py-2 flex items-center gap-2 border-b bg-background/50 backdrop-blur-sm",
                    selected ? "bg-primary/5" : ""
                )}>
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="font-semibold text-sm truncate" title={nodeData.label}>
                        {nodeData.label}
                    </span>
                </div>

                {/* Body */}
                <div className="p-3 bg-background/80 backdrop-blur-sm space-y-2">
                    {/* IP Address */}
                    <div className="text-xs font-mono text-muted-foreground flex items-center justify-between">
                        <span>IP:</span>
                        <span className={cn(nodeData.ip ? "text-foreground" : "italic opacity-50")}>
                            {nodeData.ip || 'DHCP'}
                        </span>
                    </div>

                    {/* Status Dot */}
                    <div className="flex items-center gap-1.5 justify-end">
                        <span className="text-[10px] uppercase text-muted-foreground font-medium">Online</span>
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                        </span>
                    </div>
                </div>
            </Card>

            <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground w-3 h-3" />
        </div>
    );
});
