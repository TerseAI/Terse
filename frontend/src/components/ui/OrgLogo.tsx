import { useRef, useState } from "react"

import { useOrgLogo } from "@/hooks/api/useOrgLogo"
import { cn } from "@/lib/utils"

import { Skeleton } from "./skeleton"

interface OrgLogoProps {
    organizationId: string | null | undefined
    alt: string
    size?: "sm" | "md" | "lg"
    className?: string
}

const sizeClasses = {
    sm: "size-6",
    md: "size-8",
    lg: "size-10"
}

// Track successfully loaded image URLs at the module level so remounted
// components (e.g. inside a dropdown portal) don't flash from opacity-0.
const loadedSrcs = new Set<string>()

export function OrgLogo({ organizationId, alt, size = "md", className }: OrgLogoProps) {
    const { logoUrl, isLoading } = useOrgLogo(organizationId)

    const sizeClass = sizeClasses[size]
    const fallbackSrc = "/terse.png"
    const imageSrc = logoUrl || fallbackSrc

    const [imageLoaded, setImageLoaded] = useState(() => loadedSrcs.has(imageSrc))
    const [imageError, setImageError] = useState(false)
    const lastSrcRef = useRef(imageSrc)

    // Reset loading states only when the URL actually changes
    if (lastSrcRef.current !== imageSrc) {
        lastSrcRef.current = imageSrc
        setImageLoaded(loadedSrcs.has(imageSrc))
        setImageError(false)
    }

    const handleLoad = () => {
        loadedSrcs.add(imageSrc)
        setImageLoaded(true)
    }

    const handleError = () => {
        setImageError(true)
        setImageLoaded(true)
    }

    return (
        <div className={cn("relative shrink-0", sizeClass, className)}>
            {isLoading && <Skeleton className={cn("absolute inset-0 rounded-md", sizeClass)} />}
            {!isLoading && (
                <img
                    src={imageError ? fallbackSrc : imageSrc}
                    alt={alt}
                    onLoad={handleLoad}
                    onError={handleError}
                    className={cn("rounded-md transition-opacity duration-200", sizeClass, imageLoaded ? "opacity-100" : "opacity-0")}
                />
            )}
        </div>
    )
}
