#!/usr/bin/env node
// Promotes the frontend to production by asking Vercel to build the release tag
// ref. The project's ignored-build-step skips pushes to main, so this is the
// only path to a production frontend deploy.
const API = "https://api.vercel.com";
const POLL_MS = 10_000;
const TIMEOUT_MS = 20 * 60_000;

const token = requireEnv("VERCEL_TOKEN");
const teamId = requireEnv("VERCEL_TEAM_ID");
const projectId = requireEnv("VERCEL_PROJECT_ID");
const repoId = Number(requireEnv("GITHUB_REPO_ID"));
const ref = requireEnv("RELEASE_REF");

const deployment = await vercelRequest("/v13/deployments?forceNew=1&skipAutoDetectionConfirmation=1", {
    method: "POST",
    body: {
        name: "terse",
        project: projectId,
        target: "production",
        gitSource: { type: "github", repoId, ref }
    }
});
console.log(`Vercel deployment ${deployment.id} triggered for ${ref}: https://${deployment.url}`);
await waitForDeployment(deployment.id);

async function waitForDeployment(deploymentId) {
    const deadline = Date.now() + TIMEOUT_MS;
    while (Date.now() < deadline) {
        const deployment = await vercelRequest(`/v13/deployments/${deploymentId}`);
        if (deployment.readyState === "READY") {
            console.log(`Vercel production is live at https://${deployment.url}`);
            return;
        }
        if (["ERROR", "CANCELED"].includes(deployment.readyState)) {
            throw new Error(`Vercel deployment ${deploymentId} ended as ${deployment.readyState}`);
        }
        console.log(`Vercel: ${deployment.readyState}...`);
        await sleep(POLL_MS);
    }
    throw new Error(`Vercel deployment ${deploymentId} was not ready within ${TIMEOUT_MS / 60_000} minutes`);
}

async function vercelRequest(path, options = {}) {
    const separator = path.includes("?") ? "&" : "?";
    const response = await fetch(`${API}${path}${separator}teamId=${teamId}`, {
        method: options.method ?? "GET",
        headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json",
            ...(options.body ? { "Content-Type": "application/json" } : {})
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {})
    });
    if (!response.ok) {
        throw new Error(`Vercel ${options.method ?? "GET"} ${path} failed: ${response.status} ${await response.text()}`);
    }
    return response.json();
}

function requireEnv(name) {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is not set`);
    return value;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
