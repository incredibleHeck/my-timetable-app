/**
 * Runs the pre-flight check against a fixture and prints what a user would see
 * before generation starts.
 *
 *   npm run diagnostics:preflight -- --fixture path/to/data.json
 */
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { AppData } from "../../src/types";
import { runPreflightCheck } from "../../src/features/generator/scheduler/validation/preflight";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = arg("fixture") ?? path.join(HERE, "fixtures", "school-data.json");
const raw = JSON.parse(fs.readFileSync(FIXTURE, "utf-8"));
const data: AppData = raw.data ?? raw;

const result = runPreflightCheck(data);
console.log(`fixture ${path.basename(FIXTURE)} | ok=${result.ok}`);
console.log(`\nerrors (${result.errors.length}) — these block generation:`);
result.errors.forEach((e) => console.log(`  ${e.message}`));
console.log(`\nwarnings (${result.warnings.length}) — generation proceeds:`);
result.warnings.forEach((w) => console.log(`  ${w.message}`));
