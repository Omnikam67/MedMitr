# Full Stack Deployment Guide

This project is a good fit for a split deployment:

- Frontend: Vercel
- Backend API + Socket.IO: Render web service
- MySQL database: Railway MySQL

This is the best balance for this repo because:

- the frontend is a Vite static app and already has Vercel config
- the backend already has a Render-ready `render.yaml` and `render-start.sh`
- the backend code is written for MySQL today, so using a hosted MySQL service avoids a risky database rewrite before launch

## Recommended Production Flow

1. Push the repo to GitHub.
2. Deploy the MySQL database on Railway.
3. Deploy the backend on Render and connect it to Railway MySQL.
4. Deploy the frontend on Vercel and point it to the Render backend URL.
5. Add custom domains only after everything works on the provider URLs.

## Before You Deploy

Do these first:

1. Rotate every secret currently present in [om-main/om-main/backend/.env](/c:/Users/hp/OneDrive/New%20folder/OneDrive/Desktop/om-main%20(2)/om-main/om-main/backend/.env).
2. Keep real secrets only in hosting dashboards, not in git-tracked files.
3. Make sure local `.env` files stay ignored by git.

Secrets that should be rotated before production:

- `GROQ_API_KEY`
- `GOOGLE_API_KEY`
- `LANGFUSE_SECRET_KEY`
- `LANGFUSE_PUBLIC_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- MySQL password values

## Railway MySQL

The backend already supports a single `DATABASE_URL`, which is the cleanest production setup.

1. Create a new Railway project.
2. Add a MySQL database service.
3. Copy either:
   - Railway's provided MySQL connection URL, if it is SQLAlchemy-compatible for `pymysql`, or
   - the host, port, user, password, and database fields
4. Use one of these backend setups on Render:

Preferred:

```env
DATABASE_URL=mysql+pymysql://USER:PASSWORD@HOST:PORT/DATABASE
```

Fallback:

```env
MYSQL_USER=...
MYSQL_PASSWORD=...
MYSQL_HOST=...
MYSQL_PORT=3306
MYSQL_DB=...
```

## Render Backend

Create a Render web service with these settings:

- Root directory: `om-main/om-main/backend`
- Build command: `pip install -r requirements.txt`
- Start command: `bash render-start.sh`

Important environment variables:

Required:

```env
DATABASE_URL=mysql+pymysql://USER:PASSWORD@HOST:PORT/DATABASE
SYSTEM_MANAGER_ID=sysmanager
SYSTEM_MANAGER_PASSWORD=choose-a-strong-password
ACCESS_TOKEN_SECRET=choose-a-separate-strong-secret
ALLOWED_ORIGINS=https://your-frontend.vercel.app
```

Optional feature flags and integrations:

```env
GROQ_API_KEY=
GROQ_CHAT_MODEL=llama-3.3-70b-versatile
GROQ_VISION_MODEL=
OPENAI_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=
LANGFUSE_PUBLIC_KEY=
LANGFUSE_SECRET_KEY=
LANGFUSE_HOST=
GOOGLE_API_KEY=
STARTUP_INDEX_PRODUCTS=false
PRODUCT_FILE=
```

Notes:

- `ALLOWED_ORIGINS` should contain your final frontend URL. For multiple URLs, use a comma-separated list.
- `ACCESS_TOKEN_SECRET` should not reuse the system manager password.
- `STARTUP_INDEX_PRODUCTS=false` is the safer default for small hosted instances.
- If `PRODUCT_FILE` points to a local Windows path, it will not work in cloud hosting. Upload the file into the repo or attach persistent storage before depending on it in production.

Useful backend health check:

- `GET /`

## Vercel Frontend

Create a Vercel project from this repo.

The repo already includes [vercel.json](/c:/Users/hp/OneDrive/New%20folder/OneDrive/Desktop/om-main%20(2)/vercel.json), so Vercel can build from the repo root while targeting the frontend app.

Set these frontend environment variables in Vercel:

```env
VITE_API_BASE_URL=https://your-backend.onrender.com
VITE_SOCKET_URL=https://your-backend.onrender.com
VITE_SYSTEM_MANAGER_ID=sysmanager
```

If you later add a custom backend domain, update both frontend URLs to that domain.

## Deployment Order

Deploy in this order to avoid broken environment links:

1. Railway MySQL
2. Render backend
3. Vercel frontend
4. Custom domains

## Post-Deploy Checks

After deploy, verify:

1. Frontend loads without blank screen.
2. Login calls go to the Render API URL, not localhost.
3. Backend root endpoint responds successfully.
4. CORS allows the Vercel domain.
5. Database writes persist after backend restart.
6. Socket.IO connects from the deployed frontend.

## Best Process For This Project

For your current codebase, this is the most practical production process:

- Keep frontend and backend as separate services.
- Keep MySQL instead of converting databases right before deployment.
- Use provider dashboards for secrets.
- Launch first on provider domains.
- Add custom domains only after the app works end to end.

If you want the simplest next step, deploy the backend first. Once Render is live and returning a real URL, the frontend deployment becomes straightforward.
