import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
    base: './',
    plugins: [tailwindcss()],
    build: {
        rollupOptions: {
            input: {
                background: 'src/background.js',
                popup: 'src/popup.html'
            },
            output: {
                entryFileNames: '[name].js',
                format: 'es'
            }
        }
    }
});