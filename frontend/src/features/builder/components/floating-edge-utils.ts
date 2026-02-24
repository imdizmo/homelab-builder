import { Position, type InternalNode } from '@xyflow/react';

// returns the parameters (sx, sy, tx, ty, sourcePos, targetPos) you need to create an edge
export function getEdgeParams(source: InternalNode, target: InternalNode) {
    const [sx, sy, sourcePos] = getParams(source, target);
    const [tx, ty, targetPos] = getParams(target, source);

    return {
        sx,
        sy,
        tx,
        ty,
        sourcePos,
        targetPos,
    };
}

function getParams(nodeA: InternalNode, nodeB: InternalNode): [number, number, Position] {
    const centerA = getNodeCenter(nodeA);
    const centerB = getNodeCenter(nodeB);

    const horizontalDiff = Math.abs(centerA.x - centerB.x);
    const verticalDiff = Math.abs(centerA.y - centerB.y);

    let position: Position;

    // when the horizontal difference between the nodes is bigger, we use Position.Left or Position.Right
    if (horizontalDiff > verticalDiff) {
        position = centerA.x > centerB.x ? Position.Left : Position.Right;
    } else {
        // here the vertical difference between the nodes is bigger, so we use Position.Top or Position.Bottom
        position = centerA.y > centerB.y ? Position.Top : Position.Bottom;
    }

    const [x, y] = getPointOnNodeBorder(nodeA, position);
    return [x, y, position];
}

function getPointOnNodeBorder(node: InternalNode, position: Position): [number, number] {
    const { width = 0, height = 0 } = node.measured;
    const x = node.internals.positionAbsolute.x;
    const y = node.internals.positionAbsolute.y;

    switch (position) {
        case Position.Top:
            return [x + width / 2, y];
        case Position.Bottom:
            return [x + width / 2, y + height];
        case Position.Left:
            return [x, y + height / 2];
        case Position.Right:
            return [x + width, y + height / 2];
        default:
            return [x + width / 2, y + height / 2];
    }
}

function getNodeCenter(node: InternalNode) {
    return {
        x: node.internals.positionAbsolute.x + (node.measured.width || 0) / 2,
        y: node.internals.positionAbsolute.y + (node.measured.height || 0) / 2,
    };
}
