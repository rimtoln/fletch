import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/rpc-proxy': {
        target: 'https://rpc.mainnet.chain.robinhood.com',
        changeOrigin: true,
        rewrite: () => '/',
      },
      '/bs-proxy': {
        target: 'https://robinhoodchain.blockscout.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/bs-proxy/, ''),
      },
      '/hx-proxy': {
        target: 'https://hoodexplorer.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/hx-proxy/, ''),
      },
      '/dex-proxy': {
        target: 'https://api.dexscreener.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dex-proxy/, ''),
      },
      '/gt-proxy': {
        target: 'https://api.geckoterminal.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gt-proxy/, ''),
      },
      '/fx-proxy': {
        target: 'https://api.fxtwitter.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/fx-proxy/, ''),
      },
      '/jina-proxy': {
        target: 'https://r.jina.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/jina-proxy/, ''),
      },
    },
  },
})
