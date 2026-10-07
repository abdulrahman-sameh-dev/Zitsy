import { stopStub } from "./resend-stub";

export default async function globalTeardown(): Promise<void> {
  await stopStub();
}
