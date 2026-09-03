import '../src/adapters/google-calendar.css';
import '../src/core/aliases.js';
import '../src/core/storage.js';
import '../src/core/resolver.js';
import '../src/adapters/adapter.js';
import '../src/adapters/google-calendar.js';
import '../src/content.js';

export default defineContentScript({
  matches: ['https://calendar.google.com/*'],
  runAt: 'document_idle',

  main() {
    return globalThis.AliasBuddy.content.start();
  }
});
