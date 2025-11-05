import { SectionLayout } from "./SectionLayout";

export function FlowArrow() {
    return (
        <SectionLayout title={""}>
            <div className="flex justify-center relative -mb-6">
                <svg width="40" height="64" viewBox="0 0 40 64" className="overflow-visible">
                    {/* Main arrow path */}
                    <defs>
                        <linearGradient id="arrowGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="var(--color-destructive)" stopOpacity="0.2" />
                            <stop offset="100%" stopColor="var(--color-destructive)" stopOpacity="0.8" />
                        </linearGradient>
                    </defs>

                    {/* Arrow line */}
                    <line
                        x1="20"
                        y1="4"
                        x2="20"
                        y2="56"
                        stroke="url(#arrowGradient)"
                        strokeWidth="2"
                        strokeLinecap="round"
                    />

                    {/* Arrow head */}
                    <path
                        d="M 20 56 L 16 52 M 20 56 L 24 52"
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
                            path="M 20 4 L 20 56"
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
                            path="M 20 4 L 20 56"
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
                            path="M 20 4 L 20 56"
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
                            path="M 20 4 L 20 56"
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