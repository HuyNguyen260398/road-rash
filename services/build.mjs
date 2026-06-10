// Bundles each Lambda handler (TS) into <service>/dist/index.js for Terraform's
// archive_file to zip (DEP-005 / TASK-020). The AWS SDK v3 is provided by the
// nodejs Lambda runtime, so it's marked external to keep bundles small.
//
// Run with: pnpm build:lambdas
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const servicesDir = dirname(fileURLToPath(import.meta.url));

// Each service: entry handler -> dist/index.js exporting `handler`.
const services = ["trips", "presign", "suggest-trips"];

await Promise.all(
  services.map((name) =>
    build({
      entryPoints: [join(servicesDir, name, "handler.ts")],
      outfile: join(servicesDir, name, "dist", "index.js"),
      bundle: true,
      platform: "node",
      target: "node22",
      format: "cjs",
      sourcemap: false,
      minify: false,
      // Provided by the Lambda runtime — don't bundle.
      external: ["@aws-sdk/*"],
      logLevel: "info",
    }),
  ),
);

console.log(`Bundled ${services.length} Lambda handler(s).`);
