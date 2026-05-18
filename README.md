# I Love Great Epic Mahabharat

AI-assisted commerce and support platform for a digital Mahabharat content store.

This project is built to show full-stack product engineering plus practical AI engineering: a React storefront, Firebase-authenticated user journeys, Firestore-backed purchases and tickets, and a FastAPI assistant that uses retrieval, tool calling, rate limiting, and operational status endpoints.

## Why This Is Interview Ready

- Real product surface: storefront, product detail pages, protected library, profile, support, admin workflows, coupons, notifications, and order management.
- AI assistant backend: OpenAI chat completion endpoint with conversation context, RAG-style policy retrieval, structured function calling, and support ticket creation.
- Production concerns: Firebase Auth, Firestore persistence, lazy-loaded frontend routes, error boundaries, backend rate limiting, security headers, Render/Vercel deployment config, and health checks.
- Clear demo path: ask the assistant about products, refunds, shipping, privacy, or an access issue; the assistant grounds the answer or escalates through a ticket workflow.

## Architecture

```text
React + Vite + TypeScript
        |
        | /support chat UI
        v
FastAPI AI Backend
        |
        | retrieves policy snippets
        v
company_policies_rag.txt
        |
        | OpenAI function call when support issue is complete
        v
Firestore tickets / users / orders / purchases
```

## AI Engineering Features

- Retrieval grounding: `backend/company_policies_rag.txt` is loaded at startup and searched for relevant policy sections per user query.
- Tool calling: the assistant calls `save_ticket` after collecting Instagram ID and issue details.
- Guarded caching: stable FAQ-style responses can be cached, while identity, memory, support, payment, and order questions are excluded.
- Observability surface: `/ai/status` reports model, knowledge base load state, retrieval mode, tools, and rate limit policy.
- Frontend trace UI: the support chat shows model, retrieval count, tool availability, and cache freshness after AI responses.

## Tech Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Framer Motion, React Router, React Query.
- Backend: FastAPI, Pydantic, OpenAI Python SDK, SlowAPI, Firebase Admin SDK.
- Data/Auth: Firebase Authentication and Firestore.
- Deployment: Vercel frontend config and Render backend config.

## Run Locally

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Set these environment variables for the full AI/Firebase flow:

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
FIREBASE_CREDENTIALS={...service account json...}
```

## Demo Script

1. Open the storefront and point out the protected customer journeys: products, collection, profile, support, and admin.
2. Open Support and ask: "What is your refund policy for digital products?"
3. Ask: "I paid but did not receive access."
4. Provide an Instagram ID when requested, then provide issue details.
5. Explain that the assistant moved from retrieval-grounded Q&A into function calling and Firestore ticket creation.
6. Open `/ai/status` on the backend to show model, knowledge base, tool calling, and rate-limit readiness.

## Important Files

- `frontend/src/components/AIEngineeringShowcase.tsx`: homepage AI engineering section.
- `frontend/src/components/ChatInterface.tsx`: assistant UI with trace metadata.
- `frontend/src/services/chat.ts`: typed chat client.
- `backend/main.py`: FastAPI assistant, retrieval, function calling, cache, health/status endpoints.
- `backend/company_policies_rag.txt`: business knowledge base used for grounded answers.

## Notes

The assistant is designed for support and commerce questions, not open-ended religious or legal advice. For unsupported business cases, it should keep the reply short and route the user to support.
