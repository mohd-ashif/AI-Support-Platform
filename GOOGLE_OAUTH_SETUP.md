# Google Cloud OAuth 2.0 Credentials Setup Guide

To enable Google OAuth 2.0 authentication for SupportAI, follow these manual steps to generate your Client ID and Client Secret in the Google Cloud Console.

---

## Step 1: Create or Select a Google Cloud Project

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Click on the project dropdown in the top navigation bar.
3. Click **New Project**, name it (e.g., `SupportAI-SaaS`), and click **Create**.

---

## Step 2: Configure the OAuth Consent Screen

1. In the left navigation menu, go to **APIs & Services** > **OAuth consent screen**.
2. Select **External** (or Internal if using Google Workspace) and click **Create**.
3. Fill in the required fields:
   - **App name**: `SupportAI`
   - **User support email**: Your support email address
   - **Developer contact information**: Your email address
4. Click **Save and Continue**.
5. On the **Scopes** page, click **Add or Remove Scopes** and select:
   - `.../auth/userinfo.email`
   - `.../auth/userinfo.profile`
   - `openid`
6. Click **Update** > **Save and Continue**.
7. On the **Test users** page, add your email address so you can test logging in while in testing mode.

---

## Step 3: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** > **Credentials**.
2. Click **+ Create Credentials** at the top and select **OAuth client ID**.
3. Set **Application type** to **Web application**.
4. Set **Name** to `SupportAI Web Client`.
5. Under **Authorized JavaScript origins**, add:
   - `http://localhost:3000`
6. Under **Authorized redirect URIs**, add:
   - `http://localhost:3000/google/callback`
   - `http://localhost:8000/auth/google/callback` (if using direct server redirect)
7. Click **Create**.

---

## Step 4: Add Credentials to Environment Variables

Copy your generated **Client ID** and **Client Secret** and add them to your environment variables (`apps/api/.env`):

```env
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REDIRECT_URI="http://localhost:3000/google/callback"
```
