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

export async function requestOtp(email: string): Promise<void> {
  await client.post("/auth/otp/request", { email });
}

export async function verifyOtp(email: string, code: string): Promise<TokenOut> {
  const { data } = await client.post<TokenOut>("/auth/otp/verify", { email, code });
  return data;
}

export async function googleAuth(credential: string): Promise<TokenOut> {
  const { data } = await client.post<TokenOut>("/auth/google", { credential });
  return data;
}

export async function inviteAuth(code: string): Promise<TokenOut> {
  const { data } = await client.post<TokenOut>("/auth/invite", { code });
  return data;
}
