import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SectionLayout } from "./SectionLayout";

export function FlowArrow() {
    return (
        <SectionLayout>
            <div className="flex justify-center items-center relative -mr-6">
                <svg width="64" height="40" viewBox="0 0 64 40" className="overflow-visible">
                    {/* Main arrow path */}
                    <defs>
                        <linearGradient id="arrowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="var(--color-destructive)" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="var(--color-destructive)" stopOpacity="0.8" />
                        </linearGradient>
                    </defs>

                    {/* Arrow line */}
                    <line
                        x1="4"
                        y1="20"
                        x2="56"
                        y2="20"
                        stroke="url(#arrowGradient)"
                        strokeWidth="2"
                        strokeLinecap="round"
                    />

                    {/* Arrow head */}
                    <path
                        d="M 56 20 L 52 16 M 56 20 L 52 24"
                        stroke="var(--color-destructive)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.8"
                    />

                    {/* Animated particles */}
                    <circle r="1.5" fill="var(--color-destructive)" opacity="0.8">
                        <animateMotion
                            dur="2s"
                            repeatCount="indefinite"
                            path="M 4 20 L 56 20"
                        />
                        <animate
                            attributeName="opacity"
                            values="0;0.8;0.8;0"
                            dur="2s"
                            repeatCount="indefinite"
                        />
                    </circle>

                    <circle r="1.5" fill="var(--color-destructive)" opacity="0">
                        <animateMotion
                            dur="2s"
                            repeatCount="indefinite"
                            path="M 4 20 L 56 20"
                            begin="0.5s"
                        />
                        <animate
                            attributeName="opacity"
                            values="0;0.8;0.8;0"
                            dur="2s"
                            repeatCount="indefinite"
                            begin="0.5s"
                        />
                    </circle>

                    <circle r="1.5" fill="var(--color-destructive)" opacity="0">
                        <animateMotion
                            dur="2s"
                            repeatCount="indefinite"
                            path="M 4 20 L 56 20"
                            begin="1s"
                        />
                        <animate
                            attributeName="opacity"
                            values="0;0.8;0.8;0"
                            dur="2s"
                            repeatCount="indefinite"
                            begin="1s"
                        />
                    </circle>

                    <circle r="1.5" fill="var(--color-destructive)" opacity="0">
                        <animateMotion
                            dur="2s"
                            repeatCount="indefinite"
                            path="M 4 20 L 56 20"
                            begin="1.5s"
                        />
                        <animate
                            attributeName="opacity"
                            values="0;0.8;0.8;0"
                            dur="2s"
                            repeatCount="indefinite"
                            begin="1.5s"
                        />
                    </circle>
                </svg>
            </div>
        </SectionLayout>
    )
}

type Conn = { id: string; from: React.RefObject<HTMLDivElement | null>; to: React.RefObject<HTMLDivElement | null> };

type SVGFlowArrowsProps = {
    containerRef: React.RefObject<HTMLDivElement | null>;
    connections: Conn[];
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

    useLayoutEffect(() => {
        const c = containerRef.current;
        if (!c) return;
        const onScroll = () => recompute();
        window.addEventListener("resize", recompute);
        c.addEventListener("scroll", onScroll, { passive: true });
        return () => {
          window.removeEventListener("resize", recompute);
          c.removeEventListener("scroll", onScroll);
        };
      }, [containerRef]);

      useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
    
        const observer = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const { width, height } = entry.contentRect;
            recompute();
            console.log("Size changed:", width, height);
          }
        });

        const els = connections.flatMap(c => [c.from.current, c.to.current]).filter(Boolean) as HTMLElement[];

        const observer2 = new ResizeObserver((entries) => {
            for (const entry of entries) {
              const { width, height } = entry.contentRect;
              recompute();
              console.log("Size changed:", width, height);
            }
          });

        els.forEach(el => observer2.observe(el));
    
        observer.observe(container);
        observer2.observe(container);
    
        return () => observer.disconnect();
      }, []);

    // Recompute when any endpoint resizes
    useLayoutEffect(() => {
        const obs = new ResizeObserver(recompute);
        const els = connections.flatMap(c => [c.from.current, c.to.current]).filter(Boolean) as HTMLElement[];
        els.forEach(el => obs.observe(el));
        const container = containerRef.current;
        if (container) obs.observe(container);
        return () => obs.disconnect();
    }, [connections, containerRef]);

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