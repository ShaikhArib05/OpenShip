# OpenShip

AI-Powered Project Management, Simplified.

Stack: Next.js (React, TypeScript, Tailwind, shadcn/ui) · FastAPI · Supabase (Postgres + Auth) · Gemini.

## Setup

1. **Supabase**: create a project, then run `supabase/migrations/0001_init.sql` in the SQL editor.
2. **Backend**
   ```
   cd backend
   python -m venv .venv && .venv\Scripts\activate   # source .venv/bin/activate on macOS/Linux
   pip install -r requirements.txt
   copy .env.example .env                            # fill in values
   uvicorn app.main:app --reload
   pytest
   ```
3. **Frontend**
   ```
   cd frontend
   npm install
   copy .env.example .env.local                      # fill in values
   npm run dev
   ```

`SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` live only in the backend `.env`. The browser only gets the anon key.
Leaving `GEMINI_API_KEY` empty disables AI features; the rest of the app still works.

## Status

- [x] Stage 1: repo, schema with RLS, FastAPI skeleton (auth verification, workspaces/invites, tests)
- [x] Stage 2: frontend auth + workspace UI
- [x] Stage 3: projects and dashboard
- [x] Stage 4: tasks and Kanban board
- [x] Stage 5: filters, search, comments with @mentions, task activity
- [ ] Stages 6-10: sprints, notifications/analytics, AI, polish, deploy
