// Centralized locale declarations used across UI components.
export const SUPPORTED_LOCALES = ['ru', 'en', 'zh-Hant', 'de', 'es'] as const
export type LocaleCode = typeof SUPPORTED_LOCALES[number]
