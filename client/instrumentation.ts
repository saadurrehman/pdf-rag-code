export async function register() {
  if (typeof window === 'undefined') {
    // Server-side polyfill for localStorage
    global.localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
      key: () => null,
      length: 0,
    } as Storage;
  }
}
