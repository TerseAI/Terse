import { useEffect, useState } from "react"

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

export function OrgLogo({ organizationId, alt, size = "md", className }: OrgLogoProps) {
    const { logoUrl, isLoading } = useOrgLogo(organizationId)
    const [imageLoaded, setImageLoaded] = useState(false)
    const [imageError, setImageError] = useState(false)

    const sizeClass = sizeClasses[size]
    const fallbackSrc = "/terse.png"
    const imageSrc = logoUrl || fallbackSrc

    // Reset loading states when logoUrl changes
    useEffect(() => {
        setImageLoaded(false)
        setImageError(false)
    }, [logoUrl])

    const handleLoad = () => {
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
                    className={cn("rounded-md object-cover transition-opacity duration-200", sizeClass, imageLoaded ? "opacity-100" : "opacity-0")}
                />
            )}
        </div>
    )
}
