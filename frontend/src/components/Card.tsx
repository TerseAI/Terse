function Card({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <div className={`bg-[theme(background)] rounded-lg p-3 shadow-lg backdrop-blur-sm ${className} shadow-[var(--shadow)] transition duration-200`}>
            {children}
        </div>
    )
}

export default Card;