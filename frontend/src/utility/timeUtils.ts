import moment from 'moment';

export function formatRelativeTime(date: Date | string): string {
    return moment(date).fromNow();
}

