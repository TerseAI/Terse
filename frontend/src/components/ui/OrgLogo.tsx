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

// Track orgs whose logos have been successfully loaded. Keyed by
// organizationId so the cache survives presigned-URL changes.
const loadedOrgIds = new Set<string>()

export function OrgLogo({ organizationId, alt, size = "md", className }: OrgLogoProps) {
    const { logoUrl, isLoading } = useOrgLogo(organizationId)

    const sizeClass = sizeClasses[size]
    const fallbackSrc = "/terse.png"
    const imageSrc = logoUrl || fallbackSrc

    const isKnownLoaded = organizationId ? loadedOrgIds.has(organizationId) : false
    const [imageLoaded, setImageLoaded] = useState(isKnownLoaded)
    const [imageError, setImageError] = useState(false)
    const lastSrcRef = useRef(imageSrc)

    // Reset loading states only when the URL actually changes
    if (lastSrcRef.current !== imageSrc) {
        lastSrcRef.current = imageSrc
        setImageLoaded(isKnownLoaded)
        setImageError(false)
    }

    const handleLoad = () => {
        if (organizationId) loadedOrgIds.add(organizationId)
        setImageLoaded(true)
    }

    const handleError = () => {
        setImageError(true)
        setImageLoaded(true)
    }

    // Skip the loading skeleton entirely when we already loaded this org's logo
    const showSkeleton = isLoading && !isKnownLoaded

    return (
        <div className={cn("relative shrink-0", sizeClass, className)}>
            {showSkeleton && <Skeleton className={cn("absolute inset-0 rounded-md", sizeClass)} />}
            {!showSkeleton && (
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
