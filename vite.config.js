import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/QuanLyTaiLieu/',
  build: {
    // html2pdf là lazy chunk (~935kB) — không load khi khởi động app
    // Các chunk vendor còn lại đều < 400kB, an toàn với limit này
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        // Tách vendor libraries lớn thành chunk riêng để tận dụng browser cache
        manualChunks(id) {
          if (id.includes('node_modules/firebase')) {
            return 'vendor-firebase';        // ~391kB — tải 1 lần, cached lâu dài
          }
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3')) {
            return 'vendor-recharts';        // ~370kB — chỉ dùng ở trang Overview
          }
          if (id.includes('node_modules/react-select')) {
            return 'vendor-react-select';    // ~97kB
          }
          if (id.includes('node_modules/jszip') || id.includes('node_modules/file-saver')) {
            return 'vendor-zip';             // ~99kB — chỉ dùng khi tải xuống ZIP
          }
        },
      },
    },
  },
})
