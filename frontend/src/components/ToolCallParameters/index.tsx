const ToolTypes = {
    SEARCH: 'search',
    OPEN_PAGE: 'open_page',
}



interface ToolCallParametersProps {
    parameters: string;
}

const ToolCallParameters = ({ parameters }: ToolCallParametersProps) => {
    let parsedParameters: any;
    try {
        parsedParameters = JSON.parse(parameters);
    } catch (error) {
        console.error(error);
        return <div>Invalid JSON</div>;
    }

    switch (parsedParameters?.type) {
        case ToolTypes.SEARCH:
            return <SearchParameters {...parsedParameters} />;
        case ToolTypes.OPEN_PAGE:
            return <OpenPageParameters {...parsedParameters} />;
        default:
            return <pre className="text-sm text-foreground whitespace-pre-wrap font-mono">
            {JSON.stringify(parsedParameters, null, 2)}
        </pre>
    }
}



interface SearchParametersProps {
    type: string;
    query: string;  
}
const SearchParameters = ({ query }: SearchParametersProps) => {
    return <pre className="text-sm text-foreground whitespace-pre-wrap font-mono">
        Searching for: {query}
    </pre>
}


const OpenPageParameters = () => {
    return <pre className="text-sm text-foreground whitespace-pre-wrap font-mono">
        Opening page
    </pre>
}



export default ToolCallParameters;