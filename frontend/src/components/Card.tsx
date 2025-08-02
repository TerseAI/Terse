function Card({ children }: { children: React.ReactNode }) {
    return (
        <div className="bg-[theme(background-surface)] rounded-lg p-4 shadow-lg">
            {children}
        </div>
    )
}

export default Card;