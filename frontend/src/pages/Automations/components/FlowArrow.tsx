import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type Conn = { id: string; from: React.RefObject<HTMLDivElement | null>; to: React.RefObject<HTMLDivElement | null> };

type SVGFlowArrowsProps = {
    containerRef: React.RefObject<HTMLDivElement | null>;
    connections: Conn[];
}

export function SVGFlowArrows({
    containerRef,
    connections,
}: SVGFlowArrowsProps) {
    if (!containerRef || !connections.length) {
        return null;
    }

    const svgRef = useRef<SVGSVGElement>(null);
    const [tick, setTick] = useState(0); // force re-render

    const recompute = useCallback(() => setTick(t => t + 1), []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new ResizeObserver(() => {
            recompute();
        });

        // Observe the container and all connected elements
        observer.observe(container);
        connections.forEach(({ from, to }) => {
            if (from.current) observer.observe(from.current);
            if (to.current) observer.observe(to.current);
        });

        return () => {
            observer.disconnect();
        };
    }, [connections, recompute]);

    const paths = useMemo(() => {
        const container = containerRef.current;
        if (!container) return [];
        return connections.map(({ id, from, to }) => {
            const fromPoint = from.current && getEdgePoint(from.current, container, 'right');
            const toPoint = to.current && getEdgePoint(to.current, container, 'left');
            if (!fromPoint || !toPoint) return { id, d: null as string | null };
            // Smooth cubic Bézier: control points biased horizontally
            const dx = Math.max(40, Math.abs(toPoint.x - fromPoint.x) * 0.5);
            const c1 = { x: fromPoint.x + dx, y: fromPoint.y };
            const c2 = { x: toPoint.x - dx, y: toPoint.y };
            const d = `M ${fromPoint.x},${fromPoint.y} C ${c1.x},${c1.y} ${c2.x},${c2.y} ${toPoint.x},${toPoint.y}`;
            return { id, d };
        });
    }, [connections, containerRef, tick]);

    return (
        <svg ref={svgRef} className="absolute inset-0 pointer-events-none overflow-visible">
            <defs>
                <marker id="arrow" markerWidth="10" markerHeight="10" refX="7" refY="5" orient="auto">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-primary)" />
                </marker>
            </defs>
            {paths.map(p =>
                p.d ? (
                    <g key={p.id}>
                        {/* hit area (optional for hover/click if you turn pointerEvents back on) */}
                        {/* <path d={p.d} stroke="transparent" strokeWidth={16} fill="none" pointerEvents="stroke" /> */}
                        <path d={p.d} strokeWidth={2} stroke="var(--color-primary)" fill="none" markerEnd="url(#arrow)" />
                    </g>
                ) : null
            )}
        </svg>
    );
}

function getEdgePoint(
    el: HTMLElement,
    container: HTMLElement,
    side: 'left' | 'right' | 'top' | 'bottom' | 'center' = 'center'
) {
    const r = el.getBoundingClientRect();
    const c = container.getBoundingClientRect();

    switch (side) {
        case 'left':
            return { x: r.left - c.left, y: r.top - c.top + r.height / 2 };
        case 'right':
            return { x: r.right - c.left, y: r.top - c.top + r.height / 2 };
        case 'top':
            return { x: r.left - c.left + r.width / 2, y: r.top - c.top };
        case 'bottom':
            return { x: r.left - c.left + r.width / 2, y: r.bottom - c.top };
        default:
            return { x: r.left - c.left + r.width / 2, y: r.top - c.top + r.height / 2 };
    }
}
