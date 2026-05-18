# Frontend

React/Vite customer experience for I Love Great Epic Mahabharat.

## Highlights

- Storefront, product detail pages, protected collection, profile, support, and admin surfaces.
- AI support chat with visible model, retrieval, tool, and cache metadata.
- Firebase-authenticated flows for purchases, support, notifications, and profile data.
- Lazy-loaded routes, error boundary, responsive navigation, and production build config.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Key Files

- `src/pages/Explore.tsx`: homepage/storefront composition.
- `src/components/AIEngineeringShowcase.tsx`: AI system story on the product surface.
- `src/components/ChatInterface.tsx`: support assistant experience.
- `src/services/chat.ts`: typed client for the FastAPI chat endpoint.
- `src/contexts/FirebaseContext.tsx`: authentication and user session provider.
