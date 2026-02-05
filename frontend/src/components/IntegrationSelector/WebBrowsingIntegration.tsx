import { useEffect } from "react"

import { CheckCircle2Icon, GlobeIcon, SearchIcon, ShieldCheckIcon } from "lucide-react"

import { WebBrowsingConfig } from "@/shared/Configs"

import { InputConfigSelectorProps } from "./types"

export function WebBrowsingIntegration({ input, variant, setConfig }: InputConfigSelectorProps) {
    // Auto-set the config since web browsing requires no configuration
    useEffect(() => {
        if (!input.config) {
            setConfig(new WebBrowsingConfig())
        }
    }, [input.config, setConfig])

    if (variant === "card") {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2Icon className="size-3 text-green-500 shrink-0" />
                Ready to use
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg border">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <GlobeIcon className="size-5 text-primary" />
                </div>
                <div>
                    <h3 className="font-medium">Web Browsing</h3>
                    <p className="text-sm text-muted-foreground">Search and browse the web for information</p>
                </div>
            </div>

            <div className="space-y-3">
                <h4 className="text-sm font-medium">Capabilities</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                        <SearchIcon className="size-4 mt-0.5 text-primary shrink-0" />
                        <span>Search the web for real-time information and current events</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <GlobeIcon className="size-4 mt-0.5 text-primary shrink-0" />
                        <span>Access publicly available web content and documentation</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <ShieldCheckIcon className="size-4 mt-0.5 text-primary shrink-0" />
                        <span>Responses include source citations for transparency</span>
                    </li>
                </ul>
            </div>

            <div className="p-3 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 rounded-lg border border-green-200 dark:border-green-900">
                <div className="flex items-center gap-2">
                    <CheckCircle2Icon className="size-4 shrink-0" />
                    <span className="text-sm font-medium">No configuration required</span>
                </div>
                <p className="text-xs mt-1 text-green-600 dark:text-green-500">This capability is ready to use with no additional setup.</p>
            </div>
        </div>
    )
}
