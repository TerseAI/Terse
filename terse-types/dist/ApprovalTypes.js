export function parseDeepLink(deepLink) {
    const parts = deepLink.split("|");
    return { type: parts[0], params: parts.slice(1) };
}
export function encodeDeepLink(type, ...params) {
    return [type, ...params].join("|");
}
