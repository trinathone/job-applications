import client from "./client";

export type VisitorRole = "student" | "teacher" | "other";

export interface VisitorLead {
  name: string;
  email: string;
  role: VisitorRole;
}

export async function saveVisitorLead(lead: VisitorLead): Promise<void> {
  await client.post("/visitors", lead);
}
