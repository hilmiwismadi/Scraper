import llmService from './llmService.js';
import dotenv from 'dotenv';

dotenv.config();

// Sample Instagram caption for testing
const sampleCaption = `🏆 OLIMPIADE MALHIKDUA (OMADA) X 🏆

Olimpiade Malhikdua kembali lagi!🔥

Mari uji kemampuan dan kreativitas kalian di berbagai cabang lomba!

📅 TANGGAL: 25-27 Januari 2026
📍 TEMPAT: SMA Malhikdua, Kediri

📝 CABANG LOMBA:
1. Lomba Karya Tulis Ilmiah
2. Lomba Poster
3. Lomba Pidato Bahasa Indonesia
4. Lomba Pidato Bahasa Arab
5. Lomba Puisi
6. Lomba Kaligrafi
7. Lomba MHQ (Musabaqah Hifdzil Quran)

📊 HARGA PENDAFTARAN:
- Gelombang 1 (1-10 Januari): Rp 50.000
- Gelombang 2 (11-20 Januari): Rp 65.000
- Gelombang 3 (21-24 Januari): Rp 75.000

📲 CONTACT PERSON:
- Rida: 0858-1194-0388
- Zulfa: 0814-1018-2834

Link pendaftaran: bit.ly/omadaxregistration

Ayoo daftarkan diri kalian dan raih prestasimu! 🏆

#OMADAX #OlimpiadeMalhikdua #KompetisiSiswa #Lomba #EventPelajar`;

async function testLLMService() {
  console.log('=== LLM Service Test ===\n');

  // Check if Ollama is available
  console.log('1. Checking Ollama availability...');
  const checkResult = await llmService.checkOllamaAvailable();
  console.log('   Available:', checkResult.available);
  if (!checkResult.available) {
    console.log('   Reason:', checkResult.reason);
    console.log('\n⚠️ Ollama is not available. Please make sure:');
    console.log('   - Ollama is installed and running');
    console.log('   - The model is downloaded (run: ollama pull gemma2:9b)');
    console.log('   - ENABLE_LLM=true in .env file\n');
    return;
  }
  console.log('   ✓ Ollama is available\n');

  // Get available models
  console.log('2. Getting available models...');
  const models = await llmService.getAvailableModels();
  console.log('   Available models:', models.join(', '));
  console.log('   Using model:', process.env.OLLAMA_MODEL || 'gemma2:9b');
  console.log('');

  // Test caption parsing
  console.log('3. Testing caption parsing...');
  console.log('   Sample caption (first 200 chars):', sampleCaption.substring(0, 200) + '...\n');

  try {
    const result = await llmService.parseCaptionWithLLM(sampleCaption);

    console.log('   ✓ Parsing completed!\n');
    console.log('   RESULTS:');
    console.log('   --------');
    console.log('   Event Title:', result.eventTitle || 'N/A');
    console.log('   Event Organizer:', result.eventOrganizer || 'N/A');
    console.log('   Event Date:', result.eventDate || 'N/A');
    console.log('   Event Location:', result.eventLocation || 'N/A');
    console.log('   Registration Fee:', result.registrationFee || 'N/A');
    console.log('   Phone Numbers:', result.phoneNumbers.length > 0 ? result.phoneNumbers.join(', ') : 'None');
    console.log('   Contact Persons:', result.contactPersons.length > 0 ? result.contactPersons.join(', ') : 'None');
    console.log('   Extracted By:', result.extractedBy);
    console.log('');

    // Verify results
    const hasRequiredFields = result.eventTitle && result.phoneNumbers.length > 0;
    if (hasRequiredFields) {
      console.log('   ✅ TEST PASSED! LLM successfully extracted key information.');
    } else {
      console.log('   ⚠️  TEST WARNING! Some key fields were not extracted.');
    }
  } catch (error) {
    console.error('   ✗ TEST FAILED:', error.message);
  }

  console.log('\n=== Test Complete ===');
}

// Run the test
testLLMService().catch(console.error);
