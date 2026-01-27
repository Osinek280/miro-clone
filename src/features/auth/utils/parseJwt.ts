export const parseJwt = (token: string) => {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(base64Url.length + ((4 - (base64Url.length % 4)) % 4), "=");

    const decoded = atob(base64);
    return JSON.parse(decoded);
  } catch (e) {
    console.error("Invalid JWT", e);
    return null;
  }
};
