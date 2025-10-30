function Card({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <div className={`bg-[theme(background-light)] rounded-lg p-3 shadow-[var(--shadow)] backdrop-blur-sm overflow-hidden ${className} transition duration-200`}>
            {children}
        </div>
    )
}

export default Card;