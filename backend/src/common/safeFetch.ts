import net from "node:net"
import { Agent, fetch as undiciFetch } from "undici"

import type { ValidatedRemoteUrl } from "./urlValidation"

type FetchInit = Parameters<typeof undiciFetch>[1]

export type SafeFetchInit = Omit<NonNullable<FetchInit>, "dispatcher" | "redirect">

export async function safeFetch(validated: ValidatedRemoteUrl, init?: SafeFetchInit): Promise<Response> {
    const dispatcher = validated.pinnedAddress
        ? new Agent({
              connect: {
                  lookup(hostname, _options, callback) {
                      if (hostname !== validated.hostname) {
                          callback(new Error(`safeFetch: refused to connect to ${hostname}; only ${validated.hostname} was validated`), "", 0)
                          return
                      }
                      const address = validated.pinnedAddress!
                      callback(null, [{ address, family: net.isIPv4(address) ? 4 : 6 }])
                  }
              }
          })
        : undefined

    return undiciFetch(validated.url, {
        ...(init as FetchInit),
        redirect: "manual",
        dispatcher
    }) as unknown as Response
}
