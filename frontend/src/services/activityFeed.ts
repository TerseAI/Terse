import { BackendProvider } from './backend';
import { ActivityEvent } from '../shared/types';

export interface PaginatedActivityResponse {
    activities: ActivityEvent[];
    pagination: {
        hasMore: boolean;
        nextCursor?: string;
        currentPage: number;
    };
}

export interface PaginationParams {
    cursor?: string;
    limit?: number;
}

export interface DailyActivitySummary {
    date: string;
    summary: string;
    eventCount: number;
}

export class ActivityFeedService {
    static async getActivityFeed(params?: PaginationParams): Promise<PaginatedActivityResponse> {
        const queryParams = new URLSearchParams();
        
        if (params?.cursor) {
            queryParams.append('cursor', params.cursor);
        }
        
        if (params?.limit) {
            queryParams.append('limit', params.limit.toString());
        }
        
        const url = params ? `/activity-feed?${queryParams.toString()}` : '/activity-feed';
        const response = await BackendProvider.getActivityFeed(url);
        return response as PaginatedActivityResponse;
    }

    static async getDailyActivitySummary(): Promise<DailyActivitySummary> {
        const response = await BackendProvider.getDailyActivitySummary();
        return response as DailyActivitySummary;
    }
} 