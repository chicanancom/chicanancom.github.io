import { defineConfig } from 'vite'

export default defineConfig({
    base: './',
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: 'index.html',
                heart: 'src/WebGL/heart/index.html',
                cloud: 'src/WebGL/cloud/index.html',
                tree: 'src/WebGL/tree/index.html',
                music: 'src/WebGL/music-terrain/index.html'
            }
        }
    }
})
