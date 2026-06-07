require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { gSpeak } = require('gspeak');
const fs = require('fs');
const path = require('path');
const { supabase } = require('./supabase.cjs');

const app = express();
const upload = multer();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 5000;

// Language mapping for gSpeak
const LANG_MAP = {
  en: 'en',
  fil: 'fil',
  ja: 'ja',
  es: 'es',
  ko: 'ko',
};

// Voice options for each language
const VOICE_OPTIONS = {
  en: ['en-US-Standard-A', 'en-US-Standard-B', 'en-US-Standard-C', 'en-US-Standard-D', 'en-US-Standard-E', 'en-US-Standard-F', 'en-US-Standard-G', 'en-US-Standard-H', 'en-US-Standard-I', 'en-US-Standard-J'],
  fil: ['fil-PH-Standard-A', 'fil-PH-Standard-B', 'fil-PH-Standard-C', 'fil-PH-Standard-D'],
  ja: ['ja-JP-Standard-A', 'ja-JP-Standard-B', 'ja-JP-Standard-C', 'ja-JP-Standard-D'],
  es: ['es-ES-Standard-A', 'es-ES-Standard-B', 'es-ES-Standard-C', 'es-ES-Standard-D', 'es-US-Standard-A', 'es-US-Standard-B', 'es-US-Standard-C'],
  ko: ['ko-KR-Standard-A', 'ko-KR-Standard-B', 'ko-KR-Standard-C', 'ko-KR-Standard-D'],
};

const DEFAULT_VOICE = {
  en: 'en-US-Standard-A',
  fil: 'fil-PH-Standard-A',
  ja: 'ja-JP-Standard-A',
  es: 'es-ES-Standard-A',
  ko: 'ko-KR-Standard-A',
};

// Map language to database column
const COLUMN_MAP = {
  en: 'audio_en',
  fil: 'audio_fil',
  ja: 'audio_ja',
  es: 'audio_es',
  ko: 'audio_ko',
};

// ─────────────────────────────────────────────────────────────────────────────
//  TEXT SANITIZATION FUNCTION FOR DESCRIPTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sanitize description text for TTS generation
 * Removes problematic characters, HTML, URLs, and normalizes text
 */
function sanitizeDescription(text, lang = 'en') {
  if (!text || typeof text !== 'string') return '';
  
  let sanitized = text;
  
  // 1. Remove HTML tags and entities
  sanitized = sanitized.replace(/<[^>]*>/g, ' ');
  sanitized = sanitized.replace(/&[a-z]+;/gi, ' ');
  sanitized = sanitized.replace(/&#\d+;/g, ' ');
  
  // 2. Remove URLs (http, https, ftp, www)
  sanitized = sanitized.replace(/(https?:\/\/[^\s]+)/g, ' ');
  sanitized = sanitized.replace(/(ftp:\/\/[^\s]+)/g, ' ');
  sanitized = sanitized.replace(/(www\.[^\s]+)/g, ' ');
  
  // 3. Remove email addresses
  sanitized = sanitized.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, ' ');
  
  // 4. Remove markdown formatting
  sanitized = sanitized.replace(/\*\*([^*]+)\*\*/g, '$1'); // Bold
  sanitized = sanitized.replace(/\*([^*]+)\*/g, '$1');     // Italic
  sanitized = sanitized.replace(/__([^_]+)__/g, '$1');     // Bold alt
  sanitized = sanitized.replace(/_([^_]+)_/g, '$1');       // Italic alt
  sanitized = sanitized.replace(/~~([^~]+)~~/g, '$1');     // Strikethrough
  sanitized = sanitized.replace(/`([^`]+)`/g, '$1');       // Inline code
  sanitized = sanitized.replace(/```[\s\S]*?```/g, ' ');   // Code blocks
  
  // 5. Remove special characters but keep language-appropriate ones
  if (lang === 'ja') {
    // Japanese: keep Hiragana, Katakana, Kanji, basic punctuation
    sanitized = sanitized.replace(/[^\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\s\.\,\!\\?\!\-\u3002\u3001\u300c\u300d]/g, ' ');
  } else if (lang === 'ko') {
    // Korean: keep Hangul, basic punctuation
    sanitized = sanitized.replace(/[^\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\s\.\,\!\\?\!]/g, ' ');
  } else if (lang === 'fil') {
    // Filipino: keep letters with diacritics
    sanitized = sanitized.replace(/[^a-zA-Z\sñÑáéíóúÁÉÍÓÚ\.,!?]/g, ' ');
  } else if (lang === 'es') {
    // Spanish: keep letters with diacritics and inverted punctuation
    sanitized = sanitized.replace(/[^a-zA-Z\sñÑáéíóúüÁÉÍÓÚÜçÇ¿¡\.,!?]/g, ' ');
  } else {
    // English and others: basic alphanumeric and punctuation
    sanitized = sanitized.replace(/[^a-zA-Z\s\.,!?'-]/g, ' ');
  }
  
  // 6. Fix common punctuation issues
  sanitized = sanitized.replace(/\.{3,}/g, '...');    // Multiple dots
  sanitized = sanitized.replace(/!{2,}/g, '!');       // Multiple exclamation
  sanitized = sanitized.replace(/\?{2,}/g, '?');      // Multiple question marks
  sanitized = sanitized.replace(/,{2,}/g, ',');       // Multiple commas
  
  // 7. Remove standalone punctuation at word boundaries
  sanitized = sanitized.replace(/\s+([.,!?])/g, '$1');
  sanitized = sanitized.replace(/([.,!?])\s+([.,!?])/g, '$1 $2');
  
  // 8. Fix spacing around punctuation
  sanitized = sanitized.replace(/\s+([.,!?])/g, '$1');
  sanitized = sanitized.replace(/([.,!?])([^\s])/g, '$1 $2');
  
  // 9. Remove excessive whitespace
  sanitized = sanitized.replace(/\s+/g, ' ');
  
  // 10. Trim leading/trailing whitespace and punctuation
  sanitized = sanitized.trim();
  sanitized = sanitized.replace(/^[^\w\s]+/, '');
  sanitized = sanitized.replace(/[^\w\s]+$/, '');
  
  // 11. Ensure sentences start with capital letter (for languages that use it)
  if (lang !== 'ja' && lang !== 'ko') {
    sanitized = sanitized.replace(/(^|\.\s+)([a-z])/g, (match, p1, p2) => {
      return p1 + p2.toUpperCase();
    });
  }
  
  // 12. Limit length (max 5000 chars for TTS)
  const MAX_LENGTH = 5000;
  if (sanitized.length > MAX_LENGTH) {
    // Try to cut at last sentence boundary
    let cutPoint = MAX_LENGTH;
    const lastPeriod = sanitized.lastIndexOf('.', MAX_LENGTH);
    const lastQuestion = sanitized.lastIndexOf('?', MAX_LENGTH);
    const lastExclamation = sanitized.lastIndexOf('!', MAX_LENGTH);
    const lastBreak = Math.max(lastPeriod, lastQuestion, lastExclamation);
    
    if (lastBreak > MAX_LENGTH * 0.7) {
      cutPoint = lastBreak + 1;
    }
    
    sanitized = sanitized.substring(0, cutPoint);
  }
  
  // 13. Final cleanup
  sanitized = sanitized.replace(/\s+/g, ' ').trim();
  
  return sanitized;
}

/**
 * Validate if text is suitable for TTS after sanitization
 */
function isValidForTTS(text) {
  if (!text || text.length === 0) return false;
  
  // Check if there's at least some readable content
  const hasLetters = /[a-zA-Z\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\uac00-\ud7af]/.test(text);
  if (!hasLetters) return false;
  
  // Check minimum word count (at least 3 words or 10 chars for non-space languages)
  const wordCount = text.split(/\s+/).length;
  if (wordCount < 2 && text.length < 15) return false;
  
  return true;
}

/**
 * Full description cleaning pipeline
 */
function cleanDescription(text, lang = 'en', options = {}) {
  const {
    removeSpecialChars = true,
    normalizeSpaces = true,
    capitalizeSentences = false,
    maxLength = 5000
  } = options;
  
  let cleaned = text;
  
  // Remove HTML
  cleaned = cleaned.replace(/<[^>]*>/g, ' ');
  
  // Remove URLs
  cleaned = cleaned.replace(/https?:\/\/[^\s]+/g, ' ');
  cleaned = cleaned.replace(/www\.[^\s]+/g, ' ');
  
  // Remove special characters if requested
  if (removeSpecialChars) {
    if (lang === 'ja') {
      cleaned = cleaned.replace(/[^\u3040-\u309f\u30a0-\u30ff\u4e00-\u9faf\s\.\,\!\\?\!]/g, ' ');
    } else if (lang === 'ko') {
      cleaned = cleaned.replace(/[^\uac00-\ud7af\s\.\,\!\\?\!]/g, ' ');
    } else {
      cleaned = cleaned.replace(/[^a-zA-Z\s\.\,\!\\?'-]/g, ' ');
    }
  }
  
  // Normalize spaces
  if (normalizeSpaces) {
    cleaned = cleaned.replace(/\s+/g, ' ');
  }
  
  // Capitalize sentences
  if (capitalizeSentences && lang !== 'ja' && lang !== 'ko') {
    cleaned = cleaned.replace(/(^|\.\s+)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase());
  }
  
  // Trim length
  if (maxLength && cleaned.length > maxLength) {
    cleaned = cleaned.substring(0, maxLength);
    const lastSpace = cleaned.lastIndexOf(' ');
    if (lastSpace > maxLength * 0.7) {
      cleaned = cleaned.substring(0, lastSpace);
    }
  }
  
  return cleaned.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN ENDPOINT with Sanitization
// ─────────────────────────────────────────────────────────────────────────────

app.post('/generate-audio', async (req, res) => {
  try {
    const { 
      artifactId, 
      text, 
      lang, 
      voiceName,
      voice,
      speakingRate,
      skipSanitize = false
    } = req.body;

    console.log('Received request:', { 
      artifactId, 
      originalTextLength: text?.length,
      lang, 
      voiceName,
      voice,
      speakingRate,
      skipSanitize
    });

    if (!artifactId || !text || !lang) {
      return res.status(400).json({
        error: 'artifactId, text, and lang are required',
        received: { artifactId, text: !!text, lang }
      });
    }

    // Sanitize the description
    let cleanText = text;
    let sanitizationApplied = false;
    
    if (!skipSanitize) {
      cleanText = sanitizeDescription(text, lang);
      sanitizationApplied = true;
      
      // Validate if text is usable
      if (!isValidForTTS(cleanText)) {
        return res.status(400).json({
          error: 'Text is not suitable for TTS after sanitization',
          originalText: text.substring(0, 200),
          sanitizedText: cleanText,
          suggestion: 'Please provide a longer or more meaningful description'
        });
      }
      
      console.log('Text sanitized:', {
        originalLength: text.length,
        cleanedLength: cleanText.length,
        removed: text.length - cleanText.length,
        preview: cleanText.substring(0, 100) + (cleanText.length > 100 ? '...' : '')
      });
    }

    const gspeakLang = LANG_MAP[lang];
    if (!gspeakLang) {
      return res.status(400).json({
        error: 'Unsupported language',
        supported: Object.keys(LANG_MAP)
      });
    }

    const selectedVoice = voiceName || voice || DEFAULT_VOICE[lang];
    const column = COLUMN_MAP[lang];
    
    if (!column) {
      return res.status(400).json({
        error: `No column mapping for language: ${lang}`
      });
    }

    // Generate unique filename with sanitized text hash
    const textHash = require('crypto').createHash('md5').update(cleanText.substring(0, 100)).digest('hex').substring(0, 8);
    const fileName = `${artifactId}_${lang}_${textHash}_${Date.now()}.mp3`;
    const tempPath = path.join(__dirname, fileName);

    console.log(`Generating audio for ${lang} with voice: ${selectedVoice}`);
    console.log(`Text preview: "${cleanText.substring(0, 150)}${cleanText.length > 150 ? '...' : ''}"`);

    // Create TTS with sanitized text
    let tts;
    try {
      tts = new gSpeak(cleanText, gspeakLang, { 
        voice: selectedVoice,
        slow: speakingRate < 0.8 ? true : false,
      });
    } catch (e) {
      console.log('Voice parameter not supported, using default');
      tts = new gSpeak(cleanText, gspeakLang);
    }

    // Save audio file
    await new Promise((resolve, reject) => {
      tts.save(tempPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    // Verify file
    if (!fs.existsSync(tempPath) || fs.statSync(tempPath).size === 0) {
      throw new Error('Audio file was not created or is empty');
    }

    // Read file
    const fileBuffer = fs.readFileSync(tempPath);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('artifacts-audio')
      .upload(fileName, fileBuffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const { data: publicData } = supabase.storage
      .from('artifacts-audio')
      .getPublicUrl(fileName);

    const audioUrl = publicData.publicUrl;

    // Save URL to artifacts table
    const { error: dbError } = await supabase
      .from('artifacts')
      .update({
        [column]: audioUrl,
      })
      .eq('id', artifactId);

    if (dbError) {
      throw dbError;
    }

    // Delete temp file
    fs.unlinkSync(tempPath);

    res.json({
      success: true,
      audioUrl,
      voiceUsed: selectedVoice,
      language: lang,
      sanitizationApplied,
      originalLength: text.length,
      cleanedLength: cleanText.length
    });
    
  } catch (err) {
    console.error('Audio generation error:', err);
    res.status(500).json({
      error: err.message,
    });
  }
});

// Endpoint to test sanitization (useful for debugging)
app.post('/test-sanitize', (req, res) => {
  try {
    const { text, lang = 'en' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'text is required' });
    }
    
    const sanitized = sanitizeDescription(text, lang);
    const isValid = isValidForTTS(sanitized);
    
    res.json({
      original: {
        text: text,
        length: text.length
      },
      sanitized: {
        text: sanitized,
        length: sanitized.length,
        isValid: isValid
      },
      changes: {
        charactersRemoved: text.length - sanitized.length,
        percentageRemoved: ((text.length - sanitized.length) / text.length * 100).toFixed(1),
        wasModified: text !== sanitized
      },
      language: lang
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint to get available voices for a language
app.get('/available-voices/:lang', (req, res) => {
  const { lang } = req.params;
  
  if (!VOICE_OPTIONS[lang]) {
    return res.status(400).json({
      error: 'Unsupported language',
      supported: Object.keys(VOICE_OPTIONS)
    });
  }
  
  const voices = VOICE_OPTIONS[lang].map(voiceName => ({
    name: voiceName,
    description: voiceName.replace(/-/g, ' ').replace(/Standard/g, ''),
    gender: voiceName.includes('Female') ? 'Female' : 'Male',
    language: lang,
  }));
  
  res.json({
    language: lang,
    voices: voices,
    default: DEFAULT_VOICE[lang]
  });
});

// Generate audio for multiple languages at once
app.post('/generate-all-audio', async (req, res) => {
  try {
    const { artifactId, descriptions, voiceName, speakingRate, skipSanitize } = req.body;
    
    if (!artifactId || !descriptions) {
      return res.status(400).json({
        error: 'artifactId and descriptions are required'
      });
    }
    
    const results = {};
    const errors = [];
    
    for (const [lang, text] of Object.entries(descriptions)) {
      if (!text || typeof text !== 'string' || !text.trim()) continue;
      
      try {
        const response = await fetch(`http://localhost:${PORT}/generate-audio`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artifactId,
            text,
            lang,
            voiceName,
            speakingRate,
            skipSanitize
          })
        });
        
        const result = await response.json();
        results[lang] = result;
        
        if (!result.success) {
          errors.push({ language: lang, error: result.error });
        }
      } catch (err) {
        errors.push({ language: lang, error: err.message });
        results[lang] = { success: false, error: err.message };
      }
    }
    
    res.json({
      success: errors.length === 0,
      results,
      errors: errors.length > 0 ? errors : undefined
    });
    
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n Server running on port ${PORT}`);
  console.log('\n Available endpoints:');
  console.log('  POST   /generate-audio        - Generate audio (auto-sanitizes descriptions)');
  console.log('  POST   /test-sanitize         - Test sanitization on text');
  console.log('  GET    /available-voices/:lang - Get available voices');
  console.log('  POST   /generate-all-audio    - Generate all languages');
  console.log('\ Description Sanitization Features:');
  console.log('  • Removes HTML/XML tags');
  console.log('  • Strips URLs and emails');
  console.log('  • Removes markdown formatting');
  console.log('  • Language-specific character cleaning');
  console.log('  • Fixes punctuation spacing');
  console.log('  • Capitalizes sentences');
  console.log('  • Limits length (5000 chars)');
  console.log('  • Validates TTS suitability\n');
});