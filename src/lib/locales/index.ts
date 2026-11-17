import { LocaleDefinition } from './types';
import { coLocale } from './co';
import { mxLocale } from './mx';

export * from './types';
export { coLocale } from './co';
export { mxLocale } from './mx';

export const LOCALES: Record<string, LocaleDefinition> = {
  es_CO: coLocale,
  es_MX: mxLocale,
};

export function getLocaleDefinition(localeCode: string): LocaleDefinition {
  if (localeCode in LOCALES) {
    return LOCALES[localeCode];
  }
  // Default de respaldo a Colombia o México si coincide idioma
  if (localeCode.startsWith('es')) {
    return coLocale;
  }
  return coLocale;
}
