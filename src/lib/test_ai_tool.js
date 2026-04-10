import { detectCardType, CARD_TYPES } from './cardTypeDetection.js';
import { deriveTaskDisplayTitle, deriveTaskDisplaySubtitle } from './taskDisplayUtils.js';

console.log('🚀 Starting AI Tool Verification Tests...\n');

const testLinks = [
  'https://chatgpt.com/c/1234-5678',
  'https://gemini.google.com/app',
  'https://claude.ai/chat/123',
  'https://perplexity.ai/search',
  'https://example.com',
];

testLinks.forEach((url) => {
  const detectedType = detectCardType(url);
  console.log(`URL: ${url}`);
  console.log(`Detected Type: ${detectedType}`);
  
  const mockTask = {
    cardType: detectedType,
    primaryUrl: url,
    text: url, // Fallback if no title
  };

  const title = deriveTaskDisplayTitle(mockTask);
  const subtitle = deriveTaskDisplaySubtitle(mockTask);
  
  console.log(`UI Title: ${title}`);
  console.log(`UI Subtitle: ${subtitle}`);
  console.log('-------------------');
});

console.log('✅ Verification Completed!');
