import { EventEmitterTaskQueue } from "../../tasks/abstract/eventEmitterTasks"

import { SurveyAnswerTask } from "./SurveyAnswerTask"

/**
 * Task queue for survey answer events.
 * Handlers (builderChatHandler, boltApp) emit tasks; ChatInterface.waitForSurveyAnswer listens.
 */
export const surveyAnswerTaskQueue = new EventEmitterTaskQueue<SurveyAnswerTask>()
