import { HiggsfieldClient, InputImage, JobStatus, inputMotion } from "@higgsfield/client"
import type { HiggsfieldImageSize, HiggsfieldVideoModel } from "terse-types"

const DEFAULT_SIZE: HiggsfieldImageSize = "1536x1536"
const DEFAULT_VIDEO_MODEL: HiggsfieldVideoModel = "dop-turbo"
const SOUL_TEXT_TO_IMAGE_ENDPOINT = "/v1/text2image/soul"
const DOP_IMAGE_TO_VIDEO_ENDPOINT = "/v1/image2video/dop"

// Higgsfield authenticates with a "KEY_ID:KEY_SECRET" pair; the SDK takes them split.
export function createHiggsfieldClient(credentials: string): HiggsfieldClient {
    const [apiKey, apiSecret] = splitCredentials(credentials)
    return new HiggsfieldClient({ apiKey, apiSecret })
}

export function splitCredentials(credentials: string): [string, string] {
    const [apiKey, apiSecret] = credentials.split(":")
    if (!apiKey || !apiSecret) {
        throw new HiggsfieldCredentialsError()
    }
    return [apiKey.trim(), apiSecret.trim()]
}

// Cheapest authenticated call we can make, used to validate credentials at install time.
export async function verifyHiggsfieldCredentials(credentials: string): Promise<void> {
    const client = createHiggsfieldClient(credentials)
    await client.getSoulStyles()
}

export async function generateHiggsfieldImages(credentials: string, request: HiggsfieldGenerationRequest): Promise<HiggsfieldGenerationResult[]> {
    const client = createHiggsfieldClient(credentials)
    const jobSet = await client.generate(SOUL_TEXT_TO_IMAGE_ENDPOINT, {
        prompt: request.prompt,
        width_and_height: request.size ?? DEFAULT_SIZE,
        quality: request.quality ?? "1080p",
        batch_size: request.batchSize ?? 1,
        ...(request.styleId ? { style_id: request.styleId } : {}),
        ...(request.referenceImageUrls?.length ? { reference_image_urls: request.referenceImageUrls } : {})
    })

    return collectResults(jobSet, "image")
}

export async function generateHiggsfieldVideos(credentials: string, request: HiggsfieldVideoRequest): Promise<HiggsfieldGenerationResult[]> {
    const client = createHiggsfieldClient(credentials)
    const jobSet = await client.generate(DOP_IMAGE_TO_VIDEO_ENDPOINT, {
        model: request.model ?? DEFAULT_VIDEO_MODEL,
        prompt: request.prompt,
        input_images: [InputImage.fromUrl(request.imageUrl)],
        ...(request.motionId ? { motions: [inputMotion(request.motionId, request.motionStrength ?? 1)] } : {}),
        ...(request.seed !== null && request.seed !== undefined ? { seed: request.seed } : {})
    })

    return collectResults(jobSet, "video")
}

export async function listHiggsfieldMotions(credentials: string): Promise<HiggsfieldMotionResult[]> {
    const client = createHiggsfieldClient(credentials)
    const motions = await client.getMotions()
    return motions.map(motion => ({
        id: motion.id,
        name: motion.name,
        description: motion.description ?? null,
        previewUrl: motion.preview_url ?? null
    }))
}

function collectResults(jobSet: JobSetLike, what: string): HiggsfieldGenerationResult[] {
    if (jobSet.isNsfw) {
        throw new HiggsfieldGenerationError("Higgsfield rejected the prompt as NSFW. Rephrase it and try again.")
    }
    if (jobSet.isFailed || jobSet.isCanceled) {
        throw new HiggsfieldGenerationError(`Higgsfield failed to generate the ${what}.`)
    }

    const results = jobSet.jobs
        .filter(job => job.status === JobStatus.COMPLETED)
        .flatMap(job => (job.results?.raw?.url ? [{ jobId: job.id, url: job.results.raw.url, thumbnailUrl: job.results.min?.url ?? null }] : []))

    if (results.length === 0) {
        throw new HiggsfieldGenerationError(`Higgsfield returned no ${what} for this prompt.`)
    }
    return results
}

export class HiggsfieldCredentialsError extends Error {
    constructor() {
        super('Higgsfield credentials must be the Key ID and Key Secret joined by a colon, as in "KEY_ID:KEY_SECRET". Generate a key at https://cloud.higgsfield.ai and paste both values.')
        this.name = "HiggsfieldCredentialsError"
    }
}

export class HiggsfieldGenerationError extends Error {
    constructor(message: string) {
        super(message)
        this.name = "HiggsfieldGenerationError"
    }
}

export interface HiggsfieldGenerationRequest {
    readonly prompt: string
    readonly size?: HiggsfieldImageSize | null
    readonly quality?: "720p" | "1080p" | null
    readonly batchSize?: 1 | 4 | null
    readonly styleId?: string | null
    readonly referenceImageUrls?: string[] | null
}

export interface HiggsfieldVideoRequest {
    readonly imageUrl: string
    readonly prompt: string
    readonly model?: HiggsfieldVideoModel | null
    readonly motionId?: string | null
    readonly motionStrength?: number | null
    readonly seed?: number | null
}

export interface HiggsfieldMotionResult {
    readonly id: string
    readonly name: string
    readonly description: string | null
    readonly previewUrl: string | null
}

interface JobSetLike {
    readonly isNsfw: boolean
    readonly isFailed: boolean
    readonly isCanceled: boolean
    readonly jobs: ReadonlyArray<{ id: string; status: string; results?: { raw?: { url: string }; min?: { url: string } } | null }>
}

export interface HiggsfieldGenerationResult {
    readonly jobId: string
    readonly url: string
    readonly thumbnailUrl: string | null
}
