export const endpoints = {
  auth: {
    login: "auth/login",
    register: "auth/register",
    me: "auth/me",
    refresh: "auth/refresh",
  },
  users: {
    list: "users",
    detail: (id: string) => `users/${id}`,
    update: (id: string) => `users/${id}`,
    delete: (id: string) => `users/${id}`,
  },
} as const;
