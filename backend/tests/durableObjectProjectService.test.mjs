import assert from "node:assert/strict"
import test from "node:test"

import { DurableObjectProjectService } from "../dist/services/DurableObjectProjectService.js"

test("production deployment registration warms only the selected new-actor region", async () => {
    const calls = []
    const controlPlane = {
        controlPlaneUrl: "https://objects.example.com",
        async registerDeployment(namespaceId, deployment) {
            calls.push({ namespaceId, deployment })
            return { changed: true }
        }
    }
    const service = new DurableObjectProjectService(controlPlane)

    await service.registerProductionDeployment("project-1", { buildHash: "revision-1", imageRef: "im-1" }, "us-west")

    assert.deepEqual(calls, [
        {
            namespaceId: "project-1",
            deployment: {
                actorEntrypoint: "src/durable-objects.ts",
                codeRevision: "revision-1",
                imageRef: "im-1",
                warmRegion: "north-america-west",
                workingDirectory: "/opt/terse-sdk-run/project"
            }
        }
    ])
})
