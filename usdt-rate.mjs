// IMPORTB2B Control Financiero
// Netlify Function — Binance P2P USDT/ARS
// Fuente principal oficial: Binance P2P quote-price
// BUY  = comprar USDT pagando ARS
// SELL = vender USDT recibiendo ARS

const BASE = "https://www.binance.com";
const QUOTE_PATH = "/bapi/c2c/v1/public/c2c/agent/quote-price";
const ADS_PATH = "/bapi/c2c/v1/public/c2c/agent/ad-list";

const headers = {
  "accept": "application/json",
  "user-agent": "IMPORTB2B-Control/0.2"
};

async function getJson(url) {
  const res = await fetch(url, {
    method: "GET",
    headers,
    cache: "no-store"
  });

  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
  return await res.json();
}

function asPositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extractQuotePrice(payload) {
  const directCandidates = [
    payload?.price,
    payload?.quotePrice,
    payload?.referencePrice,
    payload?.data?.price,
    payload?.data?.quotePrice,
    payload?.data?.referencePrice,
    payload?.data?.data?.price,
    payload?.result?.price,
    payload?.result?.quotePrice,
    payload?.result?.referencePrice
  ];

  for (const candidate of directCandidates) {
    const n = asPositiveNumber(candidate);
    if (n) return n;
  }

  const queue = [payload];
  const visited = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);

    for (const [key, value] of Object.entries(current)) {
      if (["price", "quotePrice", "referencePrice"].includes(key)) {
        const n = asPositiveNumber(value);
        if (n) return n;
      }
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return null;
}

function collectAdPrices(payload) {
  const prices = [];
  const queue = [payload];
  const visited = new Set();

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || visited.has(current)) continue;
    visited.add(current);

    if (Object.prototype.hasOwnProperty.call(current, "price")) {
      const n = asPositiveNumber(current.price);
      if (n) prices.push(n);
    }

    for (const value of Object.values(current)) {
      if (value && typeof value === "object") queue.push(value);
    }
  }
  return prices;
}

async function getOfficialQuote(tradeType) {
  const params = new URLSearchParams({
    fiat: "ARS",
    asset: "USDT",
    tradeType
  });

  const payload = await getJson(`${BASE}${QUOTE_PATH}?${params.toString()}`);
  const price = extractQuotePrice(payload);

  if (!price) throw new Error(`Sin precio en quote-price ${tradeType}`);
  return { price };
}

async function getAdFallback(tradeType) {
  const params = new URLSearchParams({
    fiat: "ARS",
    asset: "USDT",
    tradeType,
    limit: "10"
  });

  const payload = await getJson(`${BASE}${ADS_PATH}?${params.toString()}`);
  const prices = collectAdPrices(payload);

  if (!prices.length) throw new Error(`Sin anuncios en ad-list ${tradeType}`);

  const price = tradeType === "BUY"
    ? Math.min(...prices)
    : Math.max(...prices);

  return { price };
}

async function resolveSide(tradeType) {
  try {
    const result = await getOfficialQuote(tradeType);
    return {
      price: result.price,
      source: "Binance P2P quote-price",
      method: "official_quote"
    };
  } catch (quoteError) {
    const fallback = await getAdFallback(tradeType);
    return {
      price: fallback.price,
      source: "Binance P2P ad-list",
      method: "official_ads_fallback",
      quoteError: quoteError.message
    };
  }
}

export default async () => {
  try {
    const [buyResult, sellResult] = await Promise.all([
      resolveSide("BUY"),
      resolveSide("SELL")
    ]);

    return Response.json({
      pair: "USDT/ARS",
      buy: Math.round(buyResult.price * 100) / 100,
      sell: Math.round(sellResult.price * 100) / 100,
      source:
        buyResult.source === sellResult.source
          ? buyResult.source
          : "Binance P2P",
      buySource: buyResult.source,
      sellSource: sellResult.source,
      buyMethod: buyResult.method,
      sellMethod: sellResult.method,
      updatedAt: new Date().toISOString()
    }, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store, max-age=0"
      }
    });
  } catch (error) {
    return Response.json({
      error: "BINANCE_P2P_UNAVAILABLE",
      message: error?.message || "No se pudo obtener la cotización Binance P2P."
    }, {
      status: 502,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store, max-age=0"
      }
    });
  }
};

export const config = {
  path: "/api/usdt"
};
