import ky from "ky";

export const api = ky.create({
  prefixUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api",
  timeout: 10000,
  hooks: {
    beforeRequest: [
      (request) => {
        const token =
          typeof window !== "undefined"
            ? localStorage.getItem("access_token")
            : null;
        if (token) {
          request.headers.set("Authorization", `Bearer ${token}`);
        }
      },
    ],
  },
});
