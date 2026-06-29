import {
  getSafeReturnTo,
  loginRoute,
  withSearchParams,
} from "../utils/authRedirect";

describe("authentication redirects", () => {
  it("preserves safe in-app return paths", () => {
    expect(getSafeReturnTo("/comparison/test?car1Id=1")).toBe(
      "/comparison/test?car1Id=1",
    );
  });

  it("rejects external and recursive login redirects", () => {
    expect(getSafeReturnTo("https://example.com")).toBe("/");
    expect(getSafeReturnTo("//example.com")).toBe("/");
    expect(getSafeReturnTo("/profile-routes/login?returnTo=/")).toBe("/");
  });

  it("encodes return paths and query parameters", () => {
    expect(loginRoute("/post/create?communityId=arac-onerileri")).toEqual({
      pathname: "/profile-routes/login",
      params: { returnTo: "/post/create?communityId=arac-onerileri" },
    });
    expect(
      withSearchParams("/comparison/test", {
        car1Name: "Audi A4",
        empty: "",
      }),
    ).toBe("/comparison/test?car1Name=Audi%20A4");
  });
});
