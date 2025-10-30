function Card({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <div className={`bg-[theme(background)] rounded-lg p-3 shadow-[var(--shadow)] backdrop-blur-sm ${className} transition duration-200`}>
            {children}
        </div>
    )
}

export default Card;