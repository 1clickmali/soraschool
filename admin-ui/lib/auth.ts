import Cookies from "js-cookie";

const ACCESS_TOKEN_KEY = "sora_access_token";
const REFRESH_TOKEN_KEY = "sora_refresh_token";

export const getAccessToken = (): string | undefined => {
  return Cookies.get(ACCESS_TOKEN_KEY);
};

export const getRefreshToken = (): string | undefined => {
  return Cookies.get(REFRESH_TOKEN_KEY);
};

export const setTokens = (accessToken: string, refreshToken?: string): void => {
  Cookies.set(ACCESS_TOKEN_KEY, accessToken, {
    expires: 1, // 1 day
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  if (refreshToken) {
    Cookies.set(REFRESH_TOKEN_KEY, refreshToken, {
      expires: 30, // 30 days
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
  }
};

export const removeTokens = (): void => {
  Cookies.remove(ACCESS_TOKEN_KEY);
  Cookies.remove(REFRESH_TOKEN_KEY);
};

export const isAuthenticated = (): boolean => {
  return !!getAccessToken();
};
