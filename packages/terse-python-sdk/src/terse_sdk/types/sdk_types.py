"""SDK request and response DTOs."""

from __future__ import annotations

from typing import TypeAlias

from ._generated import (
    ApiToken,
    ApiTokenCreateResponse,
    PartialSdkAgentRunEventPayload,
    SdkAgentRunEventPayload,
    SdkAgentRunNormalizedRequest,
    SdkAgentRunNormalizedRequestOptions,
    SdkAgentRunOptionsPayload,
    SdkAgentRunRequestBody,
    SdkAgentRunResponseBody,
    SdkAgentRunResponseContract,
    SdkAgentSkillPayload,
    SdkDeployJob,
    SdkDeployRemoved,
    SdkDeployRequestBody,
    SdkDeployResponseBody,
    SdkDeployResult,
    SerializedEvent,
    TriggerPayload,
)

Contract: TypeAlias = SdkAgentRunResponseContract
NormalizedRequest: TypeAlias = SdkAgentRunNormalizedRequest
Options: TypeAlias = SdkAgentRunNormalizedRequestOptions
Result: TypeAlias = SdkDeployResult
RemovedItem: TypeAlias = SdkDeployRemoved


__all__ = [
    "ApiToken",
    "ApiTokenCreateResponse",
    "Contract",
    "NormalizedRequest",
    "Options",
    "PartialSdkAgentRunEventPayload",
    "RemovedItem",
    "Result",
    "SdkAgentRunEventPayload",
    "SdkAgentRunOptionsPayload",
    "SdkAgentRunRequestBody",
    "SdkAgentRunResponseBody",
    "SdkAgentSkillPayload",
    "SdkDeployJob",
    "SdkDeployRequestBody",
    "SdkDeployResponseBody",
    "SerializedEvent",
    "TriggerPayload",
]
