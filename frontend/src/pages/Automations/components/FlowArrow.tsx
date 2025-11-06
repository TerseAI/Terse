import { SectionLayout } from "./SectionLayout";

export function FlowArrow() {
    return (
        <SectionLayout title={""}>
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