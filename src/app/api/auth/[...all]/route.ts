import { toNextJsHandler } from "better-auth/next-js";
import { getAuth } from "@/server/auth";

export const runtime = "nodejs";

const handler = (req: Request) => getAuth().auth.handler(req);

export const { GET, POST } = toNextJsHandler(handler);
