const processMarkdown = (text: string) => {
    let processed = text;
    // Handle code blocks ```
    processed = processed.replace(/```([\s\S]*?)```/g, 
        '<pre class="bg-gray-800 rounded p-4 overflow-x-auto my-4 font-mono"><code>$1</code></pre>'
    );
    // Handle bold **text**
    processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold">$1</strong>');
    // Handle italic *text* (but not **text**)
    processed = processed.replace(/(?<!\*)\*(?!\*)([^*]+?)(?<!\*)\*(?!\*)/g, '<em class="italic">$1</em>');
    // Handle inline code `text`
    processed = processed.replace(/`([^`]+)`/g, '<code class="bg-gray-800 px-1 rounded font-mono text-sm">$1</code>');
    // Handle headers
    processed = processed.replace(/^#### (.*$)/gm, '<h3 class="text-lg font-bold mb-2 mt-4">$1</h3>');
    processed = processed.replace(/^### (.*$)/gm, '<h3 class="text-lg font-bold mb-2 mt-4">$1</h3>');
    processed = processed.replace(/^## (.*$)/gm, '<h2 class="text-xl font-bold mb-3 mt-6">$1</h2>');
    processed = processed.replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold mb-4 mt-8">$1</h1>');
    // Handle bullet lists - simple approach
    processed = processed.replace(/^\* (.*)$/gm, '• $1');
    processed = processed.replace(/^- (.*)$/gm, '• $1');
    processed = processed.replace(/^\+ (.*)$/gm, '• $1');
    // Handle numbered lists - simple approach
    processed = processed.replace(/^(\d+)\. (.*)$/gm, '$1. $2');
    return <span dangerouslySetInnerHTML={{ __html: processed }} />;
};

export default processMarkdown;