function AwaitingResponseAnimation() {
    return (
        <div className="flex justify-start my-2 animate-fade-in-up">
            <div className="py-2 rounded-lg">
                <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full animate-bounce bg-accent-primary" style={{ animationDelay: '0ms'}}></div>
                    <div className="w-2 h-2 rounded-full animate-bounce bg-accent-secondary" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 rounded-full animate-bounce bg-accent-tertiary" style={{ animationDelay: '300ms' }}></div>
                </div>
            </div>
        </div>
    );
}

export { AwaitingResponseAnimation };