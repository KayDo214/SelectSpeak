import assert from "node:assert/strict";
import test from "node:test";

import {
  calculatePercentage,
  calculatePercentile,
  summarizeResults,
} from "../scripts/benchmark-tts.js";

test("percentage calculation handles ordinary and zero totals", () => {
  assert.equal(calculatePercentage(3, 4), 75);
  assert.equal(calculatePercentage(0, 0), 0);
});

test("percentile calculation uses the documented nearest-rank algorithm", () => {
  const values = [50, 10, 40, 20, 30];

  assert.equal(calculatePercentile(values, 50), 30);
  assert.equal(calculatePercentile(values, 95), 50);
});

test("empty result handling returns zero counts and unavailable latencies", () => {
  assert.deepEqual(summarizeResults([], 1_000), {
    total: 0,
    successes: 0,
    failures: 0,
    successRate: 0,
    errorRate: 0,
    meanLatencyMs: null,
    p50LatencyMs: null,
    p95LatencyMs: null,
    minLatencyMs: null,
    maxLatencyMs: null,
    completedPerMinute: 0,
    averageResponseBytes: 0,
    geminiCount: 0,
    geminiPercentage: 0,
    elevenLabsCount: 0,
    elevenLabsPercentage: 0,
  });
});

test("mixed results include failures in outcome and latency calculations", () => {
  const summary = summarizeResults(
    [
      { success: true, latencyMs: 100, responseBytes: 1_000, provider: "gemini" },
      { success: false, latencyMs: 200, responseBytes: 0, provider: null },
      { success: true, latencyMs: 300, responseBytes: 3_000, provider: "elevenlabs" },
      { success: false, latencyMs: 400, responseBytes: 0, provider: null },
    ],
    2_000
  );

  assert.equal(summary.successRate, 50);
  assert.equal(summary.errorRate, 50);
  assert.equal(summary.meanLatencyMs, 250);
  assert.equal(summary.p50LatencyMs, 200);
  assert.equal(summary.p95LatencyMs, 400);
  assert.equal(summary.completedPerMinute, 120);
  assert.equal(summary.averageResponseBytes, 2_000);
  assert.equal(summary.geminiPercentage, 50);
  assert.equal(summary.elevenLabsPercentage, 50);
});
