import { EventEmitterTaskQueue } from "../../tasks/abstract/eventEmitterTasks"

import { SurveyAnswerTask } from "./SurveyAnswerTask"

/**
 * Task queue for survey answer events.
 * boltApp emits tasks; ChatInterface.waitForSurveyAnswer listens.
 */
export const surveyAnswerTaskQueue = new EventEmitterTaskQueue<SurveyAnswerTask>()
