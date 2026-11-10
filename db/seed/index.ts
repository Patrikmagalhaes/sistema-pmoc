import { createDatabase } from "../../src/server/db";
import { seedDevelopment } from "./data";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL não definida");
if (/supabase\.(co|com)|\.pooler\./.test(url)) {
  throw new Error("Recusado: o seed de desenvolvimento não roda em banco remoto (LG-06).");
}

const db = createDatabase(url, { max: 1 });
try {
  console.log((await seedDevelopment(db)) ? "seed aplicado" : "seed já aplicado");
} finally {
  await db.close();
}
