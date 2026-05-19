# Epocha

An AI-powered timeline generator built with React, Express, and Claude Opus 4.7.

## Setup

1. **Install dependencies:**
   ```
   npm install
   cd server && npm install
   cd ../client && npm install
   ```

2. **Set your API key** — create a `.env` file in `server/`:
   ```
   ANTHROPIC_API_KEY=your_key_here
   ```

## Development

Run both client (Vite, port 5173) and server (Express, port 3001) concurrently:

```
npm run dev
```

Then open http://localhost:5173

## Production

```
npm run build   # builds client into client/dist
npm start       # starts Express server on port 3001, serves the built client
```
