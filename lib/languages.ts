/** Supported Sarathy companion languages (profiles.preferred_language). */

export type PreferredLanguageCode = 'en' | 'hi' | 'pt-BR' | 'zh' | 'vi' | 'tl'

export interface LanguageOption {
  code: PreferredLanguageCode
  flag: string
  /** Short label shown in pickers */
  label: string
  /** Full name for AI system prompts */
  promptName: string
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', flag: '🇬🇧', label: 'English', promptName: 'English' },
  { code: 'hi', flag: '🇮🇳', label: 'Hindi · हिन्दी', promptName: 'Hindi' },
  {
    code: 'pt-BR',
    flag: '🇧🇷',
    label: 'Portuguese · Português',
    promptName: 'Brazilian Portuguese',
  },
  { code: 'zh', flag: '🇨🇳', label: 'Mandarin · 中文', promptName: 'Mandarin Chinese' },
  {
    code: 'vi',
    flag: '🇻🇳',
    label: 'Vietnamese · Tiếng Việt',
    promptName: 'Vietnamese',
  },
  { code: 'tl', flag: '🇵🇭', label: 'Filipino · Tagalog', promptName: 'Filipino (Tagalog)' },
]

export const DEFAULT_PREFERRED_LANGUAGE: PreferredLanguageCode = 'en'

export function isPreferredLanguageCode(value: unknown): value is PreferredLanguageCode {
  return typeof value === 'string' && LANGUAGE_OPTIONS.some((o) => o.code === value)
}

export function normalizePreferredLanguage(
  value: string | null | undefined
): PreferredLanguageCode {
  if (isPreferredLanguageCode(value)) return value
  // Legacy language_preference sometimes stored as plain "en"
  if (value === 'pt' || value === 'pt_BR') return 'pt-BR'
  if (value === 'zh-CN' || value === 'zh-Hans') return 'zh'
  if (value === 'fil') return 'tl'
  return DEFAULT_PREFERRED_LANGUAGE
}

export function getLanguageOption(code: string | null | undefined): LanguageOption {
  const normalized = normalizePreferredLanguage(code)
  return LANGUAGE_OPTIONS.find((o) => o.code === normalized) ?? LANGUAGE_OPTIONS[0]
}

/**
 * Hard rule injected into Ask Sarathy, Daily brief, and related AI prompts.
 */
export function preferredLanguagePromptRule(code: string | null | undefined): string {
  const option = getLanguageOption(code)
  return `Always respond in ${option.promptName}. For Hindi use Devanagari script.`
}
