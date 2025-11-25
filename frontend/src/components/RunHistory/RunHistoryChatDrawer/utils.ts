import moment from 'moment';
import { IntegrationType } from '@/shared/Integrations';

// Helper function to format timestamp
export function formatTimestamp(timestamp?: string): string {
    if (!timestamp) return '';
    try {
        const date = moment(timestamp);
        const now = moment();
        const diffMs = now.diff(date);
        const seconds = Math.floor(diffMs / 1000);
        const minutes = Math.floor(diffMs / (1000 * 60));
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (seconds < 60) return `${seconds}s ago`;
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        
        return date.format('MMM D, h:mm A');
    } catch {
        return '';
    }
}

// Helper function to get full timestamp
export function getFullTimestamp(timestamp?: string): string {
    if (!timestamp) return '';
    try {
        return moment(timestamp).format('MMM D, YYYY, h:mm:ss A');
    } catch {
        return '';
    }
}

// Helper function to parse tool name and extract integration/action info
export function parseToolInfo(toolName: string, parameters: string): {
    integration: IntegrationType | null;
    action: string;
    target: string;
    url: string | null;
    details: string;
} {
    let integration: IntegrationType | null = null;
    let action = toolName;
    let target = '';
    let url: string | null = null;
    let details = '';

    // Try to infer integration from tool name
    const toolLower = toolName.toLowerCase();
    if (toolLower.includes('jira') || toolLower.includes('atlassian')) {
        integration = IntegrationType.ATLASSIAN;
    } else if (toolLower.includes('linear') && !toolLower.includes('jira')) {
        integration = IntegrationType.LINEAR;
    } else if (toolLower.includes('notion')) {
        integration = IntegrationType.NOTION;
    } else if (toolLower.includes('confluence')) {
        integration = IntegrationType.ATLASSIAN;
    } else if (toolLower.includes('slack')) {
        integration = IntegrationType.SLACK;
    } else if (toolLower.includes('github')) {
        integration = IntegrationType.GITHUB;
    } else if (toolLower.includes('figma')) {
        integration = IntegrationType.FIGMA;
    } else if (toolLower.includes('gmail')) {
        integration = IntegrationType.GMAIL;
    }

    // Parse parameters JSON
    try {
        const params = JSON.parse(parameters);
        
        // Extract target from common parameter fields
        if (params.title) target = params.title;
        else if (params.name) target = params.name;
        else if (params.query) target = params.query;
        else if (params.id) target = params.id;
        else if (params.target) target = params.target;
        
        // Extract URL from various possible locations
        // Notion: pageId can be converted to URL, or url field might exist
        if (params.url) {
            url = params.url;
        } else if (params.link) {
            url = params.link;
        }
        
        // Format details
        details = JSON.stringify(params, null, 2);
    } catch (e) {
        // If parameters aren't valid JSON, use as-is
        details = parameters;
    }

    // Format action name (convert "Create Ticket" to "create_ticket" style, then format)
    const formatAction = (s: string) => {
        return s
            .split(/(?=[A-Z])/)
            .map(word => word.toLowerCase())
            .join('_')
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };
    
    action = formatAction(toolName);

    return { integration, action, target, url, details };
}

// Helper function to extract document URL from changed_items
export function extractDocumentUrlFromChangedItems(changedItems: any[], integration: IntegrationType | null): string | null {
    if (!changedItems || changedItems.length === 0 || !integration) {
        return null;
    }

    // Look for URL in changed items
    for (const item of changedItems) {
        if (item.url) {
            return item.url;
        }
    }
    return null;
}

