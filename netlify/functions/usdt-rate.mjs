// Netlify Function: referencia USDT/ARS de Binance P2P.
// Objetivo: obtener precios de anuncios reales y filtrar outliers/promocionados.
// IMPORTANTE: el endpoint web público de Binance puede cambiar sin aviso.
// La app mantiene fallback a última cotización guardada / cotización manual.

const BINANCE_WEB_ENDPOINT =
  "https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search";

const commonHeaders = {
  "content-type": "application/json",
  "accept": "application/json",
  "user-agent": "Mozilla/5.0 IMPORTB2B-Control/0.1"
};

async function search(tradeType) {
  const payload = {
    page: 1,
    rows: 20,
    payTypes: [],
    publisherType: null,
    asset: "USDT",
    tradeType,
    fiat: "ARS"
  };

  const res = await fetch(BINANCE_WEB_ENDPOINT, {
    method: "POST",
    headers: commonHeaders,
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error(`Binance P2P HTTP ${res.status}`);
  }

  const json = await res.json();
  return Array.isArray(json?.data) ? json.data : [];
}

function median(values) {
  const arr = [...values].sort((a,b)=>a-b);
  if (!arr.length) return null;
  const m = Math.floor(arr.length / 2);
  return arr.length % 2 ? arr[m] : (arr[m-1] + arr[m]) / 2;
}

function normalize(rows) {
  return rows.map(item => {
    const adv = item?.adv || {};
    const advertiser = item?.advertiser || {};
    return {
      price: Number(adv.price),
      min: Number(adv.minSingleTransAmount || 0),
      max: Number(adv.dynamicMaxSingleTransAmount || adv.maxSingleTransAmount || 0),
      surplus: Number(adv.surplusAmount || 0),
      nick: advertiser.nickName || "",
      monthOrders: Number(
        advertiser.monthOrderCount ??
        advertiser.monthOrderCountInLast30Days ??
        advertiser.userStatsRet?.monthOrderCount ??
        0
      ),
      completion: Number(
        advertiser.monthFinishRate ??
        advertiser.monthFinishRateInLast30Days ??
        advertiser.userStatsRet?.monthFinishRate ??
        0
      ),
      merchant: Boolean(
        advertiser.userType === "merchant" ||
        advertiser.isMerchant ||
        advertiser.proMerchant ||
        advertiser.userType === "pro"
      )
    };
  }).filter(x => Number.isFinite(x.price) && x.price > 0);
}

function robustMarket(rows, side) {
  let ads = normalize(rows);
  if (!ads.length) throw new Error(`Sin anuncios ${side}`);

  // 1) Excluir outliers >3% respecto de la mediana.
  // Esto elimina promociones como 1.660 vs ~1.585 o 1.501 vs ~1.578.
  const med = median(ads.map(x => x.price));
  ads = ads.filter(x => Math.abs(x.price - med) / med <= 0.03);

  // 2) Si Binance devuelve métricas, priorizar historial confiable.
  const withStats = ads.filter(x => x.monthOrders > 0 || x.completion > 0);
  if (withStats.length >= 3) {
    const qualified = withStats.filter(x =>
      (x.monthOrders === 0 || x.monthOrders >= 50) &&
      (x.completion === 0 || x.completion >= 0.90 || x.completion >= 90)
    );
    if (qualified.length >= 3) ads = qualified;
  }

  // 3) Ordenar anuncios válidos como se ve en Binance P2P.
  // BUY (comprar USDT): menor precio válido es mejor.
  // SELL (vender USDT): mayor precio válido es mejor.
  // Guardamos top 3 como muestra, pero la cotización visible usa el mejor.
  ads.sort((a,b) => side === "BUY" ? a.price - b.price : b.price - a.price);
  const top = ads.slice(0, Math.min(3, ads.length));
  const reference = top[0].price;

  return {
    reference: Math.round(reference * 100) / 100,
    median: Math.round(med * 100) / 100,
    sample: top
  };
}

export default async () => {
  try {
    const [buyRows, sellRows] = await Promise.all([search("BUY"), search("SELL")]);

    // Binance mapping:
    // BUY  = usuario paga fiat y recibe crypto.
    // SELL = usuario entrega crypto y recibe fiat.
    const buy = robustMarket(buyRows, "BUY");
    const sell = robustMarket(sellRows, "SELL");

    return Response.json({
      pair: "USDT/ARS",
      buy: buy.reference,
      sell: sell.reference,
      source: "Binance P2P",
      methodology: "mejor_precio_valido_filtrado_3pct",
      updatedAt: new Date().toISOString(),
      debug: {
        buyMedian: buy.median,
        sellMedian: sell.median,
        buySample: buy.sample.map(x => ({price:x.price,nick:x.nick,orders:x.monthOrders,completion:x.completion})),
        sellSample: sell.sample.map(x => ({price:x.price,nick:x.nick,orders:x.monthOrders,completion:x.completion}))
      }
    }, {
      status: 200,
      headers: {
        "cache-control": "no-store, max-age=0",
        "content-type": "application/json; charset=utf-8"
      }
    });
  } catch (error) {
    return Response.json({
      error: "BINANCE_P2P_UNAVAILABLE",
      message: error?.message || "No se pudo obtener la cotización."
    }, {
      status: 502,
      headers: {"cache-control":"no-store"}
    });
  }
};

export const config = {
  path: "/api/usdt"
};
