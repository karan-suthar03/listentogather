export const environment = {
  production: false,
  // Use window.location.origin to automatically use the current URL
  // This works for both localhost and ngrok tunnels
  apiUrl: typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
};
