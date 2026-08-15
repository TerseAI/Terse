import { FrontendRoutes } from "terse-types/FrontendRoutesBuilder"

export const ACTIVITY_VIEW_PARAM = "view"
export const ACTIVITY_OVERVIEW_VIEW = "overview"
export const ACTIVITY_OVERVIEW_PATH = `${FrontendRoutes.ACTIVITY}?${ACTIVITY_VIEW_PARAM}=${ACTIVITY_OVERVIEW_VIEW}`
