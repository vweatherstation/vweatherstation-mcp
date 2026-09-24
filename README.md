# VWeatherStation MCP

MCP server exposing [VWeatherStation](https://vweatherstation.com)'s paid weather API as tools for AI assistants. Settlement-grade weather data for prediction markets (Polymarket/Kalshi), paid per call via **x402** (USDC on Base).

## Tools
- `get_temperature` — settlement-grade temp at market stations ($0.05)
- `get_all_market_weather` — all metrics for a city ($0.08)
- `get_rain` / `get_wind` / `get_snow` — per-metric ($0.04)
- `get_hurricanes` — active tropical cyclones, NHC ($0.05)
- `get_forecast_confidence` — multi-model confidence score ($0.01)

## Setup
Set `WALLET_PRIVATE_KEY` to a funded Base wallet (small USDC). Add to your MCP client config:
```json
{
  "mcpServers": {
    "vweatherstation": {
      "command": "npx",
      "args": ["-y", "vweatherstation-mcp"],
      "env": { "WALLET_PRIVATE_KEY": "0x..." }
    }
  }
}
```
Payments are handled automatically via x402. Each tool call pays the listed price to VWeatherStation's Base wallet.
