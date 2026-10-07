"use server";

import { headers } from "next/headers";

import { getClientIp } from "@/lib/http";

import { submitContactMessage, type ContactResult } from "./service";

/** Server-side entry point for the contact form — no client trust anywhere. */
export async function submitContactAction(input: unknown): Promise<ContactResult> {
  const ip = getClientIp(await headers());
  return submitContactMessage(input, { ip });
}
