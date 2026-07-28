// client/src/utils/currencyUtils.js

/** Display symbol for an ISO code ('JPY' -> '¥'); falls back to the code. */
export const symbolFor = (code) => {
  if (!/^[A-Z]{3}$/.test(code || '')) return null;
  try {
    const part = new Intl.NumberFormat('en', { style: 'currency', currency: code })
      .formatToParts(0)
      .find((p) => p.type === 'currency');
    return part ? part.value : code;
  } catch {
    return code;
  }
};
