import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/cli.ts"],
  format: ["cjs", "esm"],
  dts: { entry: "src/index.ts" },
  splitting: false,
  clean: true,
  shims: true,
});
