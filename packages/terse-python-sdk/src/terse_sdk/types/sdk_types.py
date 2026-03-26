"""SDK request and response DTOs."""

from __future__ import annotations

from typing import Any, Literal

from ._base import _CamelModel
from .enums import ConfigType, IntegrationType


class ApiToken(_CamelModel):
    createdAt: str
    id: str
    lastUsedAt: str | None
    name: str
    tokenPrefix: str


class ApiTokenCreateResponse(_CamelModel):
    rawToken: str
    token: ApiToken


class PartialSdkAgentRunEventPayload(_CamelModel):
    debugLog: str | None = None
    formattedContent: str | None = None
    integrationType: IntegrationType | None = None


class SdkAgentRunEventPayload(_CamelModel):
    debugLog: str
    formattedContent: str
    integrationType: IntegrationType


class SdkAgentRunOptionsPayload(_CamelModel):
    maxTurns: float | None = None
    requireApproval: bool | None = None


class Contract(_CamelModel):
    responseMode: Literal["streaming"]
    supportsInterruptions: bool


class Options(_CamelModel):
    maxTurns: float
    requireApproval: bool


class RemovedItem(_CamelModel):
    id: str
    name: str


class Result(_CamelModel):
    automationId: str
    isUpdate: bool
    jobName: str


class SdkAgentSkillPayload(_CamelModel):
    config: dict[str, Any]
    configType: ConfigType


class TriggerPayload(_CamelModel):
    config: dict[str, Any]
    integrationId: str
    integrationType: IntegrationType


class SdkDeployTrigger(_CamelModel):
    config: dict[str, Any]
    configType: str
    integrationId: str
    integrationType: str


class SdkDeployJob(_CamelModel):
    jobName: str
    triggers: list[SdkDeployTrigger]
    toolApprovals: list[str] | None = None
    webhookURL: str | None = None


class SdkDeployRequestBody(_CamelModel):
    jobs: list[SdkDeployJob]
    sourceZipBase64: str


class SdkDeployResponseBody(_CamelModel):
    details: str | None = None
    error: str | None = None
    removed: list[RemovedItem]
    results: list[Result]
    success: bool


class SerializedEvent(_CamelModel):
    debugLog: str
    eventType: str | None = None
    formattedContent: str
    integrationType: IntegrationType
    metadata: dict[str, Any] | None = None


class SdkAgentRunRequestBody(_CamelModel):
    event: PartialSdkAgentRunEventPayload | None = None
    options: SdkAgentRunOptionsPayload | None = None
    prompt: str | None = None
    skills: list[SdkAgentSkillPayload] | None = None


class NormalizedRequest(_CamelModel):
    event: SdkAgentRunEventPayload
    options: Options
    prompt: str
    skills: list[SdkAgentSkillPayload]


class SdkAgentRunResponseBody(_CamelModel):
    contract: Contract | None = None
    details: list[str] | None = None
    error: str | None = None
    normalizedRequest: NormalizedRequest | None = None
    success: bool


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
    "SdkDeployTrigger",
    "SerializedEvent",
    "TriggerPayload",
]
