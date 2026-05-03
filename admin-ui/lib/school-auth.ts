import Cookies from "js-cookie";

const SCHOOL_ACCESS_TOKEN_KEY = "school_access_token";
const SCHOOL_REFRESH_TOKEN_KEY = "school_refresh_token";
const SCHOOL_CURRENT_SLUG_KEY = "school_current_slug";

export const getSchoolToken = (): string | undefined => {
  return Cookies.get(SCHOOL_ACCESS_TOKEN_KEY);
};

export const getSchoolRefreshToken = (): string | undefined => {
  return Cookies.get(SCHOOL_REFRESH_TOKEN_KEY);
};

export const setSchoolTokens = (accessToken: string, refreshToken?: string): void => {
  Cookies.set(SCHOOL_ACCESS_TOKEN_KEY, accessToken, {
    expires: 1,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
  if (refreshToken) {
    Cookies.set(SCHOOL_REFRESH_TOKEN_KEY, refreshToken, {
      expires: 30,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
  }
};

export const removeSchoolTokens = (): void => {
  Cookies.remove(SCHOOL_ACCESS_TOKEN_KEY);
  Cookies.remove(SCHOOL_REFRESH_TOKEN_KEY);
  Cookies.remove(SCHOOL_CURRENT_SLUG_KEY);
};

export const setCurrentSchoolSlug = (slug: string): void => {
  Cookies.set(SCHOOL_CURRENT_SLUG_KEY, slug, {
    expires: 1,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });
};

export const getCurrentSchoolSlug = (): string | undefined => {
  return Cookies.get(SCHOOL_CURRENT_SLUG_KEY);
};

export const isSchoolAuthenticated = (): boolean => {
  return !!getSchoolToken();
};
