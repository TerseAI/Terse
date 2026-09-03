import assert from "node:assert/strict"
import test from "node:test"

import { durableObjectStorageRegion, executionRegionForTimeZone, modalExecutionRegion } from "../ExecutionRegions"
import { organizationCreateRequestSchema, organizationUpdateRequestSchema } from "../types"

test("maps western US timezones to US West", () => {
    for (const timeZone of ["America/Los_Angeles", "America/Denver", "America/Phoenix", "America/Anchorage", "Pacific/Honolulu", "PST8PDT", "MST7MDT"]) {
        assert.equal(executionRegionForTimeZone(timeZone), "us-west")
    }
})

test("maps central US timezones to US Central", () => {
    for (const timeZone of ["America/Chicago", "America/Indiana/Knox", "America/North_Dakota/Center", "CST6CDT"]) {
        assert.equal(executionRegionForTimeZone(timeZone), "us-central")
    }
})

test("maps eastern, non-US, and missing timezones to US East", () => {
    for (const timeZone of ["America/New_York", "America/Puerto_Rico", "America/Vancouver", "Europe/London", "UTC", "", null, undefined]) {
        assert.equal(executionRegionForTimeZone(timeZone), "us-east")
    }
})

test("defaults older organization creation clients to US East", () => {
    assert.equal(organizationCreateRequestSchema.parse({ name: "Acme" }).executionRegion, "us-east")
})

test("accepts supported organization regions and rejects unsupported ones", () => {
    assert.equal(organizationUpdateRequestSchema.parse({ executionRegion: "us-central" }).executionRegion, "us-central")
    assert.equal(organizationUpdateRequestSchema.safeParse({ executionRegion: "eu-west" }).success, false)
    assert.equal(organizationUpdateRequestSchema.safeParse({}).success, false)
})

test("maps execution regions to durable object home regions", () => {
    assert.equal(durableObjectStorageRegion("us-west"), "north-america-west")
    assert.equal(durableObjectStorageRegion("us-central"), "north-america-central")
    assert.equal(durableObjectStorageRegion("us-east"), "north-america-east")
})

test("pins workflow sandboxes to exact GCP Modal regions", () => {
    assert.equal(modalExecutionRegion("us-west"), "us-west1")
    assert.equal(modalExecutionRegion("us-central"), "us-central1")
    assert.equal(modalExecutionRegion("us-east"), "us-east4")
})
