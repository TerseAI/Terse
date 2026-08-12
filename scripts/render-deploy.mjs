#!/usr/bin/env node
// Deploys a specific commit to the release-gated Render services and waits for
// each one to go live. Render autodeploy is off on these services; this script
// is the only thing that ships them.
const API = "https://api.render.com/v1";
const POLL_MS = 15_000;
const TIMEOUT_MS = 20 * 60_000;

const apiKey = requireEnv("RENDER_API_KEY");
const commitId = requireEnv("COMMIT_SHA");
const serviceIds = requireEnv("RENDER_SERVICE_IDS").split(/\s+/).filter(Boolean);

const LIVE = "live";
const TERMINAL_FAILURES = ["build_failed", "update_failed", "canceled", "pre_deploy_failed", "deactivated"];

await Promise.all(serviceIds.map(deployService));
console.log(`Deployed ${serviceIds.length} Render service(s) at ${commitId}.`);

async function deployService(serviceId) {
    const service = await renderRequest(`/services/${serviceId}`);
    const deploy = await renderRequest(`/services/${serviceId}/deploys`, { method: "POST", body: { commitId, clearCache: "do_not_clear" } });
    console.log(`${service.name}: deploy ${deploy.id} triggered at ${commitId}`);
    await waitForDeploy(serviceId, deploy.id, service.name);
}

async function waitForDeploy(serviceId, deployId, serviceName) {
    const deadline = Date.now() + TIMEOUT_MS;
    while (Date.now() < deadline) {
        const deploy = await renderRequest(`/services/${serviceId}/deploys/${deployId}`);
        if (deploy.status === LIVE) {
            console.log(`${serviceName}: live`);
            return;
        }
        if (TERMINAL_FAILURES.includes(deploy.status)) {
            throw new Error(`${serviceName}: deploy ${deployId} ended as ${deploy.status}`);
        }
        console.log(`${serviceName}: ${deploy.status}...`);
        await sleep(POLL_MS);
    }
    throw new Error(`${serviceName}: deploy ${deployId} did not go live within ${TIMEOUT_MS / 60_000} minutes`);
}

async function renderRequest(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
        method: options.method ?? "GET",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: "application/json",
            ...(options.body ? { "Content-Type": "application/json" } : {})
        },
        ...(options.body ? { body: JSON.stringify(options.body) } : {})
    });
    if (!response.ok) {
        throw new Error(`Render ${options.method ?? "GET"} ${path} failed: ${response.status} ${await response.text()}`);
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
