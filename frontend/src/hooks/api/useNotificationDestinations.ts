import useSWR from 'swr';
import { NotificationDestination } from "../../shared/Notifications";
import { notificationDestinationsKey } from "../../shared/InvalidationKeys";
import { BackendProvider } from '../../services/backend';

export function useNotificationDestinations() {
    const key = notificationDestinationsKey();

    const { data, error, isLoading, mutate } = useSWR<NotificationDestination[]>(key, async () => {
        return BackendProvider.getNotificationDestinations();
    });

    return { notificationDestinations: data, isError: error, isLoading, mutate };
}