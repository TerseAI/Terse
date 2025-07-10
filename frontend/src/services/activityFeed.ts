import { BackendProvider } from './backend';
import { ActivityEvent } from '../shared/types';

export class ActivityFeedService {
    static async getActivityFeed(): Promise<ActivityEvent[]> {
        return BackendProvider.getActivityFeed();
    }
} 