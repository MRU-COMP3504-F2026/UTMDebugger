import { defineConfig } from 'vite';

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                background: 'src/background.js',
                popup: 'src/popup.js'
            },
            output: {
                entryFileNames: '[name].js',
                format: 'es'
            }
        }
    }
});