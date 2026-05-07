import client from "./client";

export interface TokenOut {
  access_token: string;
  token_type: string;
  user_id: number;
  email: string;
  display_name: string | null;
}

export async function login(email: string, password: string): Promise<TokenOut> {
  const { data } = await client.post<TokenOut>("/auth/login", { email, password });
  return data;
}

export async function register(
  email: string,
  password: string,
  display_name?: string
): Promise<TokenOut> {
  const { data } = await client.post<TokenOut>("/auth/register", {
    email,
    password,
    display_name: display_name || null,
  });
  return data;
}
