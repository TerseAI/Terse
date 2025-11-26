import moment from 'moment';

export function formatRelativeTime(date: Date | string): string {
    return moment(date).fromNow();
}

// Helper function to format timestamp with relative time (e.g., "2m ago", "3h ago")
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

