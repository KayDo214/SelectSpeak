import { pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";

const DEFAULT_TEXT = "SelectSpeak turns selected webpage text into clear spoken audio.";

export function calculatePercentage(count, total) {
  return total > 0 ? (count / total) * 100 : 0;
}

// Nearest-rank percentile: sort ascending and select rank ceil(p / 100 * N).
export function calculatePercentile(values, percentile) {
  if (values.length === 0) {
    return null;
  }

  if (percentile < 0 || percentile > 100) {
    throw new RangeError("Percentile must be between 0 and 100.");
  }

  const sortedValues = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((percentile / 100) * sortedValues.length));
  return sortedValues[rank - 1];
}

export function summarizeResults(results, elapsedMs) {
  const successes = results.filter((result) => result.success);
  const failures = results.length - successes.length;
  const latencies = results.map((result) => result.latencyMs);
  const responseBytes = successes.map((result) => result.responseBytes);
  const providerCounts = successes.reduce(
    (counts, result) => {
      if (result.provider === "gemini" || result.provider === "elevenlabs") {
        counts[result.provider] += 1;
      }

      return counts;
    },
    { gemini: 0, elevenlabs: 0 }
  );
  const sum = (values) => values.reduce((total, value) => total + value, 0);

  return {
    total: results.length,
    successes: successes.length,
    failures,
    successRate: calculatePercentage(successes.length, results.length),
    errorRate: calculatePercentage(failures, results.length),
    meanLatencyMs: latencies.length > 0 ? sum(latencies) / latencies.length : null,
    p50LatencyMs: calculatePercentile(latencies, 50),
    p95LatencyMs: calculatePercentile(latencies, 95),
    minLatencyMs: latencies.length > 0 ? Math.min(...latencies) : null,
    maxLatencyMs: latencies.length > 0 ? Math.max(...latencies) : null,
    completedPerMinute: elapsedMs > 0 ? (results.length / elapsedMs) * 60_000 : 0,
    averageResponseBytes:
      responseBytes.length > 0 ? sum(responseBytes) / responseBytes.length : 0,
    geminiCount: providerCounts.gemini,
    geminiPercentage: calculatePercentage(providerCounts.gemini, successes.length),
    elevenLabsCount: providerCounts.elevenlabs,
    elevenLabsPercentage: calculatePercentage(providerCounts.elevenlabs, successes.length),
  };
}

function readPositiveInteger(name, defaultValue) {
  const value = process.env[name] ?? String(defaultValue);
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsedValue;
}

function readNonnegativeInteger(name, defaultValue) {
  const value = process.env[name] ?? String(defaultValue);
  const parsedValue = Number(value);

  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    throw new Error(`${name} must be a nonnegative integer.`);
  }

  return parsedValue;
}

function readConfiguration() {
  return {
    baseUrl: (process.env.BENCHMARK_BASE_URL || "http://localhost:3000").replace(/\/$/, ""),
    requests: readPositiveInteger("BENCHMARK_REQUESTS", 10),
    warmup: readNonnegativeInteger("BENCHMARK_WARMUP", 1),
    concurrency: readPositiveInteger("BENCHMARK_CONCURRENCY", 1),
    timeoutMs: readPositiveInteger("BENCHMARK_TIMEOUT_MS", 60_000),
    text: process.env.BENCHMARK_TEXT || DEFAULT_TEXT,
  };
}

async function runWithTimeout(operation, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await operation(controller.signal);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function verifyHealth(config) {
  await runWithTimeout(async (signal) => {
    const response = await fetch(`${config.baseUrl}/health`, { signal });

    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`Health check failed with HTTP ${response.status}.`);
    }

    await response.body?.cancel();
  }, config.timeoutMs);
}

async function makeTtsRequest(config) {
  const startedAt = performance.now();

  try {
    return await runWithTimeout(async (signal) => {
      const response = await fetch(`${config.baseUrl}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: config.text }),
        signal,
      });

      if (!response.ok) {
        await response.body?.cancel();
        return {
          success: false,
          latencyMs: performance.now() - startedAt,
          responseBytes: 0,
          provider: null,
        };
      }

      const responseBytes = (await response.arrayBuffer()).byteLength;

      return {
        success: true,
        latencyMs: performance.now() - startedAt,
        responseBytes,
        provider: response.headers.get("X-TTS-Provider")?.toLowerCase() || null,
      };
    }, config.timeoutMs);
  } catch {
    return {
      success: false,
      latencyMs: performance.now() - startedAt,
      responseBytes: 0,
      provider: null,
    };
  }
}

async function runRequests(count, concurrency, requestFn) {
  const results = new Array(count);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < count) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await requestFn();
    }
  }

  const workerCount = Math.min(count, concurrency);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

function formatNumber(value, suffix = "") {
  return value === null ? "n/a" : `${value.toFixed(2)}${suffix}`;
}

function printReport(summary) {
  console.table([
    { Outcome: "Total measured requests", Result: summary.total },
    { Outcome: "Successful requests", Result: summary.successes },
    { Outcome: "Failed requests", Result: summary.failures },
    { Outcome: "Success rate", Result: formatNumber(summary.successRate, "%") },
    { Outcome: "Error rate", Result: formatNumber(summary.errorRate, "%") },
    { Outcome: "Mean latency", Result: formatNumber(summary.meanLatencyMs, " ms") },
    { Outcome: "p50 latency", Result: formatNumber(summary.p50LatencyMs, " ms") },
    { Outcome: "p95 latency", Result: formatNumber(summary.p95LatencyMs, " ms") },
    { Outcome: "Minimum latency", Result: formatNumber(summary.minLatencyMs, " ms") },
    { Outcome: "Maximum latency", Result: formatNumber(summary.maxLatencyMs, " ms") },
    {
      Outcome: "Completed requests per minute",
      Result: formatNumber(summary.completedPerMinute),
    },
    {
      Outcome: "Average successful-response size",
      Result: formatNumber(summary.averageResponseBytes, " bytes"),
    },
    {
      Outcome: "Final Gemini",
      Result: `${summary.geminiCount} (${formatNumber(summary.geminiPercentage, "%")})`,
    },
    {
      Outcome: "Final ElevenLabs",
      Result: `${summary.elevenLabsCount} (${formatNumber(summary.elevenLabsPercentage, "%")})`,
    },
  ]);
}

export async function main() {
  const config = readConfiguration();

  await verifyHealth(config);
  console.log("Local live-provider benchmark, not production traffic");
  console.warn("Warning: live TTS requests can consume provider quota.");
  await runRequests(config.warmup, config.concurrency, () => makeTtsRequest(config));

  const startedAt = performance.now();
  const results = await runRequests(config.requests, config.concurrency, () => makeTtsRequest(config));
  const elapsedMs = performance.now() - startedAt;

  printReport(summarizeResults(results, elapsedMs));

  if (config.requests < 20) {
    console.warn("Warning: p95 is unstable with fewer than 20 measured requests.");
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  main().catch((error) => {
    console.error(`Benchmark failed: ${error.message}`);
    process.exitCode = 1;
  });
}
