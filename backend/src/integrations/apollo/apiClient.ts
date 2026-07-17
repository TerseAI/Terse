import { z } from "zod"

import type { SuccessResponseBody } from "./apollo.generated.js"
import {
    bulkPeopleEnrichmentResponseSchema,
    organizationEnrichmentResponseSchema,
    organizationJobsPostingsResponseSchema,
    peopleApiSearchResponseSchema,
    peopleEnrichmentResponseSchema
} from "./apolloSchemas.generated.js"

const APOLLO_API_BASE = "https://api.apollo.io/api/v1"
const APOLLO_HEALTH_URL = "https://api.apollo.io/v1/auth/health"
const MAX_LIST_FIELD_ITEMS = 50

export async function validateApolloApiKey(apiKey: string): Promise<void> {
    const response = await fetch(APOLLO_HEALTH_URL, { method: "GET", headers: apolloHeaders(apiKey) })
    if (!response.ok) {
        throw new ApolloApiError("auth/health", response.status, await response.text())
    }
    const health = apolloHealthResponseSchema.parse(await response.json())
    if (!health.is_logged_in) {
        throw new ApolloApiError("auth/health", 401, "Apollo did not recognize this API key")
    }
}

export async function enrichApolloPerson(apiKey: string, input: ApolloPersonMatchInput & { revealPersonalEmails?: boolean }): Promise<ApolloEnrichedPerson | null> {
    const params = buildPersonMatchParams(input)
    if (input.revealPersonalEmails) params.set("reveal_personal_emails", "true")

    const response = await fetch(`${APOLLO_API_BASE}/people/match?${params.toString()}`, {
        method: "POST",
        headers: apolloHeaders(apiKey)
    })
    if (!response.ok) {
        throw new ApolloApiError("people/match", response.status, await response.text())
    }
    const data = peopleEnrichmentResponseSchema.parse(await response.json())
    return data.person ? projectPerson(data.person) : null
}

export async function bulkEnrichApolloPeople(apiKey: string, people: ApolloPersonMatchInput[], revealPersonalEmails?: boolean): Promise<ApolloEnrichedPerson[]> {
    const params = new URLSearchParams()
    if (revealPersonalEmails) params.set("reveal_personal_emails", "true")

    const details = people.map(person => ({
        id: person.id ?? undefined,
        email: person.email ?? undefined,
        first_name: person.firstName ?? undefined,
        last_name: person.lastName ?? undefined,
        name: person.name ?? undefined,
        domain: person.domain ?? undefined,
        organization_name: person.organizationName ?? undefined,
        linkedin_url: person.linkedinUrl ?? undefined
    }))

    const response = await fetch(`${APOLLO_API_BASE}/people/bulk_match?${params.toString()}`, {
        method: "POST",
        headers: { ...apolloHeaders(apiKey), "Content-Type": "application/json" },
        body: JSON.stringify({ details })
    })
    if (!response.ok) {
        throw new ApolloApiError("people/bulk_match", response.status, await response.text())
    }
    const data = bulkPeopleEnrichmentResponseSchema.parse(await response.json())
    return (data.matches ?? []).map(projectPerson)
}

export async function enrichApolloOrganization(apiKey: string, domain: string): Promise<ApolloOrganization | null> {
    const params = new URLSearchParams({ domain })
    const response = await fetch(`${APOLLO_API_BASE}/organizations/enrich?${params.toString()}`, {
        method: "GET",
        headers: apolloHeaders(apiKey)
    })
    if (!response.ok) {
        throw new ApolloApiError("organizations/enrich", response.status, await response.text())
    }
    const data = organizationEnrichmentResponseSchema.parse(await response.json())
    return data.organization ? projectOrganization(data.organization) : null
}

export async function searchApolloPeople(apiKey: string, filters: ApolloPeopleSearchFilters): Promise<ApolloPeopleSearchResult> {
    const params = new URLSearchParams()
    appendAll(params, "person_titles[]", filters.personTitles)
    if (filters.includeSimilarTitles != null) params.set("include_similar_titles", String(filters.includeSimilarTitles))
    appendAll(params, "person_seniorities[]", filters.personSeniorities)
    appendAll(params, "person_locations[]", filters.personLocations)
    appendAll(params, "organization_locations[]", filters.organizationLocations)
    appendAll(params, "q_organization_domains_list[]", filters.organizationDomains)
    appendAll(params, "organization_num_employees_ranges[]", filters.organizationNumEmployeesRanges)
    appendAll(params, "contact_email_status[]", filters.contactEmailStatus)
    if (filters.keywords) params.set("q_keywords", filters.keywords)
    const page = filters.page ?? 1
    const perPage = filters.perPage ?? 25
    params.set("page", String(page))
    params.set("per_page", String(perPage))

    const response = await fetch(`${APOLLO_API_BASE}/mixed_people/api_search?${params.toString()}`, {
        method: "POST",
        headers: apolloHeaders(apiKey)
    })
    if (!response.ok) {
        throw new ApolloApiError("mixed_people/api_search", response.status, await response.text())
    }
    const data = peopleApiSearchResponseSchema.parse(await response.json())
    const rawPeople = data.people ?? []
    return {
        people: rawPeople.map(projectSearchPerson),
        totalEntries: data.total_entries ?? rawPeople.length,
        page,
        perPage
    }
}

export async function listApolloJobPostings(apiKey: string, organizationId: string, pagination: { page?: number | null; perPage?: number | null }): Promise<ApolloJobPostingsResult> {
    const page = pagination.page ?? 1
    const perPage = pagination.perPage ?? 100
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) })

    const response = await fetch(`${APOLLO_API_BASE}/organizations/${encodeURIComponent(organizationId)}/job_postings?${params.toString()}`, {
        method: "GET",
        headers: apolloHeaders(apiKey)
    })
    if (!response.ok) {
        throw new ApolloApiError("organizations/job_postings", response.status, await response.text())
    }
    const data = organizationJobsPostingsResponseSchema.parse(await response.json())
    const postings = (data.organization_job_postings ?? []).map(projectJobPosting)
    return {
        postings,
        totalPostings: postings.length,
        page,
        perPage
    }
}

function apolloHeaders(apiKey: string): Record<string, string> {
    return { "x-api-key": apiKey, "Cache-Control": "no-cache", Accept: "application/json" }
}

function buildPersonMatchParams(input: ApolloPersonMatchInput): URLSearchParams {
    const params = new URLSearchParams()
    const fields: Record<string, string | null | undefined> = {
        id: input.id,
        email: input.email,
        first_name: input.firstName,
        last_name: input.lastName,
        name: input.name,
        domain: input.domain,
        organization_name: input.organizationName,
        linkedin_url: input.linkedinUrl
    }
    Object.entries(fields).forEach(([key, value]) => {
        if (value) params.set(key, value)
    })
    return params
}

function appendAll(params: URLSearchParams, key: string, values: readonly string[] | null | undefined): void {
    ;(values ?? []).forEach(value => params.append(key, value))
}

function projectPerson(raw: ApolloRawPerson): ApolloEnrichedPerson {
    return {
        id: requireApolloId(raw.id, "person"),
        firstName: raw.first_name ?? null,
        lastName: raw.last_name ?? null,
        name: raw.name ?? null,
        title: raw.title ?? null,
        seniority: raw.seniority ?? null,
        email: raw.email ?? null,
        emailStatus: raw.email_status ?? null,
        linkedinUrl: raw.linkedin_url ?? null,
        city: raw.city ?? null,
        state: raw.state ?? null,
        country: raw.country ?? null,
        organization: raw.organization ? projectOrganizationSummary(raw.organization) : null
    }
}

function projectSearchPerson(raw: ApolloRawSearchPerson): ApolloSearchPerson {
    return {
        id: requireApolloId(raw.id, "search person"),
        firstName: raw.first_name ?? null,
        lastName: raw.last_name_obfuscated ?? null,
        name: null,
        title: raw.title ?? null,
        hasEmail: raw.has_email ?? null,
        linkedinUrl: null,
        city: null,
        state: null,
        country: null,
        organization: raw.organization ? projectSearchOrganizationSummary(raw.organization) : null
    }
}

function projectOrganizationSummary(raw: ApolloRawOrganizationSummary): ApolloOrganizationSummary {
    return {
        id: raw.id ?? null,
        name: raw.name ?? null,
        websiteUrl: raw.website_url ?? null,
        primaryDomain: raw.primary_domain ?? null,
        industry: raw.industry ?? null,
        estimatedNumEmployees: raw.estimated_num_employees ?? null
    }
}

function projectSearchOrganizationSummary(raw: ApolloRawSearchOrganization): ApolloOrganizationSummary {
    return {
        id: null,
        name: raw.name ?? null,
        websiteUrl: null,
        primaryDomain: null,
        industry: null,
        estimatedNumEmployees: null
    }
}

function projectOrganization(raw: ApolloRawOrganization): ApolloOrganization {
    return {
        ...projectOrganizationSummary(raw),
        keywords: (raw.keywords ?? []).slice(0, MAX_LIST_FIELD_ITEMS),
        annualRevenuePrinted: raw.annual_revenue_printed ?? null,
        totalFundingPrinted: raw.total_funding_printed ?? null,
        latestFundingStage: raw.latest_funding_stage ?? null,
        foundedYear: raw.founded_year ?? null,
        city: raw.city ?? null,
        state: raw.state ?? null,
        country: raw.country ?? null,
        linkedinUrl: raw.linkedin_url ?? null,
        shortDescription: raw.short_description ?? null,
        technologyNames: (raw.technology_names ?? []).slice(0, MAX_LIST_FIELD_ITEMS)
    }
}

function projectJobPosting(raw: ApolloRawJobPosting): ApolloJobPosting {
    return {
        id: requireApolloId(raw.id, "job posting"),
        title: raw.title ?? null,
        url: raw.url ?? null,
        city: optionalString(raw.city),
        state: optionalString(raw.state),
        country: raw.country ?? null,
        postedAt: raw.posted_at ?? null,
        lastSeenAt: raw.last_seen_at ?? null
    }
}

function requireApolloId(value: string | undefined, resource: string): string {
    if (!value) throw new Error(`Apollo returned a ${resource} without an id`)
    return value
}

function optionalString(value: unknown): string | null {
    return typeof value === "string" ? value : null
}

function describeApolloFailure(endpoint: string, status: number): string {
    switch (status) {
        case 401:
            return "Apollo rejected the API key. Reconnect the Apollo integration with a valid key."
        case 403:
            return endpoint === "mixed_people/api_search"
                ? "Apollo denied access to people search. This endpoint requires a master API key — create one in Apollo under Settings > Integrations > API Keys."
                : "Apollo denied access to this endpoint. Check that the API key's scopes include it."
        case 422:
            return "Apollo could not process the request parameters. Adjust the filters or match keys and retry."
        case 429:
            return "Apollo rate limit reached. Wait before retrying."
        default:
            return `Apollo ${endpoint} request failed with status ${status}.`
    }
}

const apolloHealthResponseSchema = z.object({
    is_logged_in: z.boolean().optional()
})

export class ApolloApiError extends Error {
    constructor(
        readonly endpoint: string,
        readonly status: number,
        readonly responseBody: string
    ) {
        super(describeApolloFailure(endpoint, status))
        this.name = "ApolloApiError"
    }
}

export interface ApolloPersonMatchInput {
    id?: string | null
    email?: string | null
    firstName?: string | null
    lastName?: string | null
    name?: string | null
    domain?: string | null
    organizationName?: string | null
    linkedinUrl?: string | null
}

export interface ApolloOrganizationSummary {
    id: string | null
    name: string | null
    websiteUrl: string | null
    primaryDomain: string | null
    industry: string | null
    estimatedNumEmployees: number | null
}

export interface ApolloEnrichedPerson {
    id: string
    firstName: string | null
    lastName: string | null
    name: string | null
    title: string | null
    seniority: string | null
    email: string | null
    emailStatus: string | null
    linkedinUrl: string | null
    city: string | null
    state: string | null
    country: string | null
    organization: ApolloOrganizationSummary | null
}

export interface ApolloOrganization extends ApolloOrganizationSummary {
    keywords: string[]
    annualRevenuePrinted: string | null
    totalFundingPrinted: string | null
    latestFundingStage: string | null
    foundedYear: number | null
    city: string | null
    state: string | null
    country: string | null
    linkedinUrl: string | null
    shortDescription: string | null
    technologyNames: string[]
}

export interface ApolloSearchPerson {
    id: string
    firstName: string | null
    lastName: string | null
    name: string | null
    title: string | null
    hasEmail: boolean | null
    linkedinUrl: string | null
    city: string | null
    state: string | null
    country: string | null
    organization: ApolloOrganizationSummary | null
}

export interface ApolloPeopleSearchFilters {
    personTitles?: readonly string[] | null
    includeSimilarTitles?: boolean | null
    personSeniorities?: readonly string[] | null
    personLocations?: readonly string[] | null
    organizationLocations?: readonly string[] | null
    organizationDomains?: readonly string[] | null
    organizationNumEmployeesRanges?: readonly string[] | null
    keywords?: string | null
    contactEmailStatus?: readonly string[] | null
    page?: number | null
    perPage?: number | null
}

export interface ApolloPeopleSearchResult {
    people: ApolloSearchPerson[]
    totalEntries: number
    page: number
    perPage: number
}

export interface ApolloJobPosting {
    id: string
    title: string | null
    url: string | null
    city: string | null
    state: string | null
    country: string | null
    postedAt: string | null
    lastSeenAt: string | null
}

export interface ApolloJobPostingsResult {
    postings: ApolloJobPosting[]
    totalPostings: number
    page: number
    perPage: number
}

type ApolloRawPerson = NonNullable<SuccessResponseBody<"people-enrichment">["person"]> | NonNullable<NonNullable<SuccessResponseBody<"bulk-people-enrichment">["matches"]>[number]>
type ApolloRawOrganizationSummary = NonNullable<NonNullable<SuccessResponseBody<"people-enrichment">["person"]>["organization"]>
type ApolloRawOrganization = NonNullable<SuccessResponseBody<"organization-enrichment">["organization"]>
type ApolloRawSearchPerson = NonNullable<SuccessResponseBody<"people-api-search">["people"]>[number]
type ApolloRawSearchOrganization = NonNullable<ApolloRawSearchPerson["organization"]>
type ApolloRawJobPosting = NonNullable<SuccessResponseBody<"organization-jobs-postings">["organization_job_postings"]>[number]
