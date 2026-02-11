# Fake Out – Mobile (Expo)

Player app for Fake Out. Join games by room PIN and play on your phone.

## Run

```bash
npm install
npx expo start
```

Scan the QR code with **Expo Go** (Android) or the Camera app (iOS).

## Backend URL

- **Production**: Uses `https://fakeout.fly.dev` by default.
- **Local**: In development, uses `http://localhost:3001`. On a physical device, set your machine’s IP:

  ```bash
  EXPO_PUBLIC_SOCKET_URL=http://192.168.1.5:3001 npx expo start
  ```

  Or edit `src/config.ts` and set `SOCKET_URL` to your machine’s LAN IP.

## Host

Hosts use the **web app** (see repo root and `frontend/`). Create a room there and share the PIN; players join via this app.
