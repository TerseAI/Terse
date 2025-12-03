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

    return (
        <pre className="text-sm text-foreground whitespace-pre-wrap font-mono">
            {JSON.stringify(parsedParameters, null, 2)}
        </pre>
    );
}

export default ToolCallParameters;