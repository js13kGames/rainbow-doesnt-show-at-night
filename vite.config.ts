import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    target: 'esnext',
    cssCodeSplit: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        passes: 3,
        unsafe: true,
        unsafe_arrows: true,
        unsafe_methods: true,
        unsafe_comps: true,
        drop_console: true,
        drop_debugger: true,
      },
      mangle: {
        toplevel: true,
      },
      format: {
        comments: false,
      },
    },
  },
})
