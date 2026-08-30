# 第三方成分

[`LICENSE`](LICENSE) 的 MIT 只涵蓋本專案自行撰寫的程式碼。以下成分各有其授權：

| 成分 | 授權 |
|---|---|
| [MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js) | BSD-3-Clause |
| [@tmcw/togeojson](https://github.com/placemark/togeojson) | BSD-2-Clause |
| [JSZip](https://github.com/Stuk/jszip) | MIT（原專案 MIT 或 GPL-3.0 雙授權，本專案採 MIT） |
| `public/fonts/` 的 Noto Sans 字形 | SIL OFL-1.1，全文見 [`public/fonts/OFL.txt`](public/fonts/OFL.txt) |
| `public/data/peaks.json` | 第三方彙整資料，見下 |

## peaks.json

整理自 Google Earth 版「魯地圖＋航跡圖」的全山頭圖層。山名、座標、高程屬於事實，
事實本身通常不受著作權保護；但彙編的選擇與編排在多數法域仍可能受保護。若要 fork 或
商業利用，請自行確認這份資料的使用條件，或移除該檔案（移除後「臺灣山頭」圖層會載入
失敗，其餘功能不受影響）。

## 圖磚服務

底圖與疊加圖層（OpenStreetMap、Esri、國土測繪中心、魯地圖、中研院百年歷史地圖、
AWS Open Data 地形）**並未包含在本專案內**，程式只是引用其公開網址。這些服務各有
自己的使用條款與流量政策，請依其規定使用。
