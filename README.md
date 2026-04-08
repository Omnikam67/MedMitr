# Pharma

This repository is now set up so Vercel can deploy the React frontend from the repo root.

## Vercel

Deploy this repository to Vercel and set these frontend environment variables in the Vercel project:

- `VITE_API_BASE_URL`
- `VITE_SOCKET_URL`
- `VITE_SYSTEM_MANAGER_ID`

Use your deployed backend URL for both `VITE_API_BASE_URL` and `VITE_SOCKET_URL`.

Important:

- The frontend is deployed from `om-main/om-main/frontend`
- The backend should be deployed separately because it uses FastAPI plus Socket.IO and is not a simple static Vercel frontend

## One-Click Flow

1. Import this Git repository into Vercel.
2. Keep the project root as the current repository root.
3. Add the environment variables listed above.
4. Deploy.

## Local Backend Run

To avoid the `numpy`/`pandas` binary mismatch from the global Python install, run the backend with the project virtual environment:

```powershell
cd ".\om-main\om-main\backend"
..\..\..\.venv\Scripts\python.exe -m uvicorn main:app --reload
```
