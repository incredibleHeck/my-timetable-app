/**
 * Warns when esbuild's native binary doesn't match the current platform.
 * Common after copying node_modules between Windows, WSL, or macOS.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);

try {
  const esbuildPkg = require.resolve("esbuild/package.json");
  const esbuildDir = path.dirname(esbuildPkg);
  const binName = process.platform === "win32" ? "esbuild.exe" : "esbuild";
  execFileSync(path.join(esbuildDir, binName), ["--version"], { stdio: "ignore" });
} catch {
  console.warn(
    "\n[eduscheduler-pro] esbuild binary mismatch detected.\n" +
      "Run `npm ci` on this machine (do not copy node_modules across OS/WSL).\n",
  );
}
