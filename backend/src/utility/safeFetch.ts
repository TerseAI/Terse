import net from "node:net"

import { Agent, fetch as undiciFetch } from "undici"

import type { ValidatedRemoteUrl } from "./urlValidation"

type FetchInit = Parameters<typeof undiciFetch>[1]

export type SafeFetchInit = Omit<NonNullable<FetchInit>, "dispatcher" | "redirect">

/**
 * SSRF-safe fetch for outbound requests against user-controlled URLs.
 *
 * 1. TCP connect is pinned to the IP returned by validateRemoteServerUrl, so
 *    the OS resolver cannot serve a different (private) address at fetch time.
 *    Closes the c-ares-vs-getaddrinfo DNS-rebinding window.
 *
 * 2. The custom `lookup` refuses any hostname other than the validated one.
 *    If a server tried to redirect via Location header to a different host,
 *    the connect would fail rather than silently follow.
 *
 * 3. `redirect: 'manual'` so 3xx responses surface to the caller as-is and
 *    are never followed. Callers MUST treat 3xx as a failure — never read
 *    the Location header and re-fetch without revalidating.
 *
 * Callers are responsible for closing the response body and respecting
 * AbortSignal — same semantics as global fetch.
 */
export async function safeFetch(validated: ValidatedRemoteUrl, init?: SafeFetchInit): Promise<Response> {
    const dispatcher = validated.pinnedAddress
        ? new Agent({
              connect: {
                  lookup(hostname, _options, callback) {
                      if (hostname !== validated.hostname) {
                          // Refuse cross-host redirects / Host header smuggling. The validated
                          // address only applies to the original hostname.
                          callback(new Error(`safeFetch: refused to connect to ${hostname}; only ${validated.hostname} was validated`), "", 0)
                          return
                      }
                      const family = net.isIPv4(validated.pinnedAddress!) ? 4 : 6
                      callback(null, validated.pinnedAddress!, family)
                  }
              }
          })
        : undefined

    // Cast undici's Response to global Response — they're compatible at the
    // method/property level for our usage (text(), json(), ok, status, etc.).
    return undiciFetch(validated.url, {
        ...(init as FetchInit),
        redirect: "manual",
        dispatcher
    }) as unknown as Response
}
