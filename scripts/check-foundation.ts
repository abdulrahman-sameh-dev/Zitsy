import "dotenv/config";

import { db } from "../src/lib/db/prisma";
import { integrations, serverEnv } from "../src/lib/config/env";

const count = await db.product.count();
const tables = await db.$queryRaw<{ n: number }[]>`SELECT 1 AS n`;

console.log(
  JSON.stringify(
    {
      database: serverEnv.DATABASE_URL.replace(/:\/\/[^@]*@/, "://***@"),
      products: count,
      queryOk: tables.length === 1,
      integrations,
    },
    null,
    2,
  ),
);

await db.$disconnect();
