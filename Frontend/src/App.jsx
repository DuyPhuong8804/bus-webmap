import { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

function WmsOverlay({ url, layers, zIndex = 400 }) {
  const map = useMap();

  useEffect(() => {
    const wms = L.tileLayer.wms(url, {
      layers,
      format: "image/png",
      transparent: true,
      tiled: true,
      maxZoom: 22,
      // Giữ kích thước điểm cố định khi zoom
      format_options: "dpi:180",
      // Thêm env variable để GeoServer render đúng scale
      env: "size:8",
    });
    wms.setZIndex(zIndex);
    wms.addTo(map);

    return () => map.removeLayer(wms);
  }, [map, url, layers, zIndex]);

  return null;
}

// Fix Leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// ===== API URL (fix /api double) =====
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_URL = API_BASE.replace(/\/$/, '').endsWith('/api')
  ? API_BASE.replace(/\/$/, '')
  : `${API_BASE.replace(/\/$/, '')}/api`;

// ===== Icons =====

// Icon dấu chấm nhỏ cho khi zoom xa
const busStopDotIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="8" height="8">
      <circle cx="5" cy="5" r="3" fill="#2563eb" stroke="white" stroke-width="1"/>
    </svg>
  `),
  iconSize: [8, 8],
  iconAnchor: [4, 4],
  popupAnchor: [0, -4],
});

// Icon tùy chỉnh cho trạm xe buýt - hình xe bus rõ ràng
const busStopIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="40" height="40">
      <ellipse cx="24" cy="44" rx="18" ry="3" fill="rgba(0,0,0,0.2)"/>
      <rect x="8" y="10" width="32" height="28" rx="4" fill="#2563eb" stroke="white" stroke-width="2"/>
      <rect x="11" y="14" width="11" height="8" rx="1" fill="#dbeafe"/>
      <rect x="26" y="14" width="11" height="8" rx="1" fill="#dbeafe"/>
      <rect x="17" y="26" width="14" height="10" rx="1" fill="#1e40af"/>
      <circle cx="15" cy="38" r="4" fill="#1f2937" stroke="white" stroke-width="1.5"/>
      <circle cx="33" cy="38" r="4" fill="#1f2937" stroke="white" stroke-width="1.5"/>
      <circle cx="15" cy="38" r="2" fill="#6b7280"/>
      <circle cx="33" cy="38" r="2" fill="#6b7280"/>
      <circle cx="12" cy="12" r="1.5" fill="#fbbf24"/>
      <circle cx="36" cy="12" r="1.5" fill="#fbbf24"/>
    </svg>
  `),
  iconSize: [40, 40],
  iconAnchor: [20, 40],
  popupAnchor: [0, -40],
});

// Icon cho điểm A
const pointAIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#22c55e" stroke="white" stroke-width="2"/>
      <text x="12" y="13" text-anchor="middle" fill="white" font-size="10" font-weight="bold">A</text>
    </svg>
  `),
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

// Icon cho điểm B
const pointBIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="#ef4444" stroke="white" stroke-width="2"/>
      <text x="12" y="13" text-anchor="middle" fill="white" font-size="10" font-weight="bold">B</text>
    </svg>
  `),
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

// Icon vị trí của tôi (dấu chấm xanh - không tracking)
const userLocationIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
      <circle cx="16" cy="16" r="14" fill="#0ea5e9" opacity="0.15"/>
      <circle cx="16" cy="16" r="8" fill="#0ea5e9" opacity="0.3"/>
      <circle cx="16" cy="16" r="5" fill="#0ea5e9" stroke="white" stroke-width="2"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

// Icon vị trí của tôi (mũi tên chỉ hướng - khi tracking)
const createUserLocationIcon = (heading) => {
  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
          <feOffset dx="0" dy="2" result="offsetblur"/>
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.3"/>
          </feComponentTransfer>
          <feMerge>
            <feMergeNode/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <g transform="translate(24, 24) rotate(${heading})">
        <circle cx="0" cy="0" r="16" fill="#1a73e8" opacity="0.2" filter="url(#shadow)"/>
        <path d="M 0,-18 L -6,10 L 0,6 L 6,10 Z" fill="#1a73e8" stroke="white" stroke-width="2" filter="url(#shadow)"/>
        <circle cx="0" cy="0" r="4" fill="white" stroke="#1a73e8" stroke-width="2"/>
      </g>
    </svg>
  `;
  
  return new L.Icon({
    iconUrl: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString),
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -24],
  });
};

// Icon cho trạm được highlight
const busStopHighlightIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 60" width="50" height="50">
      <circle cx="30" cy="30" r="28" fill="none" stroke="#ef4444" stroke-width="3" opacity="0.4"/>
      <circle cx="30" cy="30" r="22" fill="none" stroke="#ef4444" stroke-width="2" opacity="0.6"/>
      <ellipse cx="30" cy="54" rx="22" ry="4" fill="rgba(0,0,0,0.3)"/>
      <rect x="10" y="15" width="40" height="35" rx="5" fill="#ef4444" stroke="white" stroke-width="2.5"/>
      <rect x="14" y="20" width="14" height="10" rx="2" fill="#fef2f2"/>
      <rect x="32" y="20" width="14" height="10" rx="2" fill="#fef2f2"/>
      <rect x="21" y="34" width="18" height="13" rx="2" fill="#991b1b"/>
      <circle cx="19" cy="50" r="5" fill="#1f2937" stroke="white" stroke-width="2"/>
      <circle cx="41" cy="50" r="5" fill="#1f2937" stroke="white" stroke-width="2"/>
      <circle cx="19" cy="50" r="2.5" fill="#6b7280"/>
      <circle cx="41" cy="50" r="2.5" fill="#6b7280"/>
      <circle cx="14" cy="17" r="2" fill="#fbbf24"/>
      <circle cx="46" cy="17" r="2" fill="#fbbf24"/>
    </svg>
  `),
  iconSize: [50, 50],
  iconAnchor: [25, 50],
  popupAnchor: [0, -50],
});

// Icon mũi tên chỉ hướng (lên xe buýt)
const boardingIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
      <circle cx="16" cy="16" r="15" fill="#10b981" stroke="white" stroke-width="2"/>
      <path d="M16 8 L16 22 M16 8 L11 13 M16 8 L21 13" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

// Icon mũi tên xuống (xuống xe buýt)
const alightingIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
      <circle cx="16" cy="16" r="15" fill="#f59e0b" stroke="white" stroke-width="2"/>
      <path d="M16 24 L16 10 M16 24 L11 19 M16 24 L21 19" stroke="white" stroke-width="2.5" stroke-linecap="round" fill="none"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

// Icon chuyển tuyến
const transferIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,' + btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32">
      <circle cx="16" cy="16" r="15" fill="#8b5cf6" stroke="white" stroke-width="2"/>
      <path d="M8 16 L24 16 M20 12 L24 16 L20 20" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </svg>
  `),
  iconSize: [32, 32],
  iconAnchor: [16, 16],
  popupAnchor: [0, -16],
});

// ===== Map helpers =====
function MapClickHandler({ onMapClick, onZoomChange }) {
  const map = useMapEvents({
    click: (e) => onMapClick(e.latlng),
    zoomend: () => onZoomChange && onZoomChange(map.getZoom()),
  });
  return null;
}

function FlyToLocation({ location, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (location) map.flyTo(location, zoom || map.getZoom(), { duration: 1 });
  }, [location, zoom, map]);
  return null;
}

function ZoomControl() {
  const map = useMap();
  
  const zoomIn = () => {
    map.zoomIn();
  };
  
  const zoomOut = () => {
    map.zoomOut();
  };
  
  return (
    <div className="zoom-control">
      <button onClick={zoomIn} className="zoom-btn zoom-in" title="Phóng to">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
        </svg>
      </button>
      <div className="zoom-divider"></div>
      <button onClick={zoomOut} className="zoom-btn zoom-out" title="Thu nhỏ">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M19 13H5v-2h14v2z"/>
        </svg>
      </button>
    </div>
  );
}

function NavigationControl({ userLocation, isTracking, onToggleTracking }) {
  const map = useMap();
  
  const handleNavigation = () => {
    if (userLocation && !isTracking) {
      // Nếu đã có vị trí nhưng chưa tracking, zoom vào
      map.flyTo(userLocation, 18, { duration: 0.5 });
    }
    // Bật/tắt tracking
    onToggleTracking();
  };
  
  return (
    <div className="navigation-control">
      <button 
        onClick={handleNavigation} 
        className={`navigation-btn ${isTracking ? 'tracking' : ''}`}
        title={isTracking ? "Tắt theo dõi vị trí" : "Theo dõi vị trí & hướng"}
      >
        <svg viewBox="0 0 24 24" width="20" height="20">
          {isTracking ? (
            // Icon tracking active - chấm xanh
            <>
              <circle cx="12" cy="12" r="10" fill="#1a73e8" opacity="0.2"/>
              <circle cx="12" cy="12" r="6" fill="#1a73e8"/>
              <circle cx="12" cy="12" r="3" fill="#fff"/>
            </>
          ) : (
            // Icon la bàn/mũi tên - đỏ
            <>
              <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" fill="#ea4335"/>
              <path d="M12 2L4.5 20.29l.71.71L12 18z" fill="#fff" opacity="0.7"/>
              <circle cx="12" cy="12" r="1.5" fill="#5f6368"/>
            </>
          )}
        </svg>
      </button>
    </div>
  );
}

// ===== Utils =====
function getCompassDirection(heading) {
  const directions = ['Bắc', 'Đông Bắc', 'Đông', 'Đông Nam', 'Nam', 'Tây Nam', 'Tây', 'Tây Bắc'];
  const index = Math.round(heading / 45) % 8;
  return directions[index];
}

function estimateTransitMinutes(route) {
  const walkKm = (route.walkToStop || 0) + (route.walkFromStop || 0);
  const busKm = route.busDistance || 0;
  const transfers = route.transfers || 0;

  // Tùy chỉnh đơn giản (ổn định hơn số từ backend nếu backend chưa chuẩn):
  // - đi bộ: 12 phút/km (~5km/h)
  // - xe buýt: 4 phút/km (~15km/h)
  // - mỗi lần chuyển: +6 phút (chờ + đi vào trạm)
  const min = walkKm * 12 + busKm * 4 + transfers * 6;
  return Math.max(1, Math.round(min));
}

function App() {
  const [stops, setStops] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);

  const [highlightedStopData, setHighlightedStopData] = useState(null);

  const [loading, setLoading] = useState(true);

  // Location (one-shot)
  const [userLocation, setUserLocation] = useState(null);
  const [userHeading, setUserHeading] = useState(0); // Hướng di chuyển
  const [isTracking, setIsTracking] = useState(false); // Đang theo dõi vị trí
  const watchIdRef = useRef(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [nearbyStops, setNearbyStops] = useState([]);
  const [searching, setSearching] = useState(false);

  // Points A & B
  const [pointA, setPointA] = useState(null);
  const [pointB, setPointB] = useState(null);
  const [straightLine, setStraightLine] = useState(null);

  // Routing
  const [routePath, setRoutePath] = useState(null);
  const [routeInfo, setRouteInfo] = useState(null);

  // Transit routing
  const [transitRoutes, setTransitRoutes] = useState([]);
  const [selectedTransitRoute, setSelectedTransitRoute] = useState(null);
  const [searchingTransit, setSearchingTransit] = useState(false);
  const [transitionPoints, setTransitionPoints] = useState([]);

  // UI states
  const [flyToLocation, setFlyToLocation] = useState(null);
  const [detailView, setDetailView] = useState(null);
  const [clickMode, setClickMode] = useState('A');
  const [routeFilter, setRouteFilter] = useState('');
  
  // Pending point for confirmation dialog
  const [pendingPoint, setPendingPoint] = useState(null);

  // GeoServer layers visibility
  const [showStopsLayer, setShowStopsLayer] = useState(true);
  const [showRoutesLayer, setShowRoutesLayer] = useState(true);

  // Base layer selection
  const [baseLayer, setBaseLayer] = useState('osm'); // 'osm' or 'satellite'
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);

  // Tab management
  const [activeTab, setActiveTab] = useState('directions'); // 'routeSearch' or 'directions'

  const osrmCache = useRef(new Map());

  // Helpers for route list
  const getRouteNumber = (routeId) => {
    const match = String(routeId).match(/^(\d+[A-Z]?)/);
    return match ? match[1] : String(routeId);
  };

  const getRouteDirection = (routeId) => (String(routeId).endsWith('_1') ? 'Lượt đi' : 'Lượt về');

  const getFilteredRoutes = () => {
    let filtered = routes;
    if (routeFilter.trim()) {
      const search = routeFilter.toLowerCase();
      filtered = routes.filter((route) => getRouteNumber(route.route_id).toLowerCase().includes(search));
    }

    const grouped = {};
    filtered.forEach((route) => {
      const num = getRouteNumber(route.route_id);
      if (!grouped[num]) grouped[num] = [];
      grouped[num].push(route);
    });

    return grouped;
  };

  // Load stops + routes
  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/stops?limit=500`).then((r) => r.json()),
      fetch(`${API_URL}/routes`).then((r) => r.json()),
    ])
      .then(([stopsData, routesData]) => {
        setStops(stopsData || []);
        setRoutes(routesData || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading data:', err);
        setLoading(false);
      });
  }, []);

  // Nearby stops
  const findNearbyStops = async (lat, lng, limit = 5) => {
    try {
      const response = await fetch(`${API_URL}/stops/nearby/${lat}/${lng}?limit=${limit}`);
      const data = await response.json();

      // Lọc trạm trùng vị trí
      const uniqueStops = [];
      const seenPositions = new Set();
      for (const stop of data || []) {
        const posKey = `${parseFloat(stop.stop_lat).toFixed(5)},${parseFloat(stop.stop_lon).toFixed(5)}`;
        if (!seenPositions.has(posKey)) {
          seenPositions.add(posKey);
          uniqueStops.push(stop);
        }
      }
      setNearbyStops(uniqueStops);
    } catch (err) {
      console.error('Error finding nearby stops:', err);
    }
  };

  // ===== Continuous location tracking (theo dõi liên tục) =====
  const startTracking = () => {
    if (!navigator.geolocation) {
      alert('Trình duyệt không hỗ trợ Geolocation.');
      return;
    }

    if (isTracking) {
      // Nếu đang tracking, tắt đi
      stopTracking();
      return;
    }

    setIsTracking(true);
    let lastPosition = null;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
        
        // Tính toán hướng di chuyển nếu có vị trí trước
        if (lastPosition && position.coords.speed > 0.5) { // Chỉ cập nhật khi đang di chuyển (>0.5 m/s)
          const heading = calculateBearing(
            lastPosition.lat, lastPosition.lng,
            pos.lat, pos.lng
          );
          setUserHeading(heading);
        }
        
        setUserLocation(pos);
        lastPosition = pos;

        // Tự động tìm trạm gần lần đầu
        if (!lastPosition) {
          setFlyToLocation({ location: pos, zoom: 17 });
          findNearbyStops(pos.lat, pos.lng);
        }
      },
      (error) => {
        console.error('Geolocation error:', error);
        setIsTracking(false);
        let msg = 'Không thể lấy vị trí hiện tại.\n\n';
        msg += 'Hãy kiểm tra:\n';
        msg += '• Cho phép Location trong trình duyệt\n';
        msg += '• Bật Location trong Windows\n';
        msg += '• Tắt VPN/Proxy (nếu có)\n';
        msg += '• Desktop không có GPS thì có thể sai (Wi-Fi/IP)\n\n';
        msg += `Chi tiết lỗi: ${error.message}`;
        alert(msg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setIsTracking(false);
  };

  const calculateBearing = (lat1, lng1, lat2, lng2) => {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const toDeg = (rad) => (rad * 180) / Math.PI;

    const dLng = toRad(lng2 - lng1);
    const lat1Rad = toRad(lat1);
    const lat2Rad = toRad(lat2);

    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
    const bearing = toDeg(Math.atan2(y, x));

    return (bearing + 360) % 360; // Chuẩn hóa 0-360
  };

  // Lấy vị trí 1 lần (fallback cho nút khác)
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Trình duyệt không hỗ trợ Geolocation.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
        setUserLocation(pos);
        setFlyToLocation({ location: pos, zoom: 16 });
        findNearbyStops(pos.lat, pos.lng);
      },
      (error) => {
        console.error('Geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  };

  const setUserLocationAsPointA = () => {
    if (!userLocation) return;
    setPointA(userLocation);
    setClickMode('B');
    findNearbyStops(userLocation.lat, userLocation.lng);
  };

  // Search (Geocode)
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchResults([]);

    try {
      const response = await fetch(`${API_URL}/geocode?q=${encodeURIComponent(searchQuery + ', Hà Nội')}`);
      const data = await response.json();
      setSearchResults(data || []);

      if (!data || data.length === 0) {
        alert('Không tìm thấy kết quả. Thử từ khóa khác!');
      }
    } catch (err) {
      console.error('Error searching:', err);
      alert('Lỗi khi tìm kiếm. Vui lòng thử lại!');
    } finally {
      setSearching(false);
    }
  };

  const selectSearchResult = (result) => {
    const pos = { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };

    if (clickMode === 'A') {
      setPointA(pos);
      findNearbyStops(pos.lat, pos.lng);
    } else {
      setPointB(pos);
      if (pointA) setStraightLine([[pointA.lat, pointA.lng], [pos.lat, pos.lng]]);
    }

    setFlyToLocation({ location: pos, zoom: 16 });
    setSearchResults([]);
    setSearchQuery('');
  };

  // Click map to set A/B
  const handleMapClick = async (latlng) => {
    // Lưu vị trí tạm thời và hiển thị dialog xác nhận
    setPendingPoint({ latlng, mode: clickMode });
  };
  
  // Xác nhận chọn điểm
  const confirmPoint = async () => {
    if (!pendingPoint) return;
    
    const { latlng, mode } = pendingPoint;
    
    if (mode === 'A') {
      setPointA(latlng);
      findNearbyStops(latlng.lat, latlng.lng);
      // (optional) reverse geocode để hiển thị – hiện bạn không dùng nên giữ nhẹ
      try {
        await fetch(`${API_URL}/reverse-geocode/${latlng.lat}/${latlng.lng}`);
      } catch {}
    } else {
      setPointB(latlng);
      if (pointA) setStraightLine([[pointA.lat, pointA.lng], [latlng.lat, latlng.lng]]);
    }
    
    setPendingPoint(null);
  };
  
  // Hủy chọn điểm
  const cancelPoint = () => {
    setPendingPoint(null);
  };

  // OSRM car route
  const findRoute = async () => {
    if (!pointA || !pointB) {
      alert('Vui lòng chọn điểm A và điểm B');
      return;
    }

    setStraightLine(null);

    try {
      const response = await fetch(`${API_URL}/route/${pointA.lat}/${pointA.lng}/${pointB.lat}/${pointB.lng}`);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const coords = route.geometry.coordinates.map((c) => [c[1], c[0]]);
        setRoutePath(coords);
        setRouteInfo({
          distance: (route.distance / 1000).toFixed(2) + ' km',
          duration: Math.round(route.duration / 60) + ' phút',
        });
      }
    } catch (err) {
      console.error('Error finding route:', err);
      alert('Không thể tìm đường đi');
    }
  };

  // Transit route
  const findTransitRoute = async () => {
    if (!pointA || !pointB) {
      alert('Vui lòng chọn điểm A và điểm B');
      return;
    }

    setSearchingTransit(true);
    setTransitRoutes([]);
    setSelectedTransitRoute(null);
    setRoutePath(null);
    setRouteInfo(null);
    setStraightLine(null);
    setTransitionPoints([]);

    try {
      const response = await fetch(`${API_URL}/transit-route/${pointA.lat}/${pointA.lng}/${pointB.lat}/${pointB.lng}`);
      const data = await response.json();

      if (data.routes && data.routes.length > 0) {
        // chỉ lấy tối đa 3 tuyến (đúng yêu cầu)
        setTransitRoutes(data.routes.slice(0, 3));
      } else {
        let msg = data.message || 'Không tìm thấy tuyến xe buýt';
        if (data.nearFromStops?.length) {
          msg += `\n\n📍 Trạm gần điểm A:\n${data.nearFromStops
            .map((s) => `• ${s.name} (${(s.distance * 1000).toFixed(0)}m)`)
            .join('\n')}`;
        }
        if (data.nearToStops?.length) {
          msg += `\n\n📍 Trạm gần điểm B:\n${data.nearToStops
            .map((s) => `• ${s.name} (${(s.distance * 1000).toFixed(0)}m)`)
            .join('\n')}`;
        }
        msg += '\n\n💡 Thử click vào một trạm từ danh sách "Trạm gần bạn" làm điểm A hoặc B!';
        alert(msg);
      }
    } catch (err) {
      console.error('Error finding transit route:', err);
      alert('Lỗi khi tìm tuyến xe buýt: ' + err.message);
    } finally {
      setSearchingTransit(false);
    }
  };

  const fetchOsrmRoute = async (from, to) => {
    const key = `${from.lat},${from.lng}->${to.lat},${to.lng}`;
    if (osrmCache.current.has(key)) return osrmCache.current.get(key);

    const response = await fetch(`${API_URL}/route/${from.lat}/${from.lng}/${to.lat}/${to.lng}`);
    const data = await response.json();

    osrmCache.current.set(key, data);
    return data;
  };

  const selectTransitRoute = async (route) => {
    setSelectedTransitRoute(route);
    console.log('Selected route legs:', route.legs);

    const allPaths = [];
    const transitions = [];

    if (!route.legs || route.legs.length === 0) return;

    for (let i = 0; i < route.legs.length; i++) {
      const leg = route.legs[i];
      const prevLeg = i > 0 ? route.legs[i - 1] : null;

      // Markers chỉ hướng
      if (prevLeg) {
        if (prevLeg.type === 'walk' && leg.type === 'bus') {
          transitions.push({
            position: [leg.from.lat, leg.from.lon],
            type: 'boarding',
            label: `🚌 Lên xe ${leg.routeNumber}`,
          });
        } else if (prevLeg.type === 'bus' && leg.type === 'walk') {
          transitions.push({
            position: [prevLeg.to.lat, prevLeg.to.lon],
            type: 'alighting',
            label: `🏁 Xuống xe ${prevLeg.routeNumber}`,
          });
        } else if (prevLeg.type === 'bus' && leg.type === 'transfer') {
          transitions.push({
            position: [leg.from.lat, leg.from.lon],
            type: 'transfer',
            label: `🔄 Chuyển tuyến`,
          });
        }
      }

      if (leg.type === 'transfer') {
        // Vẽ đường đi bộ ngắn cho transfer
        allPaths.push({
          type: 'walk',
          coords: [
            [leg.from.lat, leg.from.lon],
            [leg.to.lat, leg.to.lon],
          ],
        });
        continue;
      }

      if (leg.type === 'walk') {
        // Ước lượng đường thẳng để quyết định có gọi OSRM hay không
        const walkDistanceMeters =
          Math.sqrt(
            Math.pow((leg.to.lat - leg.from.lat) * 111, 2) +
              Math.pow((leg.to.lon - leg.from.lon) * 111 * Math.cos((leg.from.lat * Math.PI) / 180), 2)
          ) * 1000;

        if (walkDistanceMeters <= 150) {
          allPaths.push({
            type: 'walk',
            coords: [
              [leg.from.lat, leg.from.lon],
              [leg.to.lat, leg.to.lon],
            ],
          });
        } else {
          try {
            const data = await fetchOsrmRoute(
              { lat: leg.from.lat, lng: leg.from.lon },
              { lat: leg.to.lat, lng: leg.to.lon }
            );
            if (data.routes && data.routes[0]) {
              const coords = data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
              allPaths.push({ type: 'walk', coords });
            } else {
              allPaths.push({
                type: 'walk',
                coords: [
                  [leg.from.lat, leg.from.lon],
                  [leg.to.lat, leg.to.lon],
                ],
              });
            }
          } catch (err) {
            console.error('Error getting walk path:', err);
            allPaths.push({
              type: 'walk',
              coords: [
                [leg.from.lat, leg.from.lon],
                [leg.to.lat, leg.to.lon],
              ],
            });
          }
        }
      } else if (leg.type === 'bus') {
        try {
          const data = await fetchOsrmRoute(
            { lat: leg.from.lat, lng: leg.from.lon },
            { lat: leg.to.lat, lng: leg.to.lon }
          );
          if (data.routes && data.routes[0]) {
            const coords = data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
            allPaths.push({ type: 'bus', coords, routeNumber: leg.routeNumber });
          } else {
            allPaths.push({
              type: 'bus',
              coords: [
                [leg.from.lat, leg.from.lon],
                [leg.to.lat, leg.to.lon],
              ],
              routeNumber: leg.routeNumber,
            });
          }
        } catch (err) {
          console.error('Error getting bus path:', err);
          allPaths.push({
            type: 'bus',
            coords: [
              [leg.from.lat, leg.from.lon],
              [leg.to.lat, leg.to.lon],
            ],
            routeNumber: leg.routeNumber,
          });
        }
      }
    }

    console.log('All paths to render:', allPaths);
    setRoutePath(allPaths);
    setTransitionPoints(transitions);
  };

  // Stop click
  const handleStopClick = (stop) => {
    setHighlightedStopData(stop);
    setFlyToLocation({ location: { lat: parseFloat(stop.stop_lat), lng: parseFloat(stop.stop_lon) }, zoom: 18 });

    setTimeout(() => {
      setHighlightedStopData(null);
    }, 10000);
  };

  const handleStopDoubleClick = async (stop) => {
    try {
      const response = await fetch(`${API_URL}/stops/${stop.stop_id}`);
      const data = await response.json();
      setDetailView({ type: 'stop', data });
    } catch (err) {
      console.error('Error loading stop details:', err);
    }
  };

  // Route select
  const handleRouteSelect = async (routeId) => {
    try {
      const response = await fetch(`${API_URL}/routes/${routeId}`);
      const data = await response.json();
      setSelectedRoute(data);

      if (data.stops && data.stops.length > 0) {
        const bounds = data.stops.map((s) => [parseFloat(s.stop_lat), parseFloat(s.stop_lon)]);
        setFlyToLocation({ location: bounds[0], zoom: 13 });
      }
    } catch (err) {
      console.error('Error loading route:', err);
    }
  };

  const handleRouteDoubleClick = async (route) => {
    try {
      const response = await fetch(`${API_URL}/routes/${route.route_id}`);
      const data = await response.json();
      setDetailView({ type: 'route', data });
    } catch (err) {
      console.error('Error loading route details:', err);
    }
  };

  const clearPaths = () => {
    setRoutePath(null);
    setStraightLine(null);
    setRouteInfo(null);
    setTransitRoutes([]);
    setSelectedTransitRoute(null);
    setTransitionPoints([]);
  };

  if (loading) return <div className="loading">Đang tải dữ liệu...</div>;

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar">
        <h1>🚌 Xe buýt Hà Nội</h1>

        {/* Tab Navigation */}
        <div className="tab-navigation">
          <button 
            className={`tab-button ${activeTab === 'directions' ? 'active' : ''}`}
            onClick={() => setActiveTab('directions')}
          >
            🗺️ Tìm đường
          </button>
          <button 
            className={`tab-button ${activeTab === 'routeSearch' ? 'active' : ''}`}
            onClick={() => setActiveTab('routeSearch')}
          >
            🚍 Tra cứu tuyến đường
          </button>
        </div>

        {/* Tab Content: Tìm đường */}
        {activeTab === 'directions' && (
          <>
            {/* GeoServer Layers */}
            <div className="section">
              <h3>🗺️ Lớp dữ liệu GeoServer</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showRoutesLayer}
                    onChange={(e) => setShowRoutesLayer(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>🚍 Tuyến xe buýt</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={showStopsLayer}
                    onChange={(e) => setShowStopsLayer(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '14px', fontWeight: '500' }}>🚏 Trạm xe buýt</span>
                </label>
              </div>
            </div>

            {/* Search */}
            <div className="section">
              <h3>🔍 Tìm kiếm địa điểm</h3>
              <div className="search-box">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !searching && handleSearch()}
                  placeholder="Nhập địa chỉ, địa danh..."
                  disabled={searching}
                />
                <button onClick={handleSearch} className="btn btn-sm" disabled={searching}>
                  {searching ? '⏳' : 'Tìm'}
                </button>
              </div>

              {searching && (
                <div className="search-loading">
                  <p>🔄 Đang tìm kiếm... (có thể mất vài giây)</p>
                </div>
              )}

              {searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.map((result, idx) => (
                    <div key={idx} className="search-result-item" onClick={() => selectSearchResult(result)}>
                      {result.display_name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Point mode */}
            <div className="section">
              <h3>📌 Chọn điểm</h3>
              <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '10px' }}>💡 Chọn chế độ rồi CLICK trên bản đồ</p>
              <div className="btn-group">
                <button className={`btn ${clickMode === 'A' ? 'btn-success' : 'btn-outline'}`} onClick={() => setClickMode('A')}>
                  Điểm A (Xuất phát)
                </button>
                <button className={`btn ${clickMode === 'B' ? 'btn-danger' : 'btn-outline'}`} onClick={() => setClickMode('B')}>
                  Điểm B (Đích)
                </button>
              </div>
              {pointA && <p className="point-info">✅ Đã chọn điểm A</p>}
              {pointB && <p className="point-info">✅ Đã chọn điểm B</p>}
            </div>

            {/* Routing */}
            <div className="section">
              <h3>🗺️ Dẫn đường</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button onClick={findTransitRoute} className="btn btn-success" disabled={!pointA || !pointB || searchingTransit}>
                  {searchingTransit ? '🔄 Đang tìm...' : '🚌 Tìm tuyến xe buýt'}
                </button>
                <button onClick={findRoute} className="btn btn-primary" disabled={!pointA || !pointB}>
                  🏍️ Dẫn đường đi xe
                </button>
              </div>

              {routeInfo && (
                <div className="route-info">
                  <p>
                    <strong>Khoảng cách:</strong> {routeInfo.distance}
                  </p>
                  <p>
                    <strong>Thời gian:</strong> {routeInfo.duration}
                  </p>
                </div>
              )}

              {(routePath || transitRoutes.length > 0) && (
                <button onClick={clearPaths} className="btn btn-sm">
                  Xóa đường đi
                </button>
              )}
            </div>

            {/* Transit options - max 3 */}
            {transitRoutes.length > 0 && (
              <div className="section">
                <h3>🚌 Gợi ý tuyến ({Math.min(3, transitRoutes.length)})</h3>
                <div className="transit-routes-list">
                  {transitRoutes
                    .sort((a, b) => estimateTransitMinutes(a) - estimateTransitMinutes(b))
                    .slice(0, 3)
                    .map((route, idx) => {
                    const busLegs = route.legs.filter((l) => l.type === 'bus');
                    const routeNumbers = busLegs.map((l) => l.routeNumber).join(' → ');
                    const routeLabel = busLegs.length === 1 ? `Tuyến ${routeNumbers}` : `${routeNumbers}`;
                    const estMin = estimateTransitMinutes(route);

                    return (
                      <div
                        key={idx}
                        className={`transit-route-card ${selectedTransitRoute === route ? 'selected' : ''}`}
                        onClick={() => selectTransitRoute(route)}
                      >
                        <div className="transit-route-header">
                          <span className="route-badge">{routeLabel}</span>
                          <span className="route-time">{estMin} phút</span>
                          {route.transfers > 0 && <span className="transfer-badge">{route.transfers} chuyển</span>}
                        </div>

                        <div className="transit-route-steps">
                          {route.legs.map((leg, legIdx) => (
                            <div key={legIdx} className="transit-step">
                              {leg.type === 'walk' && <span>🚶 Đi bộ {(leg.distance * 1000).toFixed(0)}m</span>}
                              {leg.type === 'bus' && <span>🚌 Xe {leg.routeNumber}: {leg.from.name} → {leg.to.name}</span>}
                              {leg.type === 'transfer' && <span>🔄 {leg.from.name.replace('Chuyển tuyến tại ', '')}</span>}
                            </div>
                          ))}
                        </div>

                        <div className="transit-route-summary">
                          <small>
                            Đi bộ: {((route.walkToStop + route.walkFromStop) * 1000).toFixed(0)}m | Xe buýt: {route.busDistance.toFixed(1)}km
                          </small>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Nearby stops */}
            {nearbyStops.length > 0 && (
              <div className="section">
                <h3>📍 Trạm gần bạn</h3>
                <div className="nearby-list">
                  {nearbyStops.map((stop) => (
                    <div key={stop.stop_id} className="nearby-item" onClick={() => handleStopClick(stop)}>
                      <strong>{stop.stop_name || stop.stop_id}</strong>
                      <span>{stop.distance.toFixed(2)} km</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Tab Content: Tra cứu tuyến đường */}
        {activeTab === 'routeSearch' && (
          <>
            {/* Route list */}
            <div className="section">
              <h3>🚍 Danh sách tuyến ({routes.length} tuyến)</h3>

          {selectedRoute && (
            <div
              className="route-info"
              style={{
                marginBottom: '10px',
                padding: '10px',
                background: '#dbeafe',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '14px', fontWeight: '500' }}>✓ Đã chọn: Tuyến {getRouteNumber(selectedRoute.route_id)}</span>
              <button onClick={() => setSelectedRoute(null)} className="btn btn-sm" style={{ padding: '4px 12px' }}>
                ✕ Tắt
              </button>
            </div>
          )}

          <div className="search-box" style={{ marginBottom: '15px' }}>
            <input
              type="text"
              value={routeFilter}
              onChange={(e) => setRouteFilter(e.target.value)}
              placeholder="Tìm tuyến (vd: 01, 03A, 15)..."
            />
            {routeFilter && (
              <button onClick={() => setRouteFilter('')} className="btn btn-sm">
                ✕
              </button>
            )}
          </div>

          <div className="route-list-grouped">
            {Object.entries(getFilteredRoutes())
              .slice(0, 30)
              .map(([routeNum, routeVariants]) => (
                <div key={routeNum} className="route-group">
                  <div className="route-number">{routeNum}</div>
                  <div className="route-variants">
                    {routeVariants.map((route) => (
                      <button
                        key={route.route_id}
                        onClick={() => handleRouteSelect(route.route_id)}
                        onDoubleClick={() => handleRouteDoubleClick(route)}
                        className={`route-direction-btn ${selectedRoute?.route_id === route.route_id ? 'active' : ''}`}
                        title="Click: Xem tuyến | Double click: Chi tiết"
                      >
                        {getRouteDirection(route.route_id) === 'Lượt đi' ? '→' : '←'}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>

              {Object.keys(getFilteredRoutes()).length === 0 && (
                <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: '14px', marginTop: '20px' }}>Không tìm thấy tuyến</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Map */}
      <div className="map-container">
        {/* Base Layer Control (top right) */}
        <div className="base-layer-control">
          <button
            onClick={() => setLayerMenuOpen(!layerMenuOpen)}
            className="layers-toggle-btn"
            title="Chọn lớp bản đồ"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27-7.38 5.74zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z"/>
            </svg>
          </button>
          
          {layerMenuOpen && (
            <div className="base-layer-menu">
              <button
                onClick={() => { setBaseLayer('osm'); setLayerMenuOpen(false); }}
                className={`base-layer-option ${baseLayer === 'osm' ? 'active' : ''}`}
              >
                <div className="layer-thumbnail osm-preview"></div>
                <div className="layer-info">
                  <div className="layer-name">Bản đồ</div>
                  <div className="layer-desc">OSM</div>
                </div>
                {baseLayer === 'osm' && <div className="layer-check">✓</div>}
              </button>
              <button
                onClick={() => { setBaseLayer('satellite'); setLayerMenuOpen(false); }}
                className={`base-layer-option ${baseLayer === 'satellite' ? 'active' : ''}`}
              >
                <div className="layer-thumbnail satellite-preview"></div>
                <div className="layer-info">
                  <div className="layer-name">Vệ tinh</div>
                  <div className="layer-desc">Hình ảnh thực</div>
                </div>
                {baseLayer === 'satellite' && <div className="layer-check">✓</div>}
              </button>
            </div>
          )}
        </div>

        {/* Location Button (bottom right) */}
        <div className="location-control">
          <button
            onClick={getCurrentLocation}
            className="location-btn"
            title="Vị trí của tôi"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
            </svg>
          </button>
        </div>

        <MapContainer center={[21.0285, 105.8542]} zoom={13} style={{ height: '100%', width: '100%' }} zoomControl={false}>
          {baseLayer === 'osm' ? (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          ) : (
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          )}

          <ZoomControl />
          <NavigationControl userLocation={userLocation} isTracking={isTracking} onToggleTracking={startTracking} />

          {showRoutesLayer && (
            <WmsOverlay
              url="http://localhost:8080/geoserver/hanoi_bus/wms"
              layers="hanoi_bus:v_route_lines"
              zIndex={450}
            />
          )}

          {showStopsLayer && (
            <WmsOverlay
              url="http://localhost:8080/geoserver/hanoi_bus/wms"
              layers="hanoi_bus:v_stops_geom"
              zIndex={500}
            />
          )}

          <MapClickHandler onMapClick={handleMapClick} />
          {flyToLocation && <FlyToLocation location={flyToLocation.location} zoom={flyToLocation.zoom} />}

          {/* Vị trí của tôi */}
          {userLocation && (
            <Marker 
              position={userLocation} 
              icon={isTracking ? createUserLocationIcon(userHeading) : userLocationIcon}
            >
              <Popup>
                <div style={{ minWidth: 180 }}>
                  <strong>📍 Vị trí của tôi</strong>
                  <div style={{ fontSize: 12, marginTop: 6 }}>
                    {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
                  </div>
                  {isTracking && (
                    <div style={{ fontSize: 11, color: '#1a73e8', marginTop: 4, fontWeight: 500 }}>
                      🧭 Hướng: {Math.round(userHeading)}° {getCompassDirection(userHeading)}
                    </div>
                  )}
                  <button
                    onClick={setUserLocationAsPointA}
                    style={{
                      marginTop: 10,
                      padding: '6px 12px',
                      background: '#22c55e',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                      width: '100%',
                    }}
                  >
                    ✅ Đặt làm điểm A
                  </button>
                </div>
              </Popup>
            </Marker>
          )}
          {highlightedStopData && (
            <Marker
              position={[parseFloat(highlightedStopData.stop_lat), parseFloat(highlightedStopData.stop_lon)]}
              icon={busStopHighlightIcon}
              zIndexOffset={1000}
            >
              <Popup autoClose={false} closeOnClick={false}>
                <div style={{ minWidth: '220px' }}>
                  <div
                    style={{
                      padding: '8px',
                      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                      borderRadius: '6px',
                      marginBottom: '10px',
                      color: 'white',
                      fontWeight: 'bold',
                      textAlign: 'center',
                      fontSize: '13px',
                    }}
                  >
                    ⭐ TRẠM BẠN VỪA CHỌN ⭐
                  </div>
                  <strong style={{ fontSize: '16px', color: '#ef4444' }}>🛑 {highlightedStopData.stop_name || highlightedStopData.stop_id}</strong>
                  <br />
                  <small style={{ color: '#6b7280' }}>
                    Tọa độ: {parseFloat(highlightedStopData.stop_lat).toFixed(5)}, {parseFloat(highlightedStopData.stop_lon).toFixed(5)}
                  </small>
                  <br />
                  <button
                    onClick={() => {
                      setPointB({ lat: parseFloat(highlightedStopData.stop_lat), lng: parseFloat(highlightedStopData.stop_lon) });
                      if (pointA) setStraightLine([[pointA.lat, pointA.lng], [parseFloat(highlightedStopData.stop_lat), parseFloat(highlightedStopData.stop_lon)]]);
                    }}
                    style={{
                      marginTop: '10px',
                      padding: '8px 16px',
                      background: '#3b82f6',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      width: '100%',
                    }}
                  >
                    🗺️ Đặt làm điểm B
                  </button>
                </div>
              </Popup>
            </Marker>
          )}

          {/* Selected route polyline */}
          {selectedRoute && selectedRoute.stops && (
            <Polyline positions={selectedRoute.stops.map((s) => [parseFloat(s.stop_lat), parseFloat(s.stop_lon)])} color="blue" weight={4} opacity={0.7} />
          )}

          {/* A/B */}
          {pointA && (
            <Marker position={pointA} icon={pointAIcon}>
              <Popup>
                <strong>Điểm A (Xuất phát)</strong>
              </Popup>
            </Marker>
          )}

          {pointB && (
            <Marker position={pointB} icon={pointBIcon}>
              <Popup>
                <strong>Điểm B (Đích)</strong>
              </Popup>
            </Marker>
          )}

          {/* Straight line A-B */}
          {straightLine && <Polyline positions={straightLine} color="#6b7280" weight={3} opacity={0.5} dashArray="10, 10" />}

          {/* Route path */}
          {routePath && (
            <>
              {Array.isArray(routePath[0]) ? (
                <Polyline positions={routePath} color="red" weight={5} opacity={0.8} />
              ) : (
                <>
                  {/* Vẽ walk trước */}
                  {routePath.filter(p => p.type === 'walk').map((path, idx) => (
                    <Polyline
                      key={`walk-${idx}`}
                      positions={path.coords}
                      color="#6b7280"
                      weight={5}
                      opacity={0.7}
                    />
                  ))}
                  {/* Vẽ bus sau để đè lên trên */}
                  {routePath.filter(p => p.type === 'bus').map((path, idx) => (
                    <Polyline
                      key={`bus-${idx}`}
                      positions={path.coords}
                      color="#3b82f6"
                      weight={6}
                      opacity={0.8}
                    />
                  ))}
                </>
              )}
            </>
          )}

          {/* Transition markers */}
          {transitionPoints.map((point, idx) => {
            const icon = point.type === 'boarding' ? boardingIcon : point.type === 'alighting' ? alightingIcon : transferIcon;
            return (
              <Marker key={idx} position={point.position} icon={icon}>
                <Popup>{point.label}</Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Detail modal */}
      {detailView && (
        <div className="modal-overlay" onClick={() => setDetailView(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setDetailView(null)}>
              ×
            </button>

            {detailView.type === 'stop' && (
              <div>
                <h2>🚏 {detailView.data.stop_name || detailView.data.stop_id}</h2>
                <p>
                  <strong>ID:</strong> {detailView.data.stop_id}
                </p>
                <p>
                  <strong>Tọa độ:</strong> {detailView.data.stop_lat}, {detailView.data.stop_lon}
                </p>

                <h3>Các tuyến đi qua:</h3>
                <div className="routes-list">
                  {detailView.data.routes &&
                    detailView.data.routes.map((route) => (
                      <div key={route.route_id} className="route-badge">
                        {route.route_short_name || route.route_id}: {route.route_long_name}
                      </div>
                    ))}
                </div>

                <div className="modal-actions">
                  <button
                    onClick={() => {
                      setFlyToLocation({
                        location: { lat: parseFloat(detailView.data.stop_lat), lng: parseFloat(detailView.data.stop_lon) },
                        zoom: 17,
                      });
                      setDetailView(null);
                    }}
                    className="btn btn-primary"
                  >
                    📍 Focus trên bản đồ
                  </button>
                  <button
                    onClick={() => {
                      setPointB({ lat: parseFloat(detailView.data.stop_lat), lng: parseFloat(detailView.data.stop_lon) });
                      if (pointA) setStraightLine([[pointA.lat, pointA.lng], [parseFloat(detailView.data.stop_lat), parseFloat(detailView.data.stop_lon)]]);
                      setDetailView(null);
                    }}
                    className="btn btn-success"
                  >
                    🗺️ Đặt làm điểm B
                  </button>
                </div>
              </div>
            )}

            {detailView.type === 'route' && (
              <div>
                <h2>🚍 Tuyến {detailView.data.route_short_name || detailView.data.route_id}</h2>
                <p>
                  <strong>Tên đầy đủ:</strong> {detailView.data.route_long_name}
                </p>

                <h3>Các điểm dừng ({detailView.data.stops?.length || 0}):</h3>
                <div className="stops-list">
                  {detailView.data.stops &&
                    detailView.data.stops.map((stop, idx) => (
                      <div key={stop.stop_id} className="stop-item">
                        <span className="stop-sequence">{idx + 1}</span>
                        <span>{stop.stop_name || stop.stop_id}</span>
                        <button
                          onClick={() => {
                            setFlyToLocation({ location: { lat: parseFloat(stop.stop_lat), lng: parseFloat(stop.stop_lon) }, zoom: 17 });
                          }}
                          className="btn btn-sm"
                        >
                          📍
                        </button>
                      </div>
                    ))}
                </div>

                <div className="modal-actions">
                  <button
                    onClick={() => {
                      setSelectedRoute(detailView.data);
                      setDetailView(null);
                    }}
                    className="btn btn-primary"
                  >
                    🗺️ Hiển thị tuyến trên bản đồ
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Dialog xác nhận chọn điểm */}
      {pendingPoint && (
        <div className="modal-overlay" onClick={cancelPoint}>
          <div className="confirmation-dialog" onClick={(e) => e.stopPropagation()}>
            <h3>📍 Xác nhận chọn điểm</h3>
            <p>Bạn có muốn chọn vị trí này làm <strong>Điểm {pendingPoint.mode}</strong> không?</p>
            <div className="dialog-actions">
              <button onClick={confirmPoint} className="btn btn-success">
                ✓ Chọn làm Điểm {pendingPoint.mode}
              </button>
              <button onClick={cancelPoint} className="btn btn-secondary">
                ✕ Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;