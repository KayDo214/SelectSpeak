import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const envPath = resolve(__dirname, "..", ".env");

dotenv.config({ path: envPath, quiet: true });
