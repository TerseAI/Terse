"""SDK request and response DTOs."""

from __future__ import annotations

from typing import TypeAlias

from ._base import TerseModel
from ._generated import (
    ApiToken,
    ApiTokenCreateResponse,
    ConfigData,
    SdkDeployJob,
    SdkDeployRemoved,
    SdkDeployRequestBody,
    SdkDeployResponseBody,
    SdkDeployResult,
    TriggerEvent,
)


class SdkAgentRunOptionsPayload(TerseModel):
    max_turns: int | None = None
    require_approval: bool | None = None


class SdkAgentRunRequestBody(TerseModel):
    prompt: str | None = None
    event: TriggerEvent | None = None
    skills: list[ConfigData] | None = None
    options: SdkAgentRunOptionsPayload | None = None
    tool_approvals: list[str] | None = None


class SdkAgentRunNormalizedRequestOptions(TerseModel):
    max_turns: int
    require_approval: bool


class SdkAgentRunNormalizedRequest(TerseModel):
    prompt: str
    event: TriggerEvent
    skills: list[ConfigData]
    tool_approvals: list[str]
    options: SdkAgentRunNormalizedRequestOptions


class SdkAgentRunResponseContract(TerseModel):
    response_mode: str = "streaming"
    supports_interruptions: bool


class SdkAgentRunResponseBody(TerseModel):
    success: bool
    error: str | None = None
    details: list[str] | None = None
    contract: SdkAgentRunResponseContract | None = None
    normalized_request: SdkAgentRunNormalizedRequest | None = None


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
    "RemovedItem",
    "Result",
    "SdkAgentRunOptionsPayload",
    "SdkAgentRunRequestBody",
    "SdkAgentRunNormalizedRequest",
    "SdkAgentRunNormalizedRequestOptions",
    "SdkAgentRunResponseBody",
    "SdkAgentRunResponseContract",
    "SdkDeployJob",
    "SdkDeployRequestBody",
    "SdkDeployResponseBody",
    "TriggerEvent",
]
