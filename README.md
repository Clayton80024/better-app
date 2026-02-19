# better-app

A real-time todo app with authentication, built with Next.js and [InstantDB](https://instantdb.com).

## Features

- **Auth** – Magic code (email) sign-in
- **Profiles** – Unique @username, display name, and DiceBear avatar selection on signup
- **Todos** – Per-user todo list with real-time sync
- **Cases** – Immigration case management with document upload (B2, Mindee extraction, OpenAI classification)

## Setup

1. **Install dependencies** (already done):
   ```bash
   npm install
   ```

2. **Connect to InstantDB** – Run the init command and follow the prompts to log in and create/link your app:
   ```bash
   npx instant-cli init
   ```
   This will:
   - Log you in to InstantDB (opens browser)
   - Create or link an app
   - Add `NEXT_PUBLIC_INSTANT_APP_ID` to `.env.local`

3. **Push the schema and permissions**:
   ```bash
   npx instant-cli push schema
   npx instant-cli push perms
   ```

4. **Username availability check** (optional): Add `INSTANT_APP_ADMIN_TOKEN` to `.env.local` for real-time username availability. Get it from [InstantDB dashboard](https://instantdb.com/dash) → Settings → Admin token. Without it, users can still sign up; duplicate usernames will be caught on submit.

5. **Case document upload** (optional, for Cases feature): For uploading and classifying documents on cases:
   - **Backblaze B2**: Add `B2_APPLICATION_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_NAME`, `B2_ENDPOINT` (e.g. `s3.us-west-002.backblazeb2.com`)
   - **Mindee**: Add `MINDEE_API_KEY` for document extraction (passport, ID, proof of address)
   - **OpenAI**: Add `OPENAI_API_KEY` for document classification
   - Without these, document upload will fail; the rest of the app works.

6. **Start the dev server**:
   ```bash
   npm run dev
   ```

Open [http://localhost:3000](http://localhost:3000) to use the app.

## Tech Stack

- **Next.js 16** – React framework
- **InstantDB** – Real-time backend with auth
- **DiceBear** – Avatar generation
- **Tailwind CSS** – Styling
