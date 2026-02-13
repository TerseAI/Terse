import { useCallback, useEffect, useState } from "react"

import { useAuth } from "@/services/auth"

function ImpersonationButton({
    children,
    style,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            type="button"
            {...props}
            style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                height: "1.714em",
                padding: "0 0.6em",
                fontFamily: "inherit",
                fontSize: "inherit",
                borderRadius: "min(max(calc(var(--wi-s) * 0.6), 1px), 7px)",
                border: "none",
                backgroundColor: "var(--wi-c)",
                color: "white",
                cursor: "pointer",
                ...style
            }}
        >
            {children}
        </button>
    )
}

function MinMaxButton({ children, minimizedValue }: { children: React.ReactNode; minimizedValue: string }) {
    return (
        <ImpersonationButton
            onClick={() => {
                const root = document.querySelector("[data-workos-impersonation-root]") as HTMLElement | null
                root?.style.setProperty("--wi-minimized", minimizedValue)
            }}
            style={{ padding: 0, width: "1.714em" }}
        >
            {children}
        </ImpersonationButton>
    )
}

export function Impersonation({ side = "bottom" }: { side?: "top" | "bottom" }) {
    const { user, logout } = useAuth()
    const impersonator = user?.impersonator
    const [organizationName, setOrganizationName] = useState<string | null>(null)

    useEffect(() => {
        if (!impersonator || !user?.organizationName) return
        setOrganizationName(user.organizationName)
    }, [impersonator, user?.organizationName])

    const handleStop = useCallback(
        (e: React.FormEvent) => {
            e.preventDefault()
            logout()
        },
        [logout]
    )

    if (!impersonator || !user) return null

    return (
        <div
            data-workos-impersonation-root=""
            style={{
                position: "fixed",
                inset: 0,
                pointerEvents: "none",
                zIndex: 9999,
                "--wi-minimized": "0",
                "--wi-s": "min(max(var(--workos-impersonation-size, 4px), 2px), 15px)",
                "--wi-bgc": "var(--workos-impersonation-background-color, #fce654)",
                "--wi-c": "var(--workos-impersonation-color, #1a1600)",
                "--wi-bc": "var(--workos-impersonation-border-color, #e0c36c)",
                "--wi-bw": "var(--workos-impersonation-border-width, 1px)"
            } as React.CSSProperties}
        >
            {/* Yellow border frame */}
            <div
                style={{
                    "--wi-frame-size": "calc(var(--wi-s) * (1 - var(--wi-minimized)) + var(--wi-minimized) * var(--wi-bw) * -1)",
                    position: "absolute",
                    inset: "calc(var(--wi-frame-size) * -1)",
                    borderRadius: "calc(var(--wi-frame-size) * 3)",
                    boxShadow: `
                        inset 0 0 0 calc(var(--wi-frame-size) * 2) var(--wi-bgc),
                        inset 0 0 0 calc(var(--wi-frame-size) * 2 + var(--wi-bw)) var(--wi-bc)
                    `,
                    transition: "all 500ms cubic-bezier(0.16, 1, 0.3, 1)"
                } as React.CSSProperties}
            />

            {/* Banner bar */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "center",
                    position: "fixed",
                    left: 0,
                    right: 0,
                    ...(side === "top" && { top: "var(--wi-s)" }),
                    ...(side === "bottom" && { bottom: "var(--wi-s)" }),
                    fontFamily:
                        "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif",
                    fontSize: "calc(12px + var(--wi-s) * 0.5)",
                    lineHeight: "1.4"
                }}
            >
                <form
                    onSubmit={handleStop}
                    style={{
                        display: "flex",
                        alignItems: "baseline",
                        paddingLeft: "var(--wi-s)",
                        paddingRight: "var(--wi-s)",
                        position: "relative",
                        marginLeft: "calc(var(--wi-s) * 2)",
                        marginRight: "calc(var(--wi-s) * 2)",
                        pointerEvents: "auto",
                        backgroundColor: "var(--wi-bgc)",
                        borderStyle: "solid",
                        borderColor: "var(--wi-bc)",
                        borderLeftWidth: "var(--wi-bw)",
                        borderRightWidth: "var(--wi-bw)",
                        transition: "all 500ms cubic-bezier(0.16, 1, 0.3, 1)",
                        transform: "translateX(calc(var(--wi-minimized) * (var(--wi-s) * 10 - 5%)))",
                        opacity: "calc(1 - var(--wi-minimized))",
                        zIndex: "calc(1 - var(--wi-minimized))",
                        ...(side === "top" && {
                            paddingTop: 0,
                            paddingBottom: "var(--wi-s)",
                            borderTopWidth: 0,
                            borderBottomWidth: "var(--wi-bw)",
                            borderBottomLeftRadius: "var(--wi-s)",
                            borderBottomRightRadius: "var(--wi-s)"
                        }),
                        ...(side === "bottom" && {
                            paddingTop: "var(--wi-s)",
                            paddingBottom: 0,
                            borderTopWidth: "var(--wi-bw)",
                            borderBottomWidth: 0,
                            borderTopLeftRadius: "var(--wi-s)",
                            borderTopRightRadius: "var(--wi-s)"
                        })
                    } as React.CSSProperties}
                >
                    <p style={{ all: "unset", color: "var(--wi-c)", textWrap: "balance", marginLeft: "var(--wi-s)" } as React.CSSProperties}>
                        You are impersonating <b>{user.email}</b>{" "}
                        {organizationName && (
                            <>
                                within the <b>{organizationName}</b> organization
                            </>
                        )}
                    </p>
                    <ImpersonationButton
                        type="submit"
                        style={{ marginLeft: "calc(var(--wi-s) * 2)", marginRight: "var(--wi-s)" }}
                    >
                        Stop
                    </ImpersonationButton>
                    <MinMaxButton minimizedValue="1">{side === "top" ? "\u2197" : "\u2198"}</MinMaxButton>
                </form>

                {/* Minimized restore button */}
                <div
                    style={{
                        padding: "var(--wi-s)",
                        position: "fixed",
                        right: "var(--wi-s)",
                        pointerEvents: "auto",
                        backgroundColor: "var(--wi-bgc)",
                        border: "var(--wi-bw) solid var(--wi-bc)",
                        borderRadius: "var(--wi-s)",
                        transition: "all 500ms cubic-bezier(0.16, 1, 0.3, 1)",
                        transform: "translateX(calc((1 - var(--wi-minimized)) * var(--wi-s) * -5))",
                        opacity: "var(--wi-minimized)",
                        zIndex: "var(--wi-minimized)",
                        ...(side === "top" && { top: "var(--wi-s)" }),
                        ...(side === "bottom" && { bottom: "var(--wi-s)" })
                    } as React.CSSProperties}
                >
                    <MinMaxButton minimizedValue="0">{side === "top" ? "\u2199" : "\u2196"}</MinMaxButton>
                </div>
            </div>
        </div>
    )
}
