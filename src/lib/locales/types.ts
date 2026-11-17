export interface LocalizedPerson {
  firstNames: string[];
  lastNames: string[];
}

export interface LocalizedAddress {
  cities: string[];
  states?: string[];
  streets: string[];
  streetTypes: string[];
  neighborhoods?: string[];
  formatAddress: (randomFn: () => number) => string;
}

export interface LocalizedIdentity {
  generateDocument: (randomFn: () => number) => string;
  documentName: string;
}

export interface LocalizedPhone {
  prefixes: string[];
  formatPhone: (randomFn: () => number) => string;
}

export interface LocalizedCurrency {
  code: string;
  symbol: string;
  roundPrice: (rawPrice: number) => number;
  formatPrice: (amount: number) => string;
  defaultPriceRange: { min: number; max: number };
}

export interface LocaleDefinition {
  code: string;
  name: string;
  country: string;
  person: LocalizedPerson;
  identity: LocalizedIdentity;
  address: LocalizedAddress;
  phone: LocalizedPhone;
  currency: LocalizedCurrency;
  companies: string[];
}
