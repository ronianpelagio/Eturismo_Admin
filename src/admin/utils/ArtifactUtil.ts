// ─────────────────────────────────────────────────────────────────────────────
//  artifactUtils.ts  –  Translation · TTS Audio · Supabase Upload
// ─────────────────────────────────────────────────────────────────────────────

import { supabase } from '../services/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TranslationResult {
  description_en: string;
  description_fil: string;
  description_ja: string;
  description_es: string;
  description_ko: string;
  name_en: string;
  name_fil: string;
  name_ja: string;
  name_es: string;
  name_ko: string;
}

export interface AudioUploadResult {
  lang: string;
  url: string;
}

// ─── Language config ──────────────────────────────────────────────────────────

const LANG_CONFIG = [
  {
    code: 'en' as const,
    label: 'English',
    myMemoryCode: 'en-US',
    gttsCode: 'en',
    googleCode: 'en',
    dbDesc: 'description_en',
    dbName: 'name',
    dbAudio: 'audio_en',
  },
  {
    code: 'fil' as const,
    label: 'Filipino',
    myMemoryCode: 'tl-PH',
    gttsCode: 'tl',
    googleCode: 'tl',
    dbDesc: 'description_fil',
    dbName: 'name_fil',
    dbAudio: 'audio_fil',
  },
  {
    code: 'ja' as const,
    label: 'Japanese',
    myMemoryCode: 'ja-JP',
    gttsCode: 'ja',
    googleCode: 'ja',
    dbDesc: 'description_ja',
    dbName: 'name_ja',
    dbAudio: 'audio_ja',
  },
  {
    code: 'es' as const,
    label: 'Spanish',
    myMemoryCode: 'es-ES',
    gttsCode: 'es',
    googleCode: 'es',
    dbDesc: 'description_es',
    dbName: 'name_es',
    dbAudio: 'audio_es',
  },
  {
    code: 'ko' as const,
    label: 'Korean',
    myMemoryCode: 'ko-KR',
    gttsCode: 'ko',
    googleCode: 'ko',
    dbDesc: 'description_ko',
    dbName: 'name_ko',
    dbAudio: 'audio_ko',
  },
] as const;

type LangCode = 'en' | 'fil' | 'ja' | 'es' | 'ko';

// ─────────────────────────────────────────────────────────────────────────────
//  FUNCTION 1 — translateAllLanguages (FIXED)
// ─────────────────────────────────────────────────────────────────────────────

export async function translateAllLanguages(
  sourceName: string,
  sourceDesc: string,
  onStep?: (msg: string) => void,
  email?: string,
): Promise<TranslationResult> {
  if (!sourceName.trim()) {
    throw new Error('Source name is empty. Please enter an English name first.');
  }
  if (!sourceDesc.trim()) {
    throw new Error('Source description is empty. Please enter an English description first.');
  }

  // Split text into smaller chunks for better translation
  function chunkText(text: string, maxLen = 300): string[] {
    if (text.length <= maxLen) return [text];
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      let end = start + maxLen;
      if (end < text.length) {
        const lastSpace = text.lastIndexOf(' ', end);
        if (lastSpace > start) end = lastSpace;
      }
      chunks.push(text.slice(start, end).trim());
      start = end;
    }
    return chunks;
  }

  // Using Google Translate API (more reliable)
  async function translateWithGoogle(text: string, targetCode: string): Promise<string> {
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetCode}&dt=t&q=${encodeURIComponent(text)}`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Google Translate HTTP ${res.status}`);
      
      const data = await res.json();
      let translated = '';
      
      if (data && data[0]) {
        for (const part of data[0]) {
          if (part[0]) {
            translated += part[0];
          }
        }
      }
      
      return translated || text;
    } catch (err) {
      console.warn(`Google Translate failed for ${targetCode}:`, err);
      return text;
    }
  }

  // Fallback to MyMemory if Google fails
  async function translateWithMyMemory(text: string, targetCode: string): Promise<string> {
    try {
      const emailParam = email ? `&de=${encodeURIComponent(email)}` : '';
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${targetCode}${emailParam}`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
      
      const json = await res.json();
      if (json.responseStatus !== 200 && json.responseStatus !== '200') {
        throw new Error(json.responseDetails || `Translation failed`);
      }
      
      let translated = (json.responseData?.translatedText as string) ?? text;
      // Remove unwanted suffixes
      translated = translated.replace(/\[[^\]]+\]$/, '').trim();
      return translated;
    } catch (err) {
      console.warn(`MyMemory failed for ${targetCode}:`, err);
      return text;
    }
  }

  async function translateFull(text: string, targetCode: string): Promise<string> {
    const chunks = chunkText(text);
    const translatedChunks = await Promise.all(
      chunks.map(async chunk => {
        // Try Google first, then MyMemory
        let result = await translateWithGoogle(chunk, targetCode);
        if (result === chunk) {
          result = await translateWithMyMemory(chunk, targetCode);
        }
        return result;
      })
    );
    return translatedChunks.join(' ');
  }

  const result: TranslationResult = {
    description_en: sourceDesc,
    name_en: sourceName,
    description_fil: '',
    description_ja: '',
    description_es: '',
    description_ko: '',
    name_fil: '',
    name_ja: '',
    name_es: '',
    name_ko: '',
  };

  const targets = LANG_CONFIG.filter(l => l.code !== 'en');

  for (const lang of targets) {
    onStep?.(`Translating ${lang.label} name...`);
    try {
      const translatedName = await translateFull(sourceName, lang.googleCode);
      (result as any)[lang.dbName] = translatedName;
      console.log(`✅ ${lang.label} name:`, translatedName);
    } catch (err: any) {
      console.error(`Failed to translate ${lang.label} name:`, err.message);
      (result as any)[lang.dbName] = sourceName;
    }

    onStep?.(`Translating ${lang.label} description...`);
    try {
      const translatedDesc = await translateFull(sourceDesc, lang.googleCode);
      (result as any)[lang.dbDesc] = translatedDesc;
      console.log(`✅ ${lang.label} description:`, translatedDesc.substring(0, 100));
    } catch (err: any) {
      console.error(`Failed to translate ${lang.label} description:`, err.message);
      (result as any)[lang.dbDesc] = sourceDesc;
    }
  }

  onStep?.('Translation complete ✓');
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
//  FUNCTION 2 — generateAudioBlob
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
//  FUNCTION 3 — saveAudioToSupabase
// ─────────────────────────────────────────────────────────────────────────────

export async function saveAudioToSupabase(
  artifactId: string,
  audioBlob: Blob,
  langCode: LangCode,
  extension = 'mp3',
  onStep?: (msg: string) => void,
): Promise<AudioUploadResult> {
  const lang = LANG_CONFIG.find(l => l.code === langCode);
  if (!lang) {
    throw new Error(`Unknown language code: ${langCode}`);
  }

  onStep?.(`Saving ${lang.label} audio reference…`);

  const audioMarker = `tts://${langCode}/${encodeURIComponent(artifactId)}`;
  
  const updateData: any = {};
  updateData[lang.dbAudio] = audioMarker;

  const { error: dbErr } = await supabase
    .from('artifacts')
    .update(updateData)
    .eq('id', artifactId);

  if (dbErr) {
    console.error('DB update error:', dbErr);
    throw new Error(`DB update failed for ${lang.label}: ${dbErr.message}`);
  }

  onStep?.(`${lang.label} audio reference saved ✓`);
  return { lang: langCode, url: audioMarker };
}

// ─────────────────────────────────────────────────────────────────────────────
//  FUNCTION 4 — generateAndSaveAllAudio
// ─────────────────────────────────────────────────────────────────────────────

export async function generateAndSaveAllAudio(
  artifactId: string,
  descriptions: Partial<Record<LangCode, string>>,
  onStep?: (msg: string) => void,
): Promise<AudioUploadResult[]> {
  const results: AudioUploadResult[] = [];

  for (const lang of LANG_CONFIG) {
    const text = descriptions[lang.code];
    if (!text?.trim()) continue;

    try {
      const audioMarker = `tts://${lang.code}/${encodeURIComponent(artifactId)}`;
      const updateData: any = {};
      updateData[lang.dbAudio] = audioMarker;
      
      await supabase
        .from('artifacts')
        .update(updateData)
        .eq('id', artifactId);
      
      results.push({ lang: lang.code, url: audioMarker });
      onStep?.(`✓ ${lang.label} audio ready`);
    } catch (err: any) {
      console.warn(`[generateAndSaveAllAudio] ${lang.label} skipped:`, err.message);
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
//  FUNCTION 5 — saveAudioDirect
// ─────────────────────────────────────────────────────────────────────────────

export async function saveAudioDirect(
  artifactId: string,
  audioUrl: string,
  langCode: LangCode,
  onStep?: (msg: string) => void,
): Promise<AudioUploadResult> {
  const lang = LANG_CONFIG.find(l => l.code === langCode);
  if (!lang) {
    throw new Error(`Unknown language code: ${langCode}`);
  }

  onStep?.(`Saving ${lang.label} audio URL to database…`);

  const updateData: any = {};
  updateData[lang.dbAudio] = audioUrl;

  const { error: dbErr } = await supabase
    .from('artifacts')
    .update(updateData)
    .eq('id', artifactId);

  if (dbErr) {
    console.error('DB update error:', dbErr);
    throw new Error(`DB update failed for ${lang.label}: ${dbErr.message}`);
  }

  onStep?.(`${lang.label} audio URL saved ✓`);
  return { lang: langCode, url: audioUrl };
}