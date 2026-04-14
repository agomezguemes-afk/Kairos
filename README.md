This App is under development, its final result cannot be determined yet. For any inquiries/suggestions you can contact me throught my email agomezguemes@gmail.com

## Kai (AI assistant) setup

Kai uses [Groq](https://console.groq.com) for free, low-latency inference over Llama 3. No credit card required.

1. Sign up at https://console.groq.com and create an API key.
2. Copy `.env.example` to `.env` in the project root.
3. Paste your key into `EXPO_PUBLIC_GROQ_API_KEY=`.
4. Restart the dev server: `npm start` (env vars are inlined at bundle time).

If the key is missing or Groq fails, Kai automatically falls back to the offline mock service so the chat never breaks.
