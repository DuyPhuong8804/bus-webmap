# 🚌 Hà Nội Bus WebMap

Ứng dụng web bản đồ xe buýt Hà Nội thông minh - Tra cứu trạm, tuyến và tìm đường đi bằng xe buýt với thuật toán tối ưu, tích hợp GeoServer WMS.

## ✨ Tính năng chính

### � Giao diện Tab hiện đại
- **Tab "🗺️ Tìm đường"**: Chức năng định vị, tìm kiếm địa điểm, dẫn đường xe buýt/xe máy
- **Tab "🚍 Tra cứu tuyến đường"**: Danh sách tuyến, tìm kiếm và xem chi tiết tuyến
- **Tab navigation**: Chuyển đổi mượt mà giữa 2 chế độ sử dụng
- **Design theo phong cách Google Maps**: Bo góc tròn, shadow mềm, màu sắc hiện đại

### 🗺️ Bản đồ tương tác
- **Chuyển đổi lớp bản đồ (giống Google Maps)**:
  - 🗺️ **Bản đồ (OSM)**: Bản đồ đường phố chi tiết
  - 🛰️ **Vệ tinh**: Hình ảnh thực từ Esri World Imagery
  - Menu dropdown đẹp với preview thumbnail
  - Icon SVG chuyên nghiệp, animation slide down
- **Hiển thị bằng GeoServer WMS**:
  - Layer `hanoi_bus:v_route_lines` (zIndex 450) - Tất cả tuyến xe buýt
  - Layer `hanoi_bus:v_stops_geom` (zIndex 500) - Tất cả trạm xe buýt
  - Tích hợp format_options (dpi:180) và env variables
  - **Bật/tắt layer**: Checkbox điều khiển hiển thị từng layer
- **Markers đặc biệt**:
  - Icon highlight (50x50, màu đỏ) cho trạm được chọn (tự động clear sau 10 giây)
  - Icon điểm A (36x36, màu xanh lá) - Điểm xuất phát
  - Icon điểm B (36x36, màu đỏ) - Điểm đích
  - Icon vị trí của tôi - SVG chấm tròn xanh dương (28x28) hoặc mũi tên định hướng khi tracking
- **Controls hiện đại (phong cách Google Maps)**:
  - **Icon layers** (SVG) - Chuyển đổi lớp bản đồ (top-right)
  - **Zoom controls** (+/-) - Phóng to/thu nhỏ bản đồ (bottom-right, 170px)
  - **Navigation button** (la bàn) - Theo dõi vị trí & hướng di chuyển (bottom-right, 265px)
  - **Location button** (target) - Lấy vị trí hiện tại một lần (bottom-right, 120px)
  - Bo góc tròn 8px, shadow mềm, hover effects, icons SVG chuyên nghiệp
- **Popup thông tin**: Click trạm trong danh sách "Trạm gần bạn" để xem chi tiết
- **Fly to location**: Zoom mượt mà đến đối tượng được chọn

### 📍 Định vị & Tìm kiếm
- **Geolocation GPS**:
  - **One-shot mode** (Location button):
    - `enableHighAccuracy: true` - Độ chính xác cao
    - `timeout: 20000ms` - Thời gian chờ định vị
    - `maximumAge: 0` - Không dùng cache, luôn lấy vị trí mới
    - Hiển thị tọa độ chi tiết + nút "Đặt làm điểm A"
    - Tự động tìm 5 trạm gần nhất (loại bỏ trùng lặp)
    - Marker chấm tròn xanh dương (28x28)
  - **Continuous tracking mode** (Navigation button):
    - `watchPosition()` API - Theo dõi vị trí liên tục
    - Tính toán hướng di chuyển từ GPS coordinates (bearing/heading)
    - Icon mũi tên xoay theo hướng di chuyển (dynamic SVG)
    - Tự động cập nhật vị trí và hướng khi di chuyển
    - Nút la bàn có viền xanh khi đang tracking
    - Click lại để tắt tracking và dừng theo dõi
- **Geocoding (Nominatim)**:
  - Tự động thêm ", Hà Nội" vào query
  - Limit 5 kết quả, `countrycodes=vn`
  - Accept-language: vi
  - Hiển thị loading state khi đang tìm kiếm
- **Reverse Geocoding**: Chuyển tọa độ thành địa chỉ (tùy chọn)

### 🚌 Dẫn đường xe buýt thông minh
- **Thuật toán tối ưu**:
  - ✅ Tuyến trực tiếp (không chuyển)
  - ✅ Tuyến 1 lần chuyển (tối ưu điểm chuyển)
  - Tìm kiếm trong bán kính 1km từ A và B
  - **Dijkstra + Grid Spatial Index** cho performance
  - Deduplication: gộp các tuyến cùng khoảng cách
  - **Hiển thị tối đa 3 tuyến** gợi ý tốt nhất
- **Hiển thị chi tiết**:
  - Badge số tuyến (vd: "35A", "35A → 13")
  - Thời gian ước tính (đi bộ 12 phút/km + xe 4 phút/km + chờ 6 phút/chuyển)
  - Số lần chuyển (badge riêng)
  - Chi tiết từng bước:
    - 🚶 Đi bộ X mét
    - 🚌 Xe Y: Trạm A → Trạm B  
    - 🔄 Chuyển tuyến tại Z
  - Tổng kết: Quãng đường đi bộ + xe buýt
- **Vẽ đường trên bản đồ**:
  - Đường đi bộ: màu xám (#6b7280), weight 5, opacity 0.7
  - Đường xe buýt: màu xanh (#3b82f6), weight 6, opacity 0.8
  - **Render order**: Walk trước, bus sau (bus luôn hiển thị trên cùng)
  - Đường ngắn (≤150m): vẽ thẳng
  - Đường dài (>150m): theo đường phố (OSRM với cache)
- **Marker chỉ hướng**:
  - 🟢 Lên xe (boarding): màu xanh lá (#10b981), 32x32px
  - 🟠 Xuống xe (alighting): màu cam (#f59e0b), 32x32px
  - 🟣 Chuyển tuyến (transfer): màu tím (#8b5cf6), 32x32px
- **Đường nét đứt A→B** (Bird's eye):
  - Hiện khi chọn điểm B (nếu đã có A)
  - **Tự động ẩn** khi bắt đầu tìm tuyến
  - Màu xám (#6b7280), dashArray: '10, 10'

### 🚗 Dẫn đường xe máy/ô tô
- Sử dụng OSRM (Open Source Routing Machine)
- Profile: driving
- Polyline màu đỏ, weight 5, opacity 0.8
- Hiển thị khoảng cách (km) + thời gian (phút)
- Cache OSRM requests trong useRef (tránh gọi trùng)

### 📋 Quản lý tuyến
- **Nhóm tuyến thông minh**: Nhóm theo số (01, 01A, 01B...)
- **2 nút điều hướng**: Lượt đi (→) và lượt về (←)
- **Tìm kiếm nhanh**: Gõ "01" → hiển thị tất cả tuyến 01x
- **Highlight**: Tuyến đang chọn có background xanh
- **Hiển thị tối ưu**: Tối đa 30 nhóm tuyến (performance)
- **Single click**: Hiện polyline tuyến trên bản đồ (màu xanh, weight 4)
- **Double click**: Modal chi tiết đầy đủ
- **Nút tắt**: Clear tuyến đã chọn

### 🔍 Chi tiết trạm/tuyến
**Chi tiết trạm** (double-click hoặc từ danh sách "Trạm gần bạn"):
- ID, tên, tọa độ chính xác
- Danh sách tuyến đi qua (badge)
- Nút "📍 Focus trên bản đồ" - Zoom đến trạm (zoom 17)
- Nút "🗺️ Đặt làm điểm B" - Sử dụng cho tìm đường

**Chi tiết tuyến** (double-click trong danh sách):
- Số hiệu + tên đầy đủ
- Danh sách điểm dừng theo thứ tự (có STT)
- Nút focus từng điểm dừng
- Nút "🗺️ Hiển thị tuyến trên bản đồ"

**Trạm gần bạn**:
- Tự động hiện khi chọn vị trí/điểm A
- Hiển thị tên + khoảng cách (km)
- Click để xem chi tiết và highlight trạm (10s)

## 🛠️ Công nghệ sử dụng

### Frontend
- **React 19.2.0** - UI framework hiện đại
- **Vite 7.2.4** - Build tool cực nhanh  
- **Leaflet 1.9.4** - Thư viện bản đồ mã nguồn mở
- **React-Leaflet 5.0.0** - React wrapper cho Leaflet
- **Custom SVG Icons** - Icon chuyên nghiệp (Google Maps style)
- **Tab Navigation** - Giao diện 2 tab hiện đại
- **Esri Satellite Tiles** - Hình ảnh vệ tinh chất lượng cao

### Backend
- **Node.js + Express 5.2.1** - Web server
- **PostgreSQL (pg 8.16.3)** - Database client
- **node-fetch 3.3.2** - Fetch API cho Node.js
- **cors 2.8.5** - CORS middleware
- **dotenv 17.2.3** - Environment variables

### GeoServer
- **GeoServer** - Web Map Service (WMS)
- **Workspace**: `hanoi_bus`
- **Layers**:
  - `hanoi_bus:v_route_lines` - Vector layer tuyến xe buýt
  - `hanoi_bus:v_stops_geom` - Point layer trạm xe buýt
- **SLD Styling**: Cần config `uom="pixel"` để giữ kích thước cố định
- **WMS Parameters**: `format=image/png`, `transparent=true`, `tiled=true`

### Database
**PostgreSQL 14+**
- Bảng: `stops`, `routes`, `trips`, `stop_times`, `route_stops`
- **In-memory cache**: 
  - `stopsData`, `routesData` arrays
  - `stopsById`, `routesById` Maps
  - `routeStopsMap`, `stopRoutesMap` Objects
  - `busAdj` - Bus adjacency graph
  - `gridIndex` - Spatial grid (300m cells)
- **Dijkstra + MinHeap** cho tìm đường
- Khởi động: Load toàn bộ data vào memory (10-30s)

### External Services
- **OpenStreetMap** - Bản đồ nền (tiles)
- **Nominatim** - Geocoding/Reverse geocoding
- **OSRM** - Routing engine (driving profile)
- **GeoServer (Local)** - WMS server cho trạm và tuyến

## 🚀 Cài đặt và chạy

### Yêu cầu
- Node.js 18+
- PostgreSQL 14+ (với PostGIS nếu dùng spatial queries)
- GeoServer 2.x
- npm hoặc yarn

### 1. Setup Database

```sql
-- Tạo database
CREATE DATABASE hanoi_bus;

-- Kết nối đến database
\c hanoi_bus

-- Import GTFS data
-- Các bảng cần thiết: stops, routes, trips, stop_times, calendar

-- Tạo bảng route_stops để tối ưu (khuyên dùng)
CREATE TABLE route_stops (
  route_id TEXT,
  stop_id TEXT,
  PRIMARY KEY (route_id, stop_id)
);

-- Populate từ stop_times + trips
INSERT INTO route_stops (route_id, stop_id)
SELECT DISTINCT t.route_id, st.stop_id
FROM stop_times st
JOIN trips t ON t.trip_id = st.trip_id;

-- Tạo indexes (quan trọng cho performance)
CREATE INDEX idx_stops_id ON stops(stop_id);
CREATE INDEX idx_routes_id ON routes(route_id);
CREATE INDEX idx_trips_route ON trips(route_id);
CREATE INDEX idx_trips_id ON trips(trip_id);
CREATE INDEX idx_stop_times_trip ON stop_times(trip_id);
CREATE INDEX idx_stop_times_stop ON stop_times(stop_id);
CREATE INDEX idx_route_stops ON route_stops(route_id, stop_id);
```

### 2. Setup GeoServer

```powershell
# 1. Cài đặt GeoServer (download từ geoserver.org)
# 2. Khởi động GeoServer (mặc định: http://localhost:8080/geoserver)
# 3. Login vào web interface (admin/geoserver)

# 4. Tạo Workspace
- Name: hanoi_bus
- URI: http://hanoi_bus

# 5. Tạo DataStore (PostgreSQL connection)
- Workspace: hanoi_bus
- Data Source Name: hanoi_bus_store
- Host: localhost
- Port: 5432
- Database: hanoi_bus
- User: your_user
- Password: your_password

# 6. Publish Layers
# Layer 1: Trạm xe buýt (Point)
- Name: v_stops_geom
- Source: SELECT stop_id, stop_name, ST_SetSRID(ST_MakePoint(CAST(stop_lon AS DOUBLE PRECISION), CAST(stop_lat AS DOUBLE PRECISION)), 4326) AS geom FROM stops
- Native SRS: EPSG:4326
- Style: point (cần config uom="pixel" trong SLD)

# Layer 2: Tuyến xe buýt (LineString)  
- Name: v_route_lines
- Source: Query từ stop_times + trips để tạo LineString
- Native SRS: EPSG:4326
- Style: line

### 3. Backend Setup

```powershell
cd backend

# Install dependencies
npm install

# Tạo file .env trong thư mục backend/
# Nội dung file .env:
# DATABASE_URL=postgresql://user:password@localhost:5432/hanoi_bus
# PORT=3001

# Chạy server
npm start
```

Backend chạy tại `http://localhost:3001`

**Kiểm tra:**
- Mở `http://localhost:3001` → Xem JSON API info
- Xem console: "Cache ready: { stops: X, routes: Y }"
- Test endpoints: `/api/stops`, `/api/routes`

### 4. Frontend Setup

```powershell
cd frontend

# Install dependencies  
npm install

# Tạo file .env trong thư mục frontend/ (tùy chọn, nếu backend khác port 3001)
# Nội dung file .env:
# VITE_API_URL=http://localhost:3001

# Chạy dev server
npm run dev
```

Frontend chạy tại `http://localhost:5173`

**Kiểm tra:**
- Mở browser tại `http://localhost:5173`
- Kiểm tra bản đồ hiển thị
- Kiểm tra 2 checkbox "Lớp bản đồ GeoServer"
- Test các tính năng: Vị trí, Tìm kiếm, Tìm tuyến

### 5. Build Production

```powershell
# Frontend
cd frontend
npm run build
# Output: dist/

# Deploy dist/ với nginx, apache, hoặc static server
# Đảm bảo GeoServer và Backend đang chạy
```

## 📖 Hướng dẫn sử dụng

### Tab "🗺️ Tìm đường"

#### 1. Kiểm soát hiển thị bản đồ
- Trong section **"🗺️ Lớp dữ liệu GeoServer"**
- Bật/tắt checkbox:
  - ☑️ **🚍 Tuyến xe buýt** - Hiển thị tất cả tuyến
  - ☑️ **🚏 Trạm xe buýt** - Hiển thị tất cả trạm
- Tắt layer khi cần xem rõ thông tin khác

#### 2. Điều khiển bản đồ
- **Zoom controls** (bottom-right):
  - Nút **+** - Phóng to bản đồ
  - Nút **-** - Thu nhỏ bản đồ
  - Hoặc dùng scroll chuột
- **Chuyển đổi lớp bản đồ**:
  - Click icon **layers** (top-right)
  - Chọn:
    - **🗺️ Bản đồ (OSM)**: Đường phố chi tiết
    - **🛰️ Vệ tinh**: Hình ảnh thực
  - Xem preview thumbnail để dễ nhận biết

#### 3. Lấy vị trí hiện tại
- **Vị trí một lần** (Location button - icon target):
  - Click nút **target** (bottom-right) hoặc nút **"📍 Vị trí của tôi"** trong sidebar
  - Cho phép trình duyệt truy cập vị trí
  - Bản đồ zoom đến vị trí của bạn (zoom 16)
  - Hiển thị tọa độ chính xác
  - Tự động tìm 5 trạm gần nhất
  - Click **"✅ Đặt làm điểm A"** để dùng cho tìm đường
- **Theo dõi vị trí liên tục** (Navigation button - icon la bàn):
  - Click nút **la bàn** (bottom-right, phía trên nút target)
  - Bật chế độ tracking: nút có viền xanh, icon mũi tên xoay theo hướng di chuyển
  - Vị trí tự động cập nhật khi bạn di chuyển
  - Mũi tên chỉ hướng dựa trên GPS bearing (góc giữa 2 tọa độ)
  - Click lại để tắt tracking và dừng theo dõi

#### 4. Tìm kiếm địa điểm
- Nhập địa chỉ/địa danh (vd: "Hồ Gươm", "Bách Khoa")
- Click **"Tìm"** hoặc Enter
- Chờ kết quả (có thể mất vài giây)
- Chọn kết quả → Tự động đặt làm điểm A/B (tùy mode)

#### 5. Chọn điểm A & B
- Chọn mode **"Điểm A (Xuất phát)"** hoặc **"Điểm B (Đích)"**
- Click trên bản đồ → Đặt marker
- Hoặc click vào trạm trong "Trạm gần bạn" → **"🗺️ Đặt làm điểm B"**
- Khi có cả A và B: hiện đường nét đứt tạm thời

#### 6. Tìm tuyến xe buýt
- Đảm bảo đã có điểm A và B
- Click **"🚌 Tìm tuyến xe buýt"**
- Xem tối đa **3 tuyến gợi ý** tốt nhất
- Mỗi tuyến hiển thị:
  - Badge số tuyến
  - Thời gian ước tính
  - Số lần chuyển (nếu có)
  - Chi tiết các bước (đi bộ, xe buýt, chuyển tuyến)
- Click vào tuyến → Xem đường đi trên bản đồ với markers chỉ hướng

#### 7. Dẫn đường xe máy/ô tô
- Click **"🏍️ Dẫn đường đi xe"**
- Xem đường đi màu đỏ
- Thông tin: Khoảng cách (km) + Thời gian (phút)

#### 8. Xem trạm gần bạn
- Trạm tự động hiện trong section **"📍 Trạm gần bạn"**
- Click vào trạm:
  - Highlight trạm (icon đỏ 50x50, tự động clear sau 10s)
  - Zoom đến trạm (zoom 18)
  - Popup chi tiết
- Click **"🗺️ Đặt làm điểm B"** để dùng cho tìm đường

#### 9. Xóa đường đi
- Click **"Xóa đường đi"** trong section Dẫn đường
- Clear tất cả: route path, transit routes, markers chỉ hướng

### Tab "🚍 Tra cứu tuyến đường"

#### 1. Xem danh sách tuyến
- Hiển thị tất cả tuyến xe buýt (nhóm theo số tuyến)
- Mỗi nhóm có 2 nút: **→** (Lượt đi) và **←** (Lượt về)
- Hiển thị tối đa 30 nhóm tuyến đầu tiên

#### 2. Tìm kiếm tuyến
- Dùng ô tìm kiếm để filter tuyến (vd: "03", "03A", "15")
- Kết quả tự động lọc theo số tuyến
- Click **✕** để xóa bộ lọc

#### 3. Xem tuyến trên bản đồ
- **Single click** nút **→** / **←** → Hiện polyline xanh trên bản đồ
- Bản đồ tự động zoom đến phạm vi tuyến
- Tuyến đang chọn được highlight màu xanh
- Click **✕ Tắt** để clear tuyến đã chọn

#### 4. Xem chi tiết tuyến
- **Double click** nút **→** / **←** → Modal chi tiết
- Thông tin:
  - Số hiệu + tên đầy đủ tuyến
  - Danh sách điểm dừng theo thứ tự (có STT)
  - Nút focus từng điểm dừng (📍)
- Click **"🗺️ Hiển thị tuyến trên bản đồ"** để vẽ tuyến

### Chi tiết trạm (từ cả 2 tab)
- **Double-click** trạm hoặc từ danh sách "Trạm gần bạn"
- Modal hiển thị:
  - ID, tên, tọa độ chính xác
  - Danh sách tuyến đi qua (badge)
  - Nút **"📍 Focus trên bản đồ"** - Zoom đến trạm (zoom 17)
  - Nút **"🗺️ Đặt làm điểm B"** - Sử dụng cho tìm đường

## 📁 Cấu trúc dự án

```
hanoi-bus-webmap/
├── README.md
├── backend/
│   ├── server.js              # Main server
│   ├── package.json
│   └── .env                   # DATABASE_URL, PORT (cần tạo)
├── frontend/
│   ├── src/
│   │   ├── App.jsx           # Main component
│   │   ├── App.css           # Styling
│   │   ├── main.jsx          # Entry point
│   │   ├── index.css         # Global styles
│   │   └── assets/           # Static assets
│   ├── public/               # Public files
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── eslint.config.js
└── data/
    └── gtfs/                  # GTFS raw data
        └── hanoi_gtfs_am/
            ├── calendar.txt
            ├── route_edges.txt
            ├── route_stops.txt
            ├── routes.txt
            ├── stop_times.txt
            ├── stops.txt
            └── trips.txt
```

## 🔌 API Endpoints

### Root
`GET /` - API info & status

### Stops
- `GET /api/stops` - Danh sách trạm
  - Query: `limit` (default 999999), `offset` (default 0)
- `GET /api/stops/:stopId` - Chi tiết trạm + tuyến đi qua
- `GET /api/stops/nearby/:lat/:lon` - Trạm gần nhất
  - Query: `limit` (default 5)

### Routes  
- `GET /api/routes` - Danh sách tuyến
- `GET /api/routes/:routeId` - Chi tiết tuyến + điểm dừng (sorted)

### Geocoding
- `GET /api/geocode?q={query}` - Tìm địa điểm (Nominatim proxy)
- `GET /api/reverse-geocode/:lat/:lon` - Tọa độ → Địa chỉ

### Routing
- `GET /api/route/:fromLat/:fromLon/:toLat/:toLon` - OSRM driving route
- `GET /api/transit-route/:fromLat/:fromLon/:toLat/:toLon` - Tuyến xe buýt
  - Response: `{ from, to, routes: [], nearFromStops, nearToStops, message }`
  - `routes`: Array of transit options (max 10)
  - Each route: `{ type, totalDistance, estimatedTime, transfers, legs: [] }`
  - Leg types: `'walk'`, `'bus'`, `'transfer'`

## ⚡ Performance & Optimization

### Backend
- **In-memory cache**: Tất cả data load lúc khởi động (~10-30s)
- **Grid spatial index**: 300m cells cho tìm trạm gần O(1)
- **Dijkstra + MinHeap**: O(E log V) cho tìm đường tối ưu
- **Deduplication**: Gộp tuyến trùng khoảng cách
- **route_stops table**: Pre-computed mapping (fallback: JOIN runtime)

### Frontend  
- **GeoServer WMS**: Offload rendering sang server, không vẽ từng marker
- **Layer control**: Bật/tắt theo nhu cầu, giảm tải rendering
- **Route filtering**: Max 30 nhóm tuyến hiển thị
- **OSRM cache**: useRef Map cache routing requests
- **Render order**: Walk → Bus (bus luôn hiển thị trên)
- **Short distance optimization**: Đường <150m vẽ thẳng thay vì gọi OSRM
- **Selected route only**: Chỉ vẽ polyline khi user chọn tuyến

### Database
Indexes khuyến nghị:
```sql
CREATE INDEX idx_stops_id ON stops(stop_id);
CREATE INDEX idx_routes_id ON routes(route_id);
CREATE INDEX idx_trips_route ON trips(route_id);
CREATE INDEX idx_trips_id ON trips(trip_id);
CREATE INDEX idx_stop_times_trip ON stop_times(trip_id);
CREATE INDEX idx_stop_times_stop ON stop_times(stop_id);
CREATE INDEX idx_route_stops ON route_stops(route_id, stop_id);
```

## ⚠️ Lưu ý quan trọng

### Kết nối Internet
- Cần internet cho: Tiles OSM, Nominatim, OSRM
- **GeoServer**: Chạy local (localhost:8080), không cần internet
- Offline: Bản đồ trắng, tìm kiếm/dẫn đường không hoạt động

### GeoServer
- **Phải chạy trước** khi start frontend
- Port mặc định: 8080
- Layers phải publish đúng tên: `hanoi_bus:v_route_lines`, `hanoi_bus:v_stops_geom`
- SLD styling: Cần config `uom="pixel"` để giữ kích thước điểm cố định

### Rate Limiting
- **Nominatim**: 1 request/second (không spam!)
- **OSRM**: Public server có thể chậm giờ cao điểm
- Production: Tự host OSRM server

### Browser
- Cần: HTML5 Geolocation, ES6+, SVG, Canvas (cho Leaflet)
- Tested: Chrome, Firefox, Edge (latest)
- Safari: Cần HTTPS cho geolocation (localhost được phép HTTP)

### Database
- RAM: Tối thiểu 100MB cho cache
- Khởi động lần đầu: 10-30s (load cache)
- Dữ liệu GTFS cần update định kỳ theo lịch xe buýt thực tế

## 🐛 Troubleshooting

### Backend không khởi động
- Kiểm tra PostgreSQL running: `psql -U postgres -l`
- Check `DATABASE_URL` trong `.env` file
- Check quyền truy cập database
- Xem console logs để biết lỗi chi tiết

### Frontend màn trắng
- Mở DevTools (F12) → Console tab
- Check backend đang chạy: `http://localhost:3001`
- Check CORS settings trong backend
- Check network tab để xem failed requests

### GeoServer layers không hiển thị
- Kiểm tra GeoServer đang chạy: `http://localhost:8080/geoserver`
- Login web interface: admin/geoserver
- Check layers đã publish: `hanoi_bus:v_route_lines`, `hanoi_bus:v_stops_geom`
- Xem Layer Preview để test
- Check browser console có lỗi WMS request không
- Thử tắt/bật checkbox trong "Lớp bản đồ GeoServer"

### Không tìm thấy tuyến xe buýt
- Điểm A/B quá xa trạm (>1km)
- Chọn điểm gần trạm hơn hoặc dùng trạm từ "Trạm gần bạn"
- Click vào trạm → "Đặt làm điểm B"
- Xem alert message có gợi ý trạm gần không

### GPS không hoạt động
- Cho phép truy cập vị trí trong browser settings
- Dùng HTTPS cho production (localhost được phép HTTP)
- Desktop không có GPS: Vị trí dựa vào Wi-Fi/IP (có thể sai)
- Fallback: Dùng tìm kiếm địa điểm thay vì GPS

### Markers chỉ hướng không hiện
- Check console có lỗi không
- Đảm bảo đã chọn một transit route từ danh sách gợi ý
- Markers chỉ hiện khi có boarding/alighting/transfer points
- Zoom out để xem toàn bộ đường đi

## 👨‍💻 Credits & License

**Dự án**: Web Map "Xe buýt Hà Nội" - Dịch vụ GIS  
**Trường**: Đại học Mỏ - Địa chất, Hà Nội  
**Năm**: 2025

**License**: MIT - Tự do sử dụng cho học tập & nghiên cứu

**Công nghệ & Dữ liệu**:
- OpenStreetMap Contributors
- Nominatim (geocoding)
- OSRM Project (routing)
- GTFS Hà Nội (dữ liệu xe buýt)
- Leaflet & React-Leaflet
- PostgreSQL, Express, React, Vite

---

**Happy Mapping! 🗺️🚌**
