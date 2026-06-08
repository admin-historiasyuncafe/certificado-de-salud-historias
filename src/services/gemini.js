import { GoogleGenerativeAI } from "@google/generative-ai";

// ─── Blob → generative part ────────────────────────────────────────────────────
function blobToGenerativePart(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: blob.type || 'image/jpeg',
        },
      });
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(blob);
  });
}

// ─── OCR Prompt ────────────────────────────────────────────────────────────────
const promptText = `
You are an expert OCR (Optical Character Recognition) engine specialised in extracting data from employee health certificates and medical clearance documents. The documents may be in Spanish or English.

YOUR ONLY SOURCE OF TRUTH IS THE TEXT VISIBLE IN THE IMAGE. You must NEVER infer, guess, or use the file name. If you cannot find a value in the image, return null for that field.

━━━ FIELD EXTRACTION RULES ━━━

1. employeeName
   • Scan every line of the document for labels such as:
     "NOMBRE:", "Nombre:", "NOMBRE COMPLETO:", "PACIENTE:", "Paciente:",
     "TRABAJADOR:", "Trabajador:", "Employee Name:", "Patient:", "Empleado:"
   • The employee name is the text that appears IMMEDIATELY AFTER one of those labels on the same line or the next line.
   • Example: "NOMBRE: Juan del Pueblo" → employeeName = "Juan del Pueblo"
   • Example: "Paciente:\n  María García López" → employeeName = "María García López"
   • WARNING: The filename is NOT the employee name. Ignore it completely.
   • If no such label exists, return null.

2. issueDate
   • Find labels such as:
     "IMPRESO:", "FECHA EXPEDICION:", "FECHA EMISION:", "FECHA DE EXPEDICION:",
     "FECHA:", "FECHA DE EMISION:", "F. PAGO:", "Issued:", "Date:"
   • Convert Spanish month names to numbers:
     enero→01, febrero→02, marzo→03, abril→04, mayo→05, junio→06,
     julio→07, agosto→08, septiembre→09, octubre→10, noviembre→11, diciembre→12
   • Return in strict ISO format: YYYY-MM-DD
   • Example: "14 de enero de 2025" → "2025-01-14"

3. expirationDate
   • Find labels such as:
     "VENCE EL:", "ESTE CERTIFICADO VENCE EL:", "FECHA DE VENCIMIENTO:",
     "VENCIMIENTO:", "FECHA VENCIMIENTO:", "Expires:", "Expiration Date:",
     "Válido hasta:", "VALIDO HASTA:"
   • Convert Spanish months exactly like issueDate.
   • Return in strict ISO format: YYYY-MM-DD
   • If no expiration label is found, return null.

━━━ RESPONSE FORMAT ━━━
Return ONLY a raw JSON object — no markdown, no code fences, no extra text:
{
  "employeeName": "string or null",
  "issueDate": "YYYY-MM-DD or null",
  "expirationDate": "YYYY-MM-DD or null",
  "confidenceScore": <number 0-1>,
  "extractedText": "<short summary of what you read from the document>"
}
`;

// ─── Model fallback chain ──────────────────────────────────────────────────────
// Each model has its own INDEPENDENT free-tier quota on Google AI.
// If one is overloaded (503), rate-limited (429), or not found (404), we fall through.
const MODEL_CHAIN = [
  "gemini-2.5-flash",        // latest, fastest — try first
  "gemini-2.0-flash",        // stable, widely available
  "gemini-2.0-flash-lite",   // lighter quota limits
  "gemini-1.5-flash-8b",     // smallest/cheapest — highest chance of having quota
];

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * Classify an error as "try next model" vs. "fatal" (bad API key, etc.)
 *
 * 503 = server overload         → retry same model, then try next
 * 429 = quota exhausted          → try next model (different quota bucket)
 * 404 = model not found/removed  → try next model in chain
 */
function isCapacityError(err) {
  const msg = err.message || '';
  return (
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('404') ||
    msg.toLowerCase().includes('overload') ||
    msg.toLowerCase().includes('high demand') ||
    msg.toLowerCase().includes('quota') ||
    msg.toLowerCase().includes('rate limit') ||
    msg.toLowerCase().includes('not found for api version') ||
    msg.toLowerCase().includes('retry')
  );
}

/**
 * Parse the retry delay (in seconds) that Google returns inside the 429 body.
 * Falls back to `defaultMs` if we can't find it.
 */
function parseRetryDelay(err, defaultMs = 7000) {
  try {
    const match = (err.message || '').match(/"retryDelay"\s*:\s*"(\d+)s"/);
    if (match) return (parseInt(match[1], 10) + 1) * 1000; // add 1s buffer
  } catch (_) { /* ignore */ }
  return defaultMs;
}

/**
 * Attempt one model, retrying within it on 503 (transient overload),
 * but surfacing 429 immediately so the outer loop can switch models.
 */
async function tryModel(genAI, modelName, imagePart) {
  const model = genAI.getGenerativeModel({ model: modelName });
  const MAX_INNER_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_INNER_RETRIES; attempt++) {
    try {
      console.log(`[Gemini] "${modelName}" — attempt ${attempt + 1}`);
      const result = await model.generateContent([promptText, imagePart]);
      const text = result.response.text();
      console.log(`[Gemini] "${modelName}" succeeded:`, text.slice(0, 120));
      return text;
    } catch (err) {
      const msg = err.message || '';
      const is503 = msg.includes('503') || msg.toLowerCase().includes('high demand') || msg.toLowerCase().includes('overload');
      const is429 = msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate limit');

      if (is503 && attempt < MAX_INNER_RETRIES) {
        // Transient server overload — retry the SAME model after a short wait
        const wait = 1500 * Math.pow(2, attempt);
        console.warn(`[Gemini] "${modelName}" 503. Retrying in ${wait}ms…`);
        await sleep(wait);
        continue;
      }

      if (is429) {
        // Quota exhausted on this model — don't retry, let outer loop pick next model
        console.warn(`[Gemini] "${modelName}" quota exceeded (429). Moving to next model.`);
        throw err;
      }

      // Any other error (bad key, malformed request, etc.) — re-throw immediately
      throw err;
    }
  }
}

/**
 * Clean up the raw text response into a parsed JSON object.
 */
function parseModelResponse(raw) {
  let text = raw.trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();
  return JSON.parse(text);
}

// ─── Public API ────────────────────────────────────────────────────────────────
export async function analyzeCertificate(fileBlob, apiKey) {
  if (!apiKey || apiKey.trim() === '') {
    return mockAnalysis(fileBlob);
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const imagePart = await blobToGenerativePart(fileBlob);

  let lastError = null;
  let lastWasCapacity = false;

  for (const modelName of MODEL_CHAIN) {
    try {
      const rawText = await tryModel(genAI, modelName, imagePart);
      return parseModelResponse(rawText);
    } catch (err) {
      lastError = err;
      lastWasCapacity = isCapacityError(err);

      if (lastWasCapacity) {
        // If Google told us to wait before retrying (from the 429 body), respect it
        const waitMs = parseRetryDelay(err, 2000);
        console.warn(`[Gemini] Switching from "${modelName}" → next model. Waiting ${waitMs}ms first…`);
        await sleep(waitMs);
        continue; // try next model in chain
      }

      // Fatal error (invalid key, bad mime type, etc.) — stop immediately
      console.error('[Gemini] Fatal error:', err);
      throw new Error(
        `AI Extraction failed: ${err.message}. Please verify your API key.`
      );
    }
  }

  // Every model in the chain was quota-limited
  console.error('[Gemini] All models exhausted. Last error:', lastError);
  throw new Error(
    `All Gemini models are currently rate-limited on the free tier. ` +
    `Please wait 1–2 minutes and try again, or upgrade your Google AI plan at https://ai.dev/rate-limit. ` +
    `(Last error: ${lastError?.message ?? 'unknown'})`
  );
}

// ─── Mock fallback (no API key) ────────────────────────────────────────────────
function mockAnalysis(_fileBlob) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const today = new Date();
      const issueDate = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      const expirationDate = new Date(issueDate.getTime() + 365 * 24 * 60 * 60 * 1000);
      resolve({
        employeeName: 'Jane Smith',
        issueDate: issueDate.toISOString().split('T')[0],
        expirationDate: expirationDate.toISOString().split('T')[0],
        confidenceScore: 0.92,
        extractedText:
          'Mock OCR: Standard health certificate. Employee cleared for work. Expiration set per 1-year policy.',
      });
    }, 1200);
  });
}
