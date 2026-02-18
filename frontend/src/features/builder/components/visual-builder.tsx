import { useMemo, useCallback, useRef } from 'react';
import { 
    ReactFlow, 
    Background, 
    Controls, 
    type Node, 
    type Edge, 
    Position,
    useReactFlow,
    type NodeTypes,
    ReactFlowProvider
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useBuilderStore } from '../store/builder-store';
import { HardwareToolbox } from './hardware-toolbox';
import { HardwareNode } from './hardware-node';
import { NodePropertiesPanel } from './node-properties-panel';
import type { HardwareType } from '../../../types';

const nodeTypes: NodeTypes = {
    hardware: HardwareNode
};

function Flow() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { selectedServices, hardwareNodes, addHardware, selectNode, selectedNodeId } = useBuilderStore();
  const { screenToFlowPosition } = useReactFlow();

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // 1. Hardware Nodes (Manually placed)
    hardwareNodes.forEach((node) => {
        nodes.push({
            id: node.id,
            type: 'hardware', 
            data: { 
                label: node.name, 
                type: node.type,
                ip: node.ip 
            },
            position: { x: node.x, y: node.y },
            selected: node.id === selectedNodeId
        });
    });

    // 2. Default Server Node checks
    const hasHardware = hardwareNodes.length > 0;
    const serverNodeId = hardwareNodes.find(n => n.type === 'server' || n.type === 'pc')?.id || 'default-server';
    
    if (!hasHardware) {
        nodes.push({
            id: 'default-server',
            data: { label: '🏠 Home Server' },
            position: { x: 250, y: 50 },
            type: 'input', 
            style: { background: '#f97316', color: 'white', fontWeight: 'bold' }
        });
    }

    // 3. Service Nodes (Attached to Server)
    selectedServices.forEach((service, index) => {
      const id = service.id;
      // Position services relative to the "Server" node if possible, 
      // but for now simple grid is fine.
      const x = (index % 3) * 200;
      const y = 300 + Math.floor(index / 3) * 100;

      nodes.push({
        id,
        data: { label: service.name },
        position: { x, y },
        sourcePosition: Position.Top,
        targetPosition: Position.Bottom,
        // Service nodes use default type for now
      });

      edges.push({
        id: `e-${serverNodeId}-${id}`,
        source: serverNodeId,
        target: id,
        animated: true,
        style: { stroke: '#f97316' }
      });
    });

    return { nodes, edges };
  }, [selectedServices, hardwareNodes, selectedNodeId]);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow') as HardwareType;

      if (typeof type === 'undefined' || !type) {
        return;
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const newNode = {
        id: `node-${Date.now()}`,
        type,
        name: `New ${type}`,
        x: position.x,
        y: position.y,
        ip: '',
      };

      addHardware(newNode);
    },
    [screenToFlowPosition, addHardware],
  );

  return (
    <div className="flex h-[calc(100vh-12rem)] border rounded-lg shadow-inner bg-background overflow-hidden relative">
        <HardwareToolbox />
        
        <div className="flex-1 h-full relative" ref={reactFlowWrapper}>
            <ReactFlow 
                nodes={nodes} 
                edges={edges} 
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
            >
                <Background gap={12} size={1} />
                <Controls />
            </ReactFlow>

            {/* Properties Panel Overlay */}
            <NodePropertiesPanel />
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


