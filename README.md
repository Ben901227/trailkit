# GPX / KML 編輯器

在瀏覽器裡開啟、檢視、編輯與合併 GPX / KML / KMZ 軌跡，並像 Google Earth 一樣疊加底圖與校正圖片。
純前端、無後端、無 API key，可直接部署到 GitHub Pages。

## 開發

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 解析與統計的單元測試
npm run build    # 型別檢查 + 產生 dist/
```

## 目前進度

- [x] 開啟 GPX / KML / KMZ / GeoJSON（拖放或選檔，以內容而非副檔名判斷格式）
- [x] 圖層面板：軌跡／點位／疊圖的顯示開關、顏色、縮放、關檔
- [x] 軌跡統計：點數、距離、爬升／下降、起訖時間
- [x] 底圖切換（含自訂 XYZ 網址）與手機版 bottom sheet 版面
- [x] Google Earth 圖磚圖層（`gx:MapTilePyramid`）：魯地圖、中研院百年歷史地圖等 KML 直接匯入即用
- [x] 匯出與格式互轉、undo/redo、PWA
- [x] 軌跡點編輯、剪裁／分割／反轉
- [ ] 合併（多檔合成、首尾相接）
- [ ] 疊圖校正與 KMZ 打包
- [ ] 3D 地形檢視、PWA 離線

## 測試資料

`test data/`（未進版控）放實機匯出的檔案。`test/testdata.test.ts` 會把整個資料夾跑過一遍，
確認每個檔案都能開啟且沒有內容被略過；資料夾不存在時該測試自動跳過。

## 部署

推到 `main` 後由 `.github/workflows/deploy.yml` 自動建置並發佈到 GitHub Pages。
Vite 的 `base` 設為 `./`，因此同一份建置在網域根目錄與 `/<repo>/` 子路徑下都能運作。

## 底圖來源

預設底圖使用免金鑰的公開圖磚。**OpenStreetMap 官方圖磚有使用政策限制**，正式對外站台請在
`src/map/basemaps.ts` 換成自己的圖磚服務，或在介面上使用「自訂圖磚網址」。
