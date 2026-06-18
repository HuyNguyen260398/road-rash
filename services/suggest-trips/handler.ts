import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { GetParameterCommand, SSMClient } from "@aws-sdk/client-ssm";
import { ddb } from "../shared/dynamo";
import { error, json } from "../shared/http";
import {
  filterToCandidates,
  parsePositiveInt,
  parseSuggestRequest,
  parseSuggestResponse,
} from "./select";
import type { SuggestRequest, SuggestionResult, Trip } from "../../lib/types";

// suggestTrips handler behind the public POST /suggest route (throttled hard at
// the API Gateway stage — RISK-006). Gemini is server-side ONLY (SEC-001): the
// key is read from SSM at runtime and never reaches the browser. The model ranks
// ONLY ids from the candidate set the client passes in; returned ids are filtered
// to that set and then re-validated against DynamoDB before render (REQ-007,
// RISK-007). On any Gemini error/timeout we return an error status so the client
// degrades to plain search (TASK-042), never a hang.

const TABLE = process.env.TRIP_TABLE ?? "";
const GEMINI_PARAM_NAME = process.env.GEMINI_PARAM_NAME ?? "";
// gemini-2.5-flash is the default: gemini-2.0-flash now has zero free-tier quota
// (the API returns 429 RESOURCE_EXHAUSTED with limit:0), which the handler turns
// into the 502 → client plain-search fallback. Overridable via GEMINI_MODEL.
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";
// Bounded so we always answer within the API Gateway HTTP API 30s integration
// ceiling (the Lambda timeout sits just under it); on overrun we fall back. A
// bad/non-numeric override falls back rather than becoming NaN (= a 0ms abort).
const GEMINI_TIMEOUT_MS = parsePositiveInt(
  process.env.GEMINI_TIMEOUT_MS,
  20000,
);

// Cap how many ranked ids we re-validate + return. The candidate-count and
// per-field input bounds live in parseSuggestRequest (select.ts).
const MAX_SUGGESTIONS = 12;

const ssm = new SSMClient({});

// Cache the decrypted key across warm invocations so we hit SSM once per cold
// start, not once per request.
let cachedKey: string | undefined;

async function getGeminiKey(): Promise<string> {
  if (cachedKey) return cachedKey;
  const result = await ssm.send(
    new GetParameterCommand({
      Name: GEMINI_PARAM_NAME,
      WithDecryption: true,
    }),
  );
  const value = result.Parameter?.Value;
  if (!value) throw new Error("Gemini API key parameter is empty");
  cachedKey = value;
  return value;
}

// Compact, one-line-per-trip rendering so the prompt stays small (don't dump full
// records). The model is told to pick only from these ids and return strict JSON.
function buildPrompt(req: SuggestRequest): string {
  const lines = req.candidates.map((c) => {
    const where = [c.location, c.city, c.province, c.country]
      .filter(Boolean)
      .join(", ");
    const desc = c.description ? ` — ${c.description.slice(0, 160)}` : "";
    return `- id=${c.id} | ${c.name} | ${where} | ${c.tripType} | ${c.vehicle} | ${c.durationDays}d${desc}`;
  });

  const language = req.locale === "vi" ? "Vietnamese" : "English";

  return [
    "You are a travel trip recommender. From the candidate trips below, pick the",
    "ones that best match the user's request and rank them best-first.",
    "",
    "Rules:",
    "- Respond with ONLY a strict JSON object of the form:",
    '  {"summary": "<text>", "results": [{"id": "<id>", "reason": "<short why-it-fits>"}]}.',
    `- Write "summary" as 1-2 sentences in ${language}, answering the request and`,
    "  naming the best-matching trips. If nothing fits, say so briefly.",
    '- In "results", use ONLY ids from the candidate list. Never invent ids.',
    `- Return at most ${MAX_SUGGESTIONS} results. If nothing fits, use [].`,
    "- Keep each reason to one short sentence.",
    "",
    `User request: ${req.prompt}`,
    "",
    "Candidate trips:",
    ...lines,
  ].join("\n");
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Key travels in a header, not the query string, so it stays out of
        // access logs.
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          // Force a JSON body so parseSuggestResponse has clean input.
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Gemini responded ${response.status}`);
    }

    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  } finally {
    clearTimeout(timer);
  }
}

// Confirm each surviving id still exists in the Trip table (the candidate set is
// client-supplied, so a stale/deleted trip could slip through). GetItem per id —
// the suggest role has GetItem but not BatchGetItem/Scan (SEC-005).
async function validateAgainstTable(
  suggestions: SuggestionResult[],
): Promise<SuggestionResult[]> {
  const checked = await Promise.all(
    suggestions.map(async (s) => {
      const result = await ddb.send(
        new GetCommand({
          TableName: TABLE,
          Key: { id: s.id },
          ProjectionExpression: "id",
        }),
      );
      return (result.Item as Trip | undefined)?.id ? s : undefined;
    }),
  );
  return checked.filter((s): s is SuggestionResult => s !== undefined);
}

async function suggest(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> {
  // Missing required wiring is a server misconfiguration, not an upstream Gemini
  // outage — surface it as 500 so it isn't masked by the 502 fallback path.
  if (!TABLE || !GEMINI_PARAM_NAME) {
    console.error(
      "suggest-trips misconfigured: TRIP_TABLE/GEMINI_PARAM_NAME not set",
    );
    return error(500, "Internal server error");
  }

  const req = parseSuggestRequest(event.body);
  if (!req) {
    return error(400, "prompt and a non-empty candidates array are required");
  }

  const candidateIds = new Set(req.candidates.map((c) => c.id));

  let text: string;
  try {
    const apiKey = await getGeminiKey();
    text = await callGemini(buildPrompt(req), apiKey);
  } catch (err) {
    // Gemini unavailable/timed out — signal the client to fall back to plain
    // search (TASK-042) rather than hanging or 500-ing on an internal error.
    console.error("gemini call failed", err);
    return error(502, "AI suggestions are temporarily unavailable");
  }

  // Parse → keep only candidate-set ids → cap → re-validate against the table.
  const { summary, suggestions: parsed } = parseSuggestResponse(text);
  const inSet = filterToCandidates(parsed, candidateIds).slice(
    0,
    MAX_SUGGESTIONS,
  );
  const suggestions = await validateAgainstTable(inSet);

  return json(200, { summary, suggestions });
}

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyStructuredResultV2> {
  try {
    if (event.routeKey === "POST /suggest") {
      return await suggest(event);
    }
    return error(404, `Unsupported route: ${event.routeKey}`);
  } catch (err) {
    console.error("suggest-trips handler error", err);
    return error(500, "Internal server error");
  }
}
