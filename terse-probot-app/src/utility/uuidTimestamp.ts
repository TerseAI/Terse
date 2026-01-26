/**
 * Extract timestamp from a UUIDv1.
 *
 * GitHub's X-GitHub-Delivery header is a UUIDv1 which contains an embedded timestamp.
 * This allows us to determine the exact time the webhook event was generated.
 *
 * @see https://github.com/orgs/community/discussions/61851
 * @param uuid - The UUIDv1 string (e.g., from X-GitHub-Delivery header)
 * @returns Date object representing the timestamp, or null if parsing fails
 */
export function getTimestampFromUuidV1(uuid: string): Date | null {
    try {
        if (!uuid || typeof uuid !== 'string') {
            return null;
        }

        // Split the UUID string into its components
        const uuidArr = uuid.split('-');
        if (uuidArr.length !== 5) {
            return null;
        }

        // UUIDv1 structure: time_low-time_mid-time_hi_and_version-clock_seq-node
        // The timestamp is stored across the first three components
        // time_hi_and_version has 4 bits of version, so we strip the first character
        const timeStr = uuidArr[2].substring(1) + uuidArr[1] + uuidArr[0];

        // Convert the time string to an integer
        // UUIDv1 uses 100-nanosecond intervals since October 15, 1582
        // 122192928000000000 is the offset from UUID epoch to Unix epoch
        const uuidTime = parseInt(timeStr, 16) - 122192928000000000;

        // Convert to milliseconds
        const uuidMillis = Math.floor(uuidTime / 10000);

        return new Date(uuidMillis);
    } catch (error) {
        console.error('Error parsing UUIDv1 timestamp:', error);
        return null;
    }
}
