export enum Size {
    Tiny = "4",
    Small = "8",
    Medium = "16",
    Large = "24"
}

const sizeClasses: Record<Size, string> = {
    [Size.Tiny]: "h-4 w-4",
    [Size.Small]: "h-8 w-8",
    [Size.Medium]: "h-16 w-16",
    [Size.Large]: "h-24 w-24"
}

function Spin({ size = Size.Medium }: { size?: Size }) {
    return (
        <div className="grid place-items-center py-2">
            <div className={`animate-spin rounded-full ${sizeClasses[size]} border-b-2 border-accent`}></div>
        </div>
    )
}

export default Spin
