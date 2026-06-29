export const loginRoute = (returnTo: string) =>
  ({
    pathname: "/profile-routes/login",
    params: { returnTo },
  }) as const;

export const withSearchParams = (
  pathname: string,
  params: Record<string, string | null | undefined>,
) => {
  const search = Object.entries(params)
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");

  return search ? `${pathname}?${search}` : pathname;
};

export const getSafeReturnTo = (
  value: string | string[] | undefined,
  fallback = "/",
) => {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.startsWith("/profile-routes/login")
  ) {
    return fallback;
  }

  return candidate;
};
