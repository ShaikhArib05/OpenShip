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

Always start the backend with the project's virtualenv (`.venv\Scripts\python -m uvicorn app.main:app --reload`),
not a globally installed `uvicorn`. A global install can have older library versions and fail intermittently.

`SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` live only in the backend `.env`. The browser only gets the anon key.
Leaving `GEMINI_API_KEY` empty disables AI features (buttons are greyed out); the rest of the app still works.
AI output is only ever a suggestion: you review and approve it before anything is saved. If the main model is overloaded the
backend retries and then tries the models in `GEMINI_FALLBACK_MODELS`. Live check: `python -m scripts.smoke_ai` (uses quota).

## Status

- [x] Stage 1: repo, schema with RLS, FastAPI skeleton (auth verification, workspaces/invites, tests)
- [x] Stage 2: frontend auth + workspace UI
- [x] Stage 3: projects and dashboard
- [x] Stage 4: tasks and Kanban board
- [x] Stage 5: filters, search, comments with @mentions, task activity
- [x] Stage 6: backlog and sprints
- [x] Stage 7: notifications and project analytics (burndown)
- [x] Stage 8: Gemini AI assistant (task generator, breakdown, priorities, sprint planner, summary)
- [ ] Stages 9-10: polish, deploy
