import { useState, useCallback, useRef, useEffect } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    useReactFlow,
    type NodeTypes,
    ReactFlowProvider,
    Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useBuilderStore } from '../store/builder-store';
import { HardwareToolbox } from './hardware-toolbox';
import { HardwareNode as HardwareNodeComponent } from './hardware-node';
import { NodePropertiesPanel } from './node-properties-panel';
import { ComponentDetailsDialog } from './component-details-dialog';
import { Button } from '../../../components/ui/button';
import { Wand2 } from 'lucide-react';
import type { HardwareType, HardwareNode } from '../../../types';

const nodeTypes: NodeTypes = {
    hardware: HardwareNodeComponent
};

// ─── Keyboard shortcut hint bar ───────────────────────────────────────────────
function ShortcutHints() {
    return (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur border text-[10px] text-muted-foreground shadow-sm pointer-events-none select-none">
            <span><kbd className="font-mono bg-muted px-1 rounded">Del</kbd> delete</span>
            <span className="opacity-30">·</span>
            <span><kbd className="font-mono bg-muted px-1 rounded">Ctrl+D</kbd> duplicate</span>
            <span className="opacity-30">·</span>
            <span><kbd className="font-mono bg-muted px-1 rounded">Esc</kbd> deselect</span>
        </div>
    )
}

function Flow() {
    const reactFlowWrapper = useRef<HTMLDivElement>(null);

    const {
        nodes,
        edges,
        onNodesChange,
        onEdgesChange,
        onConnect,
        addHardware,
        removeHardware,
        duplicateHardware,
        selectNode,
        selectedNodeId,
        addInternalComponent,
        addVM,
        reassignAllIPs
    } = useBuilderStore();

    const { screenToFlowPosition, getIntersectingNodes } = useReactFlow();

    // ── Keyboard shortcuts ──────────────────────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Don't fire when typing in an input/textarea
            const tag = (e.target as HTMLElement).tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

            // Delete / Backspace — remove selected node
            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
                e.preventDefault()
                removeHardware(selectedNodeId)
                return
            }

            // Ctrl+D — duplicate selected node
            if (e.key === 'd' && (e.ctrlKey || e.metaKey) && selectedNodeId) {
                e.preventDefault()
                duplicateHardware(selectedNodeId)
                return
            }

            // Escape — deselect
            if (e.key === 'Escape') {
                selectNode(null)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [selectedNodeId, removeHardware, duplicateHardware, selectNode])

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    // ─── Component Drop Dialog State ──────────────────────────────────────────────
    const [pendingComponent, setPendingComponent] = useState<{ nodeId: string, type: HardwareType, name?: string, details?: any } | null>(null);
    const [pendingNode, setPendingNode] = useState<{ type: HardwareType, position: { x: number, y: number } } | null>(null);

    // ─── Dialog Confirmation Handler ──────────────────────────────────────────────
    const handleComponentConfirm = (data: { name: string, details: any }) => {
        if (pendingComponent) {
            addInternalComponent(pendingComponent.nodeId, {
                id: `comp-${Date.now()}`,
                type: pendingComponent.type,
                name: data.name,
                details: data.details
            });
            setPendingComponent(null);
        }
    };

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            // Check if dropped onto an existing node
            const intersecting = getIntersectingNodes({
                x: position.x,
                y: position.y,
                width: 1,
                height: 1,
            });

            const targetNode = intersecting[0]; // Take the top-most node

            // ── Parse drop data ─────────────────────────────────────────────
            let data: any = {};
            const dataStr = event.dataTransfer.getData('application/reactflow-data');
            const type = event.dataTransfer.getData('application/reactflow') as HardwareType;
            if (dataStr) {
                try {
                    data = JSON.parse(dataStr);
                } catch (e) { console.error("Failed to parse drop data", e); }
            } else if (type) {
                // Simple drag
                data = { type, name: `New ${type}` };
            }

            if (!data.type) return;

            // ── Case 1: Dropped onto a Node (Install as component/VM) ───────
            if (targetNode && targetNode.type === 'hardware') {
                const isServiceDrag = event.dataTransfer.getData('service-drag') === 'true';

                // Scenario A: Service Drag -> Add as VM/Container
                if (isServiceDrag) {
                    // Parse CPU/RAM from details string (e.g. "0.5 cores", "2048MB")
                    // Use parseFloat + ceil for CPU because "0.5" became 0 with parseInt
                    const cpuStr = data.details?.cpu
                    const ramStr = data.details?.ram
                    
                    const cpuVal = cpuStr ? Math.ceil(parseFloat(cpuStr)) : undefined
                    const ramVal = ramStr ? parseInt(ramStr, 10) : undefined

                    addVM(targetNode.id, {
                        id: `vm-${Date.now()}`,
                        name: data.name,
                        type: 'container', // Default to container for services
                        status: 'running',
                        cpu_cores: cpuVal || undefined, // undefined if 0 or NaN
                        ram_mb: ramVal || undefined,
                    });
                    return;
                }

                // Scenario B: Hardware Drag -> Open Config Dialog
                setPendingComponent({
                    nodeId: targetNode.id,
                    type: data.type,
                    name: data.name,
                    details: data.details
                });
                return;
            }

            // ── Case 2: Dropped on Canvas (Create new Node) ─────────────────

            // Prevent creating new nodes for "internal-only" types if we want?
            // User said "disks does not have ip". External drive?
            // Let's allow everything on canvas (external), but logic handles IPs.
            // Trigger Wizard instead of immediate add
            setPendingNode({
                type: data.type as HardwareType,
                position
            });
        },
        [screenToFlowPosition, getIntersectingNodes, addHardware, addInternalComponent, addVM, setPendingComponent, setPendingNode],
    );


    return (
        <div className="flex h-[calc(100vh-12rem)] border rounded-lg shadow-inner bg-background overflow-hidden relative">
            <HardwareToolbox />

            <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
                <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    nodeTypes={nodeTypes}
                    onDragOver={onDragOver}
                    onDrop={onDrop}
                    onNodeClick={(_, node) => {
                        if (node.type === 'hardware') selectNode(node.id)
                        else selectNode(null)
                    }}
                    onPaneClick={() => selectNode(null)}
                    fitView
                    attributionPosition="bottom-right"
                    className="bg-slate-50 dark:bg-slate-900/50"
                    defaultEdgeOptions={{
                        animated: true,
                        style: { stroke: '#f97316', strokeWidth: 2 }
                    }}
                    snapToGrid={true}
                    snapGrid={[20, 20]}
                    // Disable React Flow's built-in delete so our handler takes over
                    deleteKeyCode={null}
                >
                    <Background gap={20} size={1} />
                    <Controls />
                    
                    {/* Visual Tools like IP Reassign */}
                    <Panel position="top-right" className="flex gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-xs bg-background/80 backdrop-blur"
                            onClick={() => {
                                reassignAllIPs();
                            }}
                            title="Re-calculate all IP addresses based on router gateway"
                        >
                            <Wand2 className="h-3 w-3 mr-1" /> Reassign IPs
                        </Button>
                    </Panel>
                </ReactFlow>

                {/* Keyboard shortcut hint bar */}
                <ShortcutHints />

            {/* Dialog for Internal Components (Adding to Node) */}
            <ComponentDetailsDialog
                isOpen={!!pendingComponent}
                onClose={() => setPendingComponent(null)}
                // ... props handled below
                onConfirm={handleComponentConfirm}
                initialType={pendingComponent?.type || 'server'}
                initialName={pendingComponent?.name}
                initialDetails={pendingComponent?.details}
            />

            {/* Dialog for New Nodes (Wizard) */}
            <ComponentDetailsDialog
                isOpen={!!pendingNode}
                onClose={() => setPendingNode(null)}
                onConfirm={(data) => {
                    if (pendingNode) {
                        const newNode: HardwareNode = {
                            id: `node-${Date.now()}`,
                            type: pendingNode.type,
                            name: data.name,
                            details: data.details,
                            ip: '',
                            x: pendingNode.position.x,
                            y: pendingNode.position.y,
                            internal_components: [],
                            vms: []
                        };
                        addHardware(newNode);
                    }
                    setPendingNode(null);
                }}
                initialType={pendingNode?.type || 'server'}
                initialName={pendingNode?.type ? `New ${pendingNode.type}` : ''}
            />

            {/* Properties Panel Overlay */}
            <NodePropertiesPanel />

                {/* Component Config Dialog */}
                <ComponentDetailsDialog
                    isOpen={!!pendingComponent}
                    onClose={() => setPendingComponent(null)}
                    onConfirm={handleComponentConfirm}
                    initialType={pendingComponent?.type || 'disk'}
                    initialName={pendingComponent?.name}
                    initialDetails={pendingComponent?.details}
                />
            </div>
        </div>
    );
}

export function VisualBuilder() {
    return (
        <ReactFlowProvider>
            <Flow />
        </ReactFlowProvider>
    )
}
