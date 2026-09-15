import { defineConfig } from "vite";
import uniModule from "@dcloudio/vite-plugin-uni";
import UnoCSS from "unocss/vite";

const uni = (uniModule as any).default || uniModule;

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    UnoCSS(),
    uni()
  ]
});
