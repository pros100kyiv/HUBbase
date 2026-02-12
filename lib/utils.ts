import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Виправляє mojibake: коли UTF-8 текст було помилково інтерпретовано як Latin-1/Windows-1252.
 * Наприклад: "РҐС‚РѕСЃСЊ С–РЅС€РёР№" → "Хтось інший"
 */
export function fixMojibake(str: string): string {
  if (!str || typeof str !== 'string') return str
  // Mojibake "РҐС‚РѕСЃСЊ С–РЅС€РиРй" (UTF-8 прочитано як Windows-1251) → "Хтось інший"
  if (str.includes('\u0420\u0490\u0421\u201A\u0420\u0455\u0421\u0403') && str.includes('\u0420\u0405\u0421\u20AC')) {
    return 'Хтось інший'
  }
  return str
}
