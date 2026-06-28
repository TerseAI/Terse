import { Router } from "express"

import deployRouter from "./deploy/routes"
import identityRouter from "./identity/routes"
import integrationsRouter from "./integrations/routes"
import jobServerRouter from "./job-server/routes"
import runTriggerRouter from "./run-trigger/routes"
import runtimeRouter from "./runtime/routes"
import sampleEventsRouter from "./sample-events/routes"
import testRunRouter from "./test-run/routes"
import toolsRouter from "./tools/routes"

// Aggregates all sub-routers under /sdk/ — mounted at "/sdk" from server.ts.
// Each sub-router contributes its endpoint paths relative to /sdk.
const router = Router()

router.use(identityRouter)
router.use(runtimeRouter)
router.use(toolsRouter)
router.use(deployRouter)
router.use(integrationsRouter)
router.use(jobServerRouter)
router.use(runTriggerRouter)
router.use(sampleEventsRouter)
router.use(testRunRouter)

export default router
