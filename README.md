# Tank Blitz 🚀

Game tank battle 2D được viết bằng HTML5 Canvas và JavaScript thuần.

## 🎮 Cách chơi

- Sử dụng WASD hoặc arrow keys để di chuyển tank
- Click chuột để bắn
- Tiêu diệt tất cả enemy để hoàn thành stage
- Boss stages có boss tank mạnh hơn

## 🚀 Deploy lên Vercel

### Cách 1: Sử dụng Vercel CLI

```bash
# Cài đặt Vercel CLI
npm i -g vercel

# Deploy
vercel

# Chọn:
# - Framework: Other
# - Output Directory: public
# - Override settings: No

# Deploy production
vercel --prod
```

### Cách 2: Sử dụng Vercel Dashboard

1. Push code lên GitHub
2. Vào [vercel.com](https://vercel.com)
3. Import project từ GitHub
4. Cấu hình:
   - Framework Preset: Other
   - Output Directory: `public`
   - Build Command: (để trống)
   - Install Command: (để trống)

## 📁 Cấu trúc project

```
public/
├── index.html          # Menu chính
├── game.html           # Game screen
├── styles.css          # CSS styles
├── manifest.webmanifest # PWA manifest
├── assets/
│   ├── js/
│   │   ├── assets.js   # Asset loader
│   │   └── game.js     # Game logic
│   ├── sound/          # Sound effects
│   └── *.png           # Sprites
└── Stage*.html         # Stage redirects
```

## 🛠️ Development

```bash
# Chạy local server
npx serve public

# Kiểm tra đường dẫn assets
node check-paths.mjs
```

## 📝 Changelog

- ✅ Chuẩn hóa đường dẫn tuyệt đối cho Vercel
- ✅ Thêm manifest cho PWA
- ✅ Cấu hình cache headers
- ✅ Script kiểm tra đường dẫn tự động
