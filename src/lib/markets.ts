export type MarketCode = "GB" | "DE";

export interface Market {
  code: MarketCode;
  name: string;
  currency: string;
  postalCodePattern: RegExp;
  postalCodeHint: string;
}

export const STORE_CURRENCY_CODE = "GBP";

export const markets: Record<MarketCode, Market> = {
  GB: {
    code: "GB",
    name: "United Kingdom",
    currency: STORE_CURRENCY_CODE,
    postalCodePattern: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i,
    postalCodeHint: "Enter a valid UK postcode, e.g. EC1A 1BB",
  },
  DE: {
    code: "DE",
    name: "Germany",
    currency: STORE_CURRENCY_CODE,
    postalCodePattern: /^\d{5}$/,
    postalCodeHint: "Enter a 5-digit German postcode, e.g. 10115",
  },
};

export const marketCodes = Object.keys(markets) as MarketCode[];

export const marketList: Market[] = marketCodes.map((code) => markets[code]);

export function isSupportedCountry(country: string): country is MarketCode {
  return country.trim().toUpperCase() in markets;
}

export function marketForCountry(country: string): Market | undefined {
  return markets[country.trim().toUpperCase() as MarketCode];
}

export function countryName(code: string): string {
  return markets[code as MarketCode]?.name ?? code;
}

const US_MARKERS = /\b(united states|u\.?s\.?a?\.?|america)\b/i;

const US_STATES =
  /\b(alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|florida|georgia|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|nevada|new hampshire|new jersey|new mexico|new york|north carolina|north dakota|ohio|oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming)\b/i;

export interface ShippingAddressInput {
  address1: string;
  address2?: string;
  city: string;
  region?: string;
  postalCode: string;
}

export type AddressValidation =
  | { ok: true; country: MarketCode }
  | { ok: false; field: string; message: string };

export function validateShippingAddress(
  country: string,
  address: ShippingAddressInput,
): AddressValidation {
  const normalized = country.trim().toUpperCase();
  if (!isSupportedCountry(normalized)) {
    return {
      ok: false,
      field: "country",
      message: "We currently ship to the UK and Germany only.",
    };
  }

  const market = markets[normalized];
  if (!market.postalCodePattern.test(address.postalCode.trim())) {
    return { ok: false, field: "postalCode", message: market.postalCodeHint };
  }

  const textFields = [
    address.address1,
    address.address2 ?? "",
    address.city,
    address.region ?? "",
  ];
  for (const field of textFields) {
    if (US_MARKERS.test(field.trim()) || US_STATES.test(field)) {
      return {
        ok: false,
        field: "address1",
        message: `This looks like a US address. We only ship to ${markets[normalized].name}.`,
      };
    }
  }

  return { ok: true, country: normalized };
}