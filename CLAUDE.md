# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Voice Recorder PWA** - A Progressive Web App for recording audio with AI-powered transcription using OpenAI Whisper API. Built as an alternative to React Native to avoid the $99/year Apple Developer Program cost while still providing a native-like app experience on iPhone.

### Key Features
- Record audio using browser MediaRecorder API
- Store recordings locally in IndexedDB (with audio Blob data + metadata)
- Play/pause audio playback
- Transcribe recordings using OpenAI Whisper API (~$0.006/minute, pay-as-you-go)
- Share audio files or transcripts (Web Share API with download fallback)
- Delete recordings
- PWA capabilities: installable to home screen, works offline (except transcription)

### Cost Structure
- OpenAI API: Pay-as-you-go transcription only (~$0.006/minute)
- Vercel Hosting: Free tier
- **Total recurring cost: $0** (only pay for transcription usage)

## Technology Stack

- **React 18** with TypeScript
- **Vite 7.3.1** - Fast build tool and dev server
- **MediaRecorder API** - Browser native audio recording
- **Web Audio API / HTML5 Audio** - Audio playback
- **IndexedDB** (via `idb` library) - Local storage for audio files and metadata
- **vite-plugin-pwa** - Service worker and PWA manifest generation
- **OpenAI Whisper API** - Audio transcription
- **Web Share API** - Native sharing on mobile devices

## Project Structure

```
VoiceRecorderWeb/
├── public/
│   └── icon.svg                       # App icon (placeholder)
├── src/
│   ├── components/
│   │   ├── RecorderView.tsx           # Main recording interface
│   │   └── RecordingsList.tsx         # List of saved recordings
│   ├── services/
│   │   ├── AudioRecorderService.ts    # MediaRecorder wrapper
│   │   ├── AudioPlayerService.ts      # HTML5 Audio wrapper
│   │   ├── StorageService.ts          # IndexedDB for recordings
│   │   └── TranscriptionService.ts    # OpenAI Whisper API client
│   ├── types/
│   │   └── Recording.ts               # TypeScript type definitions
│   ├── App.tsx                        # Main app with navigation
│   ├── App.css                        # Styling (iOS-like design)
│   └── main.tsx                       # Entry point
├── .env                               # Local env vars (DO NOT COMMIT)
├── .env.example                       # Env var template
├── vite.config.ts                     # Vite + PWA plugin config
└── package.json
```

## Development Commands

### Local Development
```bash
npm install              # Install dependencies
npm run dev              # Start dev server (localhost:5173)
npm run dev -- --host    # Expose to network for iPhone testing
npm run build            # Build for production
npm run preview          # Preview production build locally
```

### Deployment
```bash
npm run build            # Build first
npx vercel               # Deploy to Vercel (preview)
npx vercel --prod        # Deploy to production
```

## Architecture & Key Implementation Details

### Service Layer Pattern
All external APIs and browser APIs are wrapped in service classes for better testability and separation of concerns.

### AudioRecorderService
- Uses browser's `MediaRecorder` API
- Auto-detects best audio format (webm/mp4/ogg) based on browser support
- Important: Returns `Blob` instead of file URI (web vs native difference)
- Timer tracking with `getDuration()` method

### StorageService (IndexedDB)
- Database: `VoiceRecorderDB`
- Store: `recordings` (with `by-date` index)
- Stores both metadata AND audio Blob data together
- Important: Revokes Blob URLs on deletion to prevent memory leaks
- Methods: `saveRecording()`, `getAllRecordings()`, `updateRecording()`, `deleteRecording()`

### TranscriptionService
- OpenAI Whisper API endpoint: `https://api.openai.com/v1/audio/transcriptions`
- Accepts `Blob` directly (not file URI)
- Auto-determines file extension from Blob MIME type
- Returns verbose JSON format with segments

### AudioPlayerService
- Uses HTML5 `Audio` element
- Implements play/pause/stop functionality
- Auto-cleanup on playback completion

### Type Imports (Important!)
Due to `verbatimModuleSyntax: true` in tsconfig, use:
```typescript
import type { Recording, TranscriptionResult } from '../types/Recording';
```
NOT:
```typescript
import { Recording } from '../types/Recording';  // Will cause runtime errors!
```

### Navigation
Simple state-based navigation (no React Router needed):
- `currentView` state toggles between `'recorder'` and `'list'`
- Callbacks passed as props: `onNavigateToList`, `onNavigateBack`

## Environment Variables

### Local Development (.env)
```
VITE_OPENAI_API_KEY=sk-proj-...
```

### Vercel Production
Set in Vercel Dashboard → Project Settings → Environment Variables:
- Key: `VITE_OPENAI_API_KEY`
- Value: Your OpenAI API key
- Environment: Production

**Critical:** Vite requires the `VITE_` prefix for environment variables to be exposed to the client.

## PWA Configuration

### Manifest (vite.config.ts)
- Name: "Voice Recorder"
- Theme color: `#007AFF` (iOS blue)
- Display: `standalone` (hides browser UI)
- Orientation: `portrait`

### Service Worker
- Strategy: `generateSW` (auto-generated by Workbox)
- Caches: All static assets (js, css, html, svg)
- OpenAI API: Network-only (no caching)

### iOS Specific
- Meta tags in `index.html` for iOS PWA support
- Safe area handling in CSS for iPhone notch
- Requires HTTPS for microphone access (except localhost)

## Testing

### Desktop Browser Testing
```bash
npm run dev
```
Open http://localhost:5173

### iPhone Safari Testing (Local Network)
```bash
npm run dev -- --host
```
Note the Network URL (e.g., `http://192.168.1.163:5173`)

**Important:** Microphone access requires HTTPS. Local network testing with HTTP will fail on iOS. Deploy to Vercel for full testing.

### Production Testing
1. Deploy to Vercel
2. Access production URL on iPhone Safari
3. Test all features
4. Add to Home Screen: Safari → Share → Add to Home Screen
5. Open from home screen (should run without browser UI)

## Known Issues & Limitations

### Audio Format
- Browser-dependent audio format (webm on Chrome/Firefox, mp4 on Safari)
- All formats supported by OpenAI Whisper API

### Microphone Access
- **iOS Safari requires HTTPS** for microphone access
- Local network testing (HTTP) will fail on iPhone
- Always test production deployment for full functionality

### Share Functionality
- Web Share API support varies by browser
- Fallback: Downloads file if sharing not supported
- File sharing may not work on all desktop browsers (download fallback activates)

### Offline Limitations
- Transcription requires internet (OpenAI API call)
- Recording and playback work offline
- Recordings stored locally in IndexedDB (survives page refresh)

## Debugging Tips

### TypeScript Errors
- Check for proper `import type` usage (not `import` for types)
- `verbatimModuleSyntax: true` requires strict type/value separation

### Microphone Not Working
1. Check browser console for errors
2. Verify HTTPS is being used (not HTTP)
3. Check browser permissions (Settings → Site Settings)
4. Ensure MediaRecorder API is supported (check `navigator.mediaDevices`)

### Transcription Errors
1. Verify OpenAI API key is set correctly
2. Check Vercel environment variables (must have `VITE_` prefix)
3. Verify API credits are available
4. Check browser console for network errors

### Build Errors
```bash
npm run build 2>&1  # Check TypeScript errors
```

## Cost Optimization

### Current Setup (Optimal)
- Vercel Free Tier: Sufficient for personal use
- OpenAI Whisper: Only pay for what you use (~$0.006/minute)
- No monthly/annual subscriptions

### If Costs Increase
- Consider free alternative transcription APIs
- Implement client-side transcription (Web Speech API - less accurate)
- Add usage tracking/limits

## Future Enhancements (Optional)

- [ ] Add pause/resume for recordings
- [ ] Implement editing/trimming of recordings
- [ ] Add export as different formats
- [ ] Multiple language support for transcription
- [ ] Folders/tags for organization
- [ ] Search/filter recordings
- [ ] Cloud sync (Firebase/Supabase)
- [ ] Better icons (current: placeholder SVG)

## Security Notes

- API key is exposed to client (acceptable for personal use)
- For multi-user app: Move API calls to backend/serverless function
- Never commit `.env` file to git (.gitignore includes it)

## Support & Documentation

- Vite Docs: https://vitejs.dev
- Vite PWA Plugin: https://vite-pwa-org.netlify.app
- OpenAI Whisper API: https://platform.openai.com/docs/api-reference/audio
- IndexedDB via idb: https://github.com/jakearchibald/idb
- Vercel Deployment: https://vercel.com/docs
