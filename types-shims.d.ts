// Top-level shims for dev files (vite config, etc.)

declare module 'vite'
declare module '@vitejs/plugin-react'

declare module 'pdfjs-dist'
declare module 'idb'

declare module 'react'
declare module 'react-dom/client'
declare module 'react/jsx-runtime'

declare const chrome: any
interface Window { chrome?: any }

declare const self: any
