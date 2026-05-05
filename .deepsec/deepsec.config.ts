import { defineConfig } from "deepsec/config";

export default defineConfig({
  projects: [
    { id: "ai-product-owner", root: ".." },
    // <deepsec:projects-insert-above>
  ],
});
