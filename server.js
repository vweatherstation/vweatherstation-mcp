#!/usr/bin/env node
/* VWeatherStation MCP server — exposes the full paid weather API as MCP tools.
   AI assistants (Claude Desktop, etc.) can discover + call these tools and pay
   via x402 (USDC on Base) using the wallet in WALLET_PRIVATE_KEY. */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { wrapFetchWithPayment } from "x402-fetch";
import { privateKeyToAccount } from "viem/accounts";

const BASE = "https://vweatherstation.com/api/v1";
const PK = process.env.WALLET_PRIVATE_KEY;
if (!PK) { console.error("Set WALLET_PRIVATE_KEY (a funded Base wallet)."); process.exit(1); }

const account = privateKeyToAccount(PK);
const payFetch = wrapFetchWithPayment(fetch, account);

async function callApi(path) {
  const res = await payFetch(BASE + path);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text, status: res.status }; }
}

const CITY = { type: "string", description: "city slug e.g. new-york, london, chicago, miami, tokyo (optional; omit for all cities)" };

const TOOLS = [
  {
    name: "get_weather",
    description: "General current weather and 7-day forecast for ANY latitude/longitude: temperature, feels-like, humidity, pressure, wind speed/gust/direction, precipitation, UV, sunrise/sunset and solar radiation. The everyday weather endpoint (not tied to prediction markets). $0.02/call.",
    inputSchema: { type: "object", properties: { lat: { type: "number" }, lon: { type: "number" }, units: { type: "string", description: "metric or imperial (optional)" } }, required: ["lat", "lon"] },
    run: (a) => callApi(`/weather/?lat=${a.lat}&lon=${a.lon}${a.units ? `&units=${encodeURIComponent(a.units)}` : ""}`),
  },
  {
    name: "get_temperature",
    description: "Settlement-grade temperature at the exact stations Polymarket/Kalshi temperature markets resolve on (KNYC Central Park, EGLL Heathrow, etc.). Current temp, today's high/low (settlement number), forecast. $0.05/call.",
    inputSchema: { type: "object", properties: { city: CITY } },
    run: (a) => callApi(`/temperature/${a.city ? `?city=${encodeURIComponent(a.city)}` : ""}`),
  },
  {
    name: "get_all_market_weather",
    description: "ALL weather-market metrics for a city in one call: temperature, rain, wind, snow at the settlement station. The complete feed for prediction-market traders. $0.08/call.",
    inputSchema: { type: "object", properties: { city: CITY } },
    run: (a) => callApi(`/markets/${a.city ? `?city=${encodeURIComponent(a.city)}` : ""}`),
  },
  {
    name: "get_rain",
    description: "Rainfall at prediction-market settlement stations. Today's total + 7-day forecast. $0.04/call.",
    inputSchema: { type: "object", properties: { city: CITY } },
    run: (a) => callApi(`/rain/${a.city ? `?city=${encodeURIComponent(a.city)}` : ""}`),
  },
  {
    name: "get_wind",
    description: "Wind speed and max gust at settlement stations, from live METAR. $0.04/call.",
    inputSchema: { type: "object", properties: { city: CITY } },
    run: (a) => callApi(`/wind/${a.city ? `?city=${encodeURIComponent(a.city)}` : ""}`),
  },
  {
    name: "get_snow",
    description: "Snowfall at settlement stations. Today's total + 7-day forecast. $0.04/call.",
    inputSchema: { type: "object", properties: { city: CITY } },
    run: (a) => callApi(`/snow/${a.city ? `?city=${encodeURIComponent(a.city)}` : ""}`),
  },
  {
    name: "get_hurricanes",
    description: "Active tropical cyclones with NHC classification, category, position and intensity — the settlement source for hurricane markets. $0.05/call.",
    inputSchema: { type: "object", properties: {} },
    run: () => callApi(`/hurricanes/`),
  },
  {
    name: "get_forecast_confidence",
    description: "Multi-model forecast confidence score (0-100) for a lat/lon, with per-day breakdown. How much to trust the forecast. $0.01/call.",
    inputSchema: { type: "object", properties: { lat: { type: "number" }, lon: { type: "number" } }, required: ["lat", "lon"] },
    run: (a) => callApi(`/confidence/?lat=${a.lat}&lon=${a.lon}`),
  },
];

const server = new Server({ name: "vweatherstation", version: "2.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
}));
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const tool = TOOLS.find((t) => t.name === req.params.name);
  if (!tool) throw new Error("Unknown tool: " + req.params.name);
  const result = await tool.run(req.params.arguments || {});
  return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
});
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("VWeatherStation MCP server running (8 tools).");
