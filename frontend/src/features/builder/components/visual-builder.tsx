import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { Wand2, Menu, Save, Folder, Download, LogOut } from 'lucide-react';
import type { HardwareType, HardwareNode } from '../../../types';
import { buildApi } from '../api/builds';
import { useAuth } from '../../admin/hooks/use-auth';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";

const nodeTypes: NodeTypes = {
    hardware: HardwareNodeComponent
};

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
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const { logout } = useAuth();

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
        reassignAllIPs,
        loadBuild,
        getBuildData,
        currentBuildId
    } = useBuilderStore();

    const { screenToFlowPosition, getIntersectingNodes } = useReactFlow();

    useEffect(() => {
        if (id && id !== currentBuildId) {
            buildApi.get(id).then(build => {
                const data = JSON.parse(build.data);
                loadBuild(build.id, data);
            }).catch(err => {
                console.error("Failed to load build", err);
                navigate('/');
            });
        }
    }, [id, currentBuildId, loadBuild, navigate]);

    const handleSave = async () => {
        if (!id) return;
        try {
            const data = getBuildData();
            await buildApi.update(id, {
                name: "My Homelab",
                data: JSON.stringify(data),
                thumbnail: "" 
            });
             alert("Build saved successfully!");
        } catch (err) {
            console.error("Failed to save", err);
            alert("Failed to save build.");
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement).tagName
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
                return;
            }

            if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId) {
                e.preventDefault()
                removeHardware(selectedNodeId)
                return
            }

            if (e.key === 'd' && (e.ctrlKey || e.metaKey) && selectedNodeId) {
                e.preventDefault()
                duplicateHardware(selectedNodeId)
                return
            }

            if (e.key === 'Escape') {
                selectNode(null)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [selectedNodeId, removeHardware, duplicateHardware, selectNode, handleSave])

    const onDragOver = useCallback((event: React.DragEvent) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }, []);

    const [pendingComponent, setPendingComponent] = useState<{ nodeId: string, type: HardwareType, name?: string, details?: any } | null>(null);
    const [pendingNode, setPendingNode] = useState<{ type: HardwareType, position: { x: number, y: number } } | null>(null);

    const handleComponentConfirm = (data: { name: string, details: any }) => {
        if (pendingComponent) {
            addInternalComponent(pendingComponent.nodeId, {
                id: `comp-${Date.now()}`,
                type: pendingComponent.type,
                name: data.name,
                details: data.details
            });
            setPendingComponent(null);
        } else if (pendingNode) {
            const newNode: HardwareNode = {
                id: `node-${Date.now()}`,
                type: pendingNode.type,
                name: data.name,
                x: pendingNode.position.x,
                y: pendingNode.position.y,
                details: data.details,
                internal_components: [],
                vms: []
            };
            addHardware(newNode);
            setPendingNode(null);
        }
    };

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const position = screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
            });

            const intersecting = getIntersectingNodes({
                x: position.x,
                y: position.y,
                width: 1,
                height: 1,
            });

            const targetNode = intersecting[0];

            let data: any = {};
            const dataStr = event.dataTransfer.getData('application/reactflow-data');
            const type = event.dataTransfer.getData('application/reactflow') as HardwareType;
            if (dataStr) {
                try {
                    data = JSON.parse(dataStr);
                } catch (e) { console.error("Failed to parse drop data", e); }
            } else if (type) {
                data = { type, name: `New ${type}` };
            }

            if (!data.type) return;

            if (targetNode && targetNode.type === 'hardware') {
                const isServiceDrag = event.dataTransfer.getData('service-drag') === 'true';

                if (isServiceDrag) {
                    const cpuStr = data.details?.cpu
                    const ramStr = data.details?.ram
                    
                    const cpuVal = cpuStr ? Math.ceil(parseFloat(cpuStr)) : undefined
                    const ramVal = ramStr ? parseInt(ramStr, 10) : undefined

                    addVM(targetNode.id, {
                        id: `vm-${Date.now()}`,
                        name: data.name,
                        type: 'container',
                        status: 'running',
                        cpu_cores: cpuVal || undefined,
                        ram_mb: ramVal || undefined,
                    });
                    return;
                }

                setPendingComponent({
                    nodeId: targetNode.id,
                    type: data.type,
                    name: data.name,
                    details: data.details
                });
                return;
            }

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
                    deleteKeyCode={null}
                >
                    <Background gap={20} size={1} />
                    <Controls />
                    
                    <Panel position="top-left" className="flex gap-2">
                     <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-10 w-10 bg-background/80 backdrop-blur">
                                <Menu className="h-5 w-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                            <DropdownMenuLabel>Project Menu</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleSave}>
                                <Save className="mr-2 h-4 w-4" /> Save Project <span className="ml-auto text-xs text-muted-foreground opacity-60">Ctrl+S</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate('/')}>
                                <Folder className="mr-2 h-4 w-4" /> My Projects
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate('/generate')}>
                                <Download className="mr-2 h-4 w-4" /> Export / Generate Config
                            </DropdownMenuItem>
                             <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate('/services')}>
                                <Wand2 className="mr-2 h-4 w-4" /> Component Catalog
                            </DropdownMenuItem>
                             <DropdownMenuSeparator />
                             <DropdownMenuItem onClick={logout} className="text-red-500 focus:text-red-500">
                                <LogOut className="mr-2 h-4 w-4" /> Sign Out
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button variant="secondary" onClick={() => reassignAllIPs()} title="Fix IP Conflicts" size="sm" className="h-10 bg-background/80 backdrop-blur">
                        <Wand2 className="mr-2 h-4 w-4" />
                        Reassign IPs
                    </Button>
                </Panel>

                <Panel position="top-right">
                    {selectedNodeId && <NodePropertiesPanel />}
                </Panel>

                <ShortcutHints />
                </ReactFlow>
            </div>

            <ComponentDetailsDialog
                open={!!pendingComponent}
                onOpenChange={(v) => !v && setPendingComponent(null)}
                initialType={pendingComponent?.type || 'disk'}
                initialName={pendingComponent?.name}
                initialDetails={pendingComponent?.details}
                onConfirm={handleComponentConfirm}
            />

            <ComponentDetailsDialog
                open={!!pendingNode}
                onOpenChange={(v) => !v && setPendingNode(null)}
                initialType={pendingNode?.type || 'server'}
                title="New Node Details"
                onConfirm={handleComponentConfirm}
            />
        </div>
    );
}

export default function VisualBuilderPage() {
    return (
        <ReactFlowProvider>
            <Flow />
        </ReactFlowProvider>
    );
}
