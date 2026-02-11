// Backend URL. For physical device in dev, set EXPO_PUBLIC_SOCKET_URL to your machine's IP (e.g. http://192.168.1.5:3001)
export const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL ||
  (__DEV__ ? 'http://localhost:3001' : 'https://fakeout.fly.dev');
