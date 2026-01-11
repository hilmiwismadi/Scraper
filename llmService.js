import { Ollama } from 'ollama';
import dotenv from 'dotenv';

dotenv.config();

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma2:9b';
const ENABLE_LLM = process.env.ENABLE_LLM === 'true';

// Initialize Ollama client
const ollama = new Ollama({ host: OLLAMA_HOST });

/**
 * Parse Instagram caption using local LLM to extract structured data
 * This replaces the regex-based parsing with intelligent extraction
 */
async function parseCaptionWithLLM(caption) {
  if (!caption || !ENABLE_LLM) {
    return {
      eventTitle: null,
      eventOrganizer: null,
      phoneNumbers: [],
      eventDate: null,
      eventLocation: null,
      registrationFee: null,
      contactPersons: [],
      extractedBy: 'regex'
    };
  }

  try {
    console.log('[LLM] Starting caption analysis...');

    const prompt = buildExtractionPrompt(caption);

    const response = await ollama.chat({
      model: OLLAMA_MODEL,
      messages: [
        {
          role: 'system',
          content: getSystemPrompt()
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      format: 'json',
      options: {
        temperature: 0.1, // Low temperature for consistent extraction
        top_p: 0.9,
        num_ctx: 4096 // Context window size
      }
    });

    const result = parseLLMResponse(response);
    console.log('[LLM] Extraction completed:', JSON.stringify(result, null, 2));
    return result;

  } catch (error) {
    console.error('[LLM] Error during caption analysis:', error.message);
    // Return empty result on error, allowing fallback to regex
    return {
      eventTitle: null,
      eventOrganizer: null,
      phoneNumbers: [],
      eventDate: null,
      eventLocation: null,
      registrationFee: null,
      contactPersons: [],
      error: error.message,
      extractedBy: 'error'
    };
  }
}

/**
 * System prompt for the LLM
 */
function getSystemPrompt() {
  return `You are an expert data extraction assistant specializing in Indonesian Instagram event posts.
Your task is to extract structured information from Instagram captions about events, competitions, and announcements.

IMPORTANT RULES:
1. Return ONLY valid JSON - no markdown, no code blocks, no explanations
2. Extract phone numbers in Indonesian format (08xx, 62xxx, +62xxx)
3. Identify event titles (usually first line or contains keywords like "lomba", "competition", "event", "open")
4. Find contact persons (names followed by phone numbers or marked as "CP", "contact", "narahubung")
5. Extract dates in any format (Indonesian or standard)
6. Identify locations mentioned
7. Extract registration fees if mentioned
8. If a field cannot be found, return null

JSON Structure to return:
{
  "eventTitle": "string or null",
  "eventOrganizer": "string or null",
  "phoneNumbers": ["array of phone number strings"],
  "eventDate": "string or null",
  "eventLocation": "string or null",
  "registrationFee": "string or null",
  "contactPersons": ["array of names"]
}`;
}

/**
 * Build the user prompt for extraction
 */
function buildExtractionPrompt(caption) {
  return `Extract structured data from the following Instagram caption. Return ONLY valid JSON:

${caption}

Return JSON with this structure:
{
  "eventTitle": "event name or null",
  "eventOrganizer": "organizer name or null",
  "phoneNumbers": ["list of all phone numbers found"],
  "eventDate": "event date or null",
  "eventLocation": "event location or null",
  "registrationFee": "fee amount or null",
  "contactPersons": ["list of contact person names"]
}`;
}

/**
 * Parse and validate LLM response
 */
function parseLLMResponse(response) {
  try {
    let content = response.message.content;

    // Clean up the response - remove markdown code blocks if present
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Parse JSON
    const parsed = JSON.parse(content);

    // Validate and normalize the response
    return {
      eventTitle: parsed.eventTitle || null,
      eventOrganizer: parsed.eventOrganizer || null,
      phoneNumbers: Array.isArray(parsed.phoneNumbers) ? parsed.phoneNumbers : [],
      eventDate: parsed.eventDate || null,
      eventLocation: parsed.eventLocation || null,
      registrationFee: parsed.registrationFee || null,
      contactPersons: Array.isArray(parsed.contactPersons) ? parsed.contactPersons : [],
      extractedBy: 'llm'
    };
  } catch (error) {
    console.error('[LLM] Failed to parse response as JSON:', error.message);
    console.error('[LLM] Raw response:', response.message.content);
    throw new Error('Failed to parse LLM response as JSON');
  }
}

/**
 * Check if Ollama service is available
 */
async function checkOllamaAvailable() {
  if (!ENABLE_LLM) {
    return { available: false, reason: 'LLM disabled in environment' };
  }

  try {
    const tags = await ollama.list();
    const modelAvailable = tags.models.some(m =>
      m.name.includes(OLLAMA_MODEL.split(':')[0])
    );
    return {
      available: modelAvailable,
      reason: modelAvailable ? null : `Model ${OLLAMA_MODEL} not found`
    };
  } catch (error) {
    return {
      available: false,
      reason: `Ollama not reachable: ${error.message}`
    };
  }
}

/**
 * Get available models from Ollama
 */
async function getAvailableModels() {
  try {
    const tags = await ollama.list();
    return tags.models.map(m => m.name);
  } catch (error) {
    return [];
  }
}

export {
  parseCaptionWithLLM,
  checkOllamaAvailable,
  getAvailableModels,
  ENABLE_LLM,
  OLLAMA_MODEL
};

export default {
  parseCaptionWithLLM,
  checkOllamaAvailable,
  getAvailableModels
};
