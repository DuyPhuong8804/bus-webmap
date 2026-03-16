const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ====== Postgres ======
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// ============================
// ====== In-memory cache =====
// ============================
let stopsData = [];
let routesData = [];

const stopsById = new Map();   // stop_id -> stop row
const routesById = new Map();  // route_id -> route row

// routeStopsMap[route_id] = Set(stop_id)
let routeStopsMap = {};
// stopRoutesMap[stop_id] = [route_id,...]
let stopRoutesMap = {};

// busAdj[stop_id] = [{ toStopId, route_id, distKm }]
let busAdj = {};

// Spatial index for "walking/transfer" neighbors
let gridIndex = new Map();
const GRID_DEG = 0.003; // ~300m cell (lat); good for transfer radius ~200-300m

// ============================
// ====== Utils =====
// ============================
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toFloat(x) {
  const n = parseFloat(x);
  return Number.isFinite(n) ? n : null;
}

function getDirectionSuffix(routeId) {
  if (typeof routeId !== 'string') return '';
  if (routeId.endsWith('_1')) return ' (đi)';
  if (routeId.endsWith('_2')) return ' (về)';
  return '';
}

function getRouteLabel(routeId) {
  const route = routesById.get(routeId);
  const shortName = route?.route_short_name?.trim();
  if (shortName) return shortName + getDirectionSuffix(routeId);

  const m = String(routeId).match(/^(\d+[A-Z]?)/);
  const base = m ? m[1] : String(routeId);
  return base + getDirectionSuffix(routeId);
}

function getRouteName(routeId) {
  const route = routesById.get(routeId);
  return (
    route?.route_long_name ||
    route?.route_short_name ||
    `Tuyến ${getRouteLabel(routeId)}`
  );
}

function uniqueBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = keyFn(x);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
}

function clusterKeyByStopId(stopId, decimals = 4) {
  const s = stopsById.get(stopId);
  if (!s) return String(stopId);
  const lat = toFloat(s.stop_lat);
  const lon = toFloat(s.stop_lon);
  if (lat == null || lon == null) return String(stopId);
  return `${lat.toFixed(decimals)},${lon.toFixed(decimals)}`;
}

function stopName(stopId) {
  const s = stopsById.get(stopId);
  return s?.stop_name || stopId;
}

// ============================
// ===== Spatial index =====
// ============================
function cellKey(lat, lon) {
  const cx = Math.floor(lat / GRID_DEG);
  const cy = Math.floor(lon / GRID_DEG);
  return `${cx}:${cy}`;
}

function buildGridIndex() {
  gridIndex = new Map();
  for (const s of stopsData) {
    const lat = toFloat(s.stop_lat);
    const lon = toFloat(s.stop_lon);
    if (lat == null || lon == null) continue;
    const k = cellKey(lat, lon);
    if (!gridIndex.has(k)) gridIndex.set(k, []);
    gridIndex.get(k).push(s.stop_id);
  }
}

function getStopsWithinRadius(lat, lon, radiusKm, limit = 200) {
  const deg = radiusKm / 111; // approx
  const steps = Math.max(1, Math.ceil(deg / GRID_DEG));

  const cx = Math.floor(lat / GRID_DEG);
  const cy = Math.floor(lon / GRID_DEG);

  const out = [];
  for (let dx = -steps; dx <= steps; dx++) {
    for (let dy = -steps; dy <= steps; dy++) {
      const k = `${cx + dx}:${cy + dy}`;
      const ids = gridIndex.get(k);
      if (!ids) continue;
      for (const stopId of ids) {
        const s = stopsById.get(stopId);
        if (!s) continue;
        const slat = toFloat(s.stop_lat);
        const slon = toFloat(s.stop_lon);
        if (slat == null || slon == null) continue;
        const d = haversineKm(lat, lon, slat, slon);
        if (d <= radiusKm) {
          out.push({ stopId, distance: d });
          if (out.length >= limit) break;
        }
      }
      if (out.length >= limit) break;
    }
    if (out.length >= limit) break;
  }

  out.sort((a, b) => a.distance - b.distance);
  return out;
}

function getStopToStopWalkNeighbors(stopId, radiusKm, limit = 50) {
  const s = stopsById.get(stopId);
  if (!s) return [];
  const lat = toFloat(s.stop_lat);
  const lon = toFloat(s.stop_lon);
  if (lat == null || lon == null) return [];
  const near = getStopsWithinRadius(lat, lon, radiusKm, limit + 5);
  return near
    .filter(x => x.stopId !== stopId)
    .slice(0, limit);
}

// ============================
// ===== Priority Queue =====
// ============================
class MinHeap {
  constructor() {
    this.arr = [];
  }
  size() { return this.arr.length; }
  push(item) {
    this.arr.push(item);
    this._up(this.arr.length - 1);
  }
  pop() {
    if (this.arr.length === 0) return null;
    const top = this.arr[0];
    const last = this.arr.pop();
    if (this.arr.length > 0) {
      this.arr[0] = last;
      this._down(0);
    }
    return top;
  }
  _up(i) {
    while (i > 0) {
      const p = Math.floor((i - 1) / 2);
      if (this.arr[p].cost <= this.arr[i].cost) break;
      [this.arr[p], this.arr[i]] = [this.arr[i], this.arr[p]];
      i = p;
    }
  }
  _down(i) {
    const n = this.arr.length;
    while (true) {
      let m = i;
      const l = 2 * i + 1;
      const r = 2 * i + 2;
      if (l < n && this.arr[l].cost < this.arr[m].cost) m = l;
      if (r < n && this.arr[r].cost < this.arr[m].cost) m = r;
      if (m === i) break;
      [this.arr[m], this.arr[i]] = [this.arr[i], this.arr[m]];
      i = m;
    }
  }
}

// ============================
// ===== Load caches from DB =====
// ============================
async function loadCachesFromDB() {
  console.log('Loading data from Postgres...');

  // 1) Stops
  {
    const { rows } = await pool.query(`
      SELECT stop_id, stop_name, stop_desc, stop_lat, stop_lon, zone_id, stop_url
      FROM stops
    `);
    stopsData = rows;
    stopsById.clear();
    for (const s of stopsData) stopsById.set(s.stop_id, s);
  }

  // 2) Routes
  {
    const { rows } = await pool.query(`
      SELECT route_id, agency_id, route_short_name, route_long_name, route_desc,
             route_type, route_url, route_color, route_text_color
      FROM routes
    `);
    routesData = rows;
    routesById.clear();
    for (const r of routesData) routesById.set(r.route_id, r);
  }

  // 3) routeStopsMap + stopRoutesMap
  routeStopsMap = {};
  stopRoutesMap = {};

  let pairs = [];
  try {
    const { rows } = await pool.query(`SELECT route_id, stop_id FROM route_stops`);
    pairs = rows;
    console.log(`Loaded route_stops pairs: ${pairs.length}`);
  } catch (e) {
    console.warn('route_stops not found, fallback to join trips + stop_times...');
    const { rows } = await pool.query(`
      SELECT DISTINCT t.route_id, st.stop_id
      FROM stop_times st
      JOIN trips t ON t.trip_id = st.trip_id
      WHERE t.route_id IS NOT NULL AND st.stop_id IS NOT NULL
    `);
    pairs = rows;
    console.log(`Loaded pairs from join: ${pairs.length}`);
  }

  for (const { route_id, stop_id } of pairs) {
    if (!routeStopsMap[route_id]) routeStopsMap[route_id] = new Set();
    routeStopsMap[route_id].add(stop_id);

    if (!stopRoutesMap[stop_id]) stopRoutesMap[stop_id] = [];
    stopRoutesMap[stop_id].push(route_id);
  }

  // 4) Build busAdj based on ONE representative trip per route (directed by stop_sequence)
  busAdj = {};
  const rep = await pool.query(`
    WITH rep AS (
      SELECT DISTINCT ON (route_id) route_id, trip_id
      FROM trips
      WHERE route_id IS NOT NULL
      ORDER BY route_id, trip_id
    )
    SELECT rep.route_id, st.stop_id, st.stop_sequence::int AS seq
    FROM rep
    JOIN stop_times st ON st.trip_id = rep.trip_id
    WHERE st.stop_id IS NOT NULL AND st.stop_sequence IS NOT NULL
    ORDER BY rep.route_id, st.stop_sequence::int ASC
  `);

  // group by route_id
  const routeToStops = new Map();
  for (const row of rep.rows) {
    const rid = row.route_id;
    if (!routeToStops.has(rid)) routeToStops.set(rid, []);
    routeToStops.get(rid).push({ stop_id: row.stop_id, seq: row.seq });
  }

  // build edges
  let edgeCount = 0;
  for (const [rid, arr] of routeToStops.entries()) {
    // arr is already ordered by seq
    for (let i = 0; i < arr.length - 1; i++) {
      const a = arr[i].stop_id;
      const b = arr[i + 1].stop_id;

      const sa = stopsById.get(a);
      const sb = stopsById.get(b);
      if (!sa || !sb) continue;

      const alat = toFloat(sa.stop_lat);
      const alon = toFloat(sa.stop_lon);
      const blat = toFloat(sb.stop_lat);
      const blon = toFloat(sb.stop_lon);
      if (alat == null || alon == null || blat == null || blon == null) continue;

      const distKm = haversineKm(alat, alon, blat, blon);
      if (!busAdj[a]) busAdj[a] = [];
      busAdj[a].push({ toStopId: b, route_id: rid, distKm });
      edgeCount++;
    }
  }

  // 5) Spatial index
  buildGridIndex();

  console.log('Cache ready:', {
    stops: stopsData.length,
    routes: routesData.length,
    routeKeys: Object.keys(routeStopsMap).length,
    stopKeys: Object.keys(stopRoutesMap).length,
    busEdges: edgeCount,
    gridCells: gridIndex.size,
  });
}

// ============================
// ===== Fetch helper =====
// ============================
async function getFetch() {
  if (global.fetch) return global.fetch;
  const mod = await import('node-fetch');
  return mod.default;
}

// ============================
// ===== Basic endpoints =====
// ============================
app.get('/', (req, res) => {
  res.json({
    message: 'Hanoi Bus WebMap API',
    version: '3.0.0',
    endpoints: {
      stops: '/api/stops?limit=5000&offset=0',
      routes: '/api/routes',
      stopDetail: '/api/stops/:stopId',
      routeDetail: '/api/routes/:routeId',
      nearbyStops: '/api/stops/nearby/:lat/:lon?limit=5',
      geocode: '/api/geocode?q=...',
      reverseGeocode: '/api/reverse-geocode/:lat/:lon',
      routing: '/api/route/:fromLat/:fromLon/:toLat/:toLon',
      transit: '/api/transit-route/:fromLat/:fromLon/:toLat/:toLon?maxTransfers=3&walkRadiusKm=1&transferRadiusKm=0.2',
    },
    dataLoaded: {
      stops: stopsData.length,
      routes: routesData.length
    }
  });
});

app.get('/api/stops', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '5000', 10), 5000);
  const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
  res.json(stopsData.slice(offset, offset + limit));
});

app.get('/api/routes', (req, res) => {
  res.json(routesData);
});

app.get('/api/stops/:stopId', async (req, res) => {
  try {
    const stopId = req.params.stopId;
    const stop = stopsById.get(stopId);
    if (!stop) return res.status(404).json({ error: 'Stop not found' });

    const { rows: routes } = await pool.query(
      `
      SELECT DISTINCT r.route_id, r.route_short_name, r.route_long_name, r.route_type
      FROM routes r
      JOIN trips t ON t.route_id = r.route_id
      JOIN stop_times st ON st.trip_id = t.trip_id
      WHERE st.stop_id = $1
      ORDER BY r.route_id
      `,
      [stopId]
    );

    res.json({ ...stop, routes });
  } catch (error) {
    console.error('Stop detail error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/routes/:routeId', async (req, res) => {
  try {
    const routeId = req.params.routeId;
    const route = routesById.get(routeId);
    if (!route) return res.status(404).json({ error: 'Route not found' });

    const tripRes = await pool.query(
      `SELECT trip_id FROM trips WHERE route_id = $1 ORDER BY trip_id LIMIT 1`,
      [routeId]
    );

    if (tripRes.rowCount === 0) {
      return res.json({ ...route, stops: [] });
    }

    const tripId = tripRes.rows[0].trip_id;

    const { rows: stops } = await pool.query(
      `
      SELECT s.stop_id, s.stop_name, s.stop_desc, s.stop_lat, s.stop_lon,
             st.stop_sequence AS sequence
      FROM stop_times st
      JOIN stops s ON s.stop_id = st.stop_id
      WHERE st.trip_id = $1
      ORDER BY st.stop_sequence::int ASC
      `,
      [tripId]
    );

    res.json({ ...route, stops });
  } catch (error) {
    console.error('Route detail error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/stops/nearby/:lat/:lon', (req, res) => {
  const lat = parseFloat(req.params.lat);
  const lon = parseFloat(req.params.lon);
  const limit = parseInt(req.query.limit) || 5;

  const near = getStopsWithinRadius(lat, lon, 2, 500); // scan in 2km, then take top limit
  const out = near.slice(0, limit).map(x => {
    const s = stopsById.get(x.stopId);
    return { ...s, distance: x.distance };
  });

  res.json(out);
});

app.get('/api/reverse-geocode/:lat/:lon', async (req, res) => {
  try {
    const { lat, lon } = req.params;
    const fetch = await getFetch();
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&accept-language=vi`,
      { headers: { 'User-Agent': 'HanoiBusWebMap/1.0' } }
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Geocoding failed' });
  }
});

app.get('/api/geocode', async (req, res) => {
  try {
    const query = req.query.q || '';
    const fetch = await getFetch();
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=vn&accept-language=vi&limit=5`,
      { headers: { 'User-Agent': 'HanoiBusWebMap/1.0' } }
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Geocoding failed' });
  }
});

app.get('/api/route/:fromLat/:fromLon/:toLat/:toLon', async (req, res) => {
  try {
    const { fromLat, fromLon, toLat, toLon } = req.params;
    const fetch = await getFetch();
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson&steps=true`
    );
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Routing failed' });
  }
});

// ============================
// ===== Transit routing (Dijkstra on state graph) =====
// ============================
function stateKey(node, lastRoute, transfers) {
  return `${node}|${lastRoute || ''}|${transfers}`;
}

function getNodeLocation(node, from, to) {
  if (node === 'A') return { lat: from.lat, lon: from.lon, name: 'Điểm A' };
  if (node === 'B') return { lat: to.lat, lon: to.lon, name: 'Điểm B' };
  const s = stopsById.get(node);
  return {
    lat: toFloat(s?.stop_lat),
    lon: toFloat(s?.stop_lon),
    name: s?.stop_name || node,
    stop_id: node,
  };
}

function compressEdgesToLegs(edges, from, to) {
  // edges: [{type:'walk'|'bus', fromNode, toNode, distKm, route_id?}]
  const legs = [];
  let i = 0;

  while (i < edges.length) {
    const e = edges[i];

    if (e.type === 'bus') {
      const route_id = e.route_id;
      const startFrom = e.fromNode;
      let endTo = e.toNode;
      let dist = e.distKm;

      let j = i + 1;
      while (j < edges.length && edges[j].type === 'bus' && edges[j].route_id === route_id) {
        dist += edges[j].distKm;
        endTo = edges[j].toNode;
        j++;
      }

      const fromLoc = getNodeLocation(startFrom, from, to);
      const toLoc = getNodeLocation(endTo, from, to);

      legs.push({
        type: 'bus',
        route_id,
        routeNumber: getRouteLabel(route_id),
        routeName: getRouteName(route_id),
        from: fromLoc,
        to: toLoc,
        distance: dist
      });

      i = j;
      continue;
    }

    // walk
    {
      let startFrom = e.fromNode;
      let endTo = e.toNode;
      let dist = e.distKm;

      let j = i + 1;
      while (j < edges.length && edges[j].type === 'walk') {
        dist += edges[j].distKm;
        endTo = edges[j].toNode;
        j++;
      }

      const fromLoc = getNodeLocation(startFrom, from, to);
      const toLoc = getNodeLocation(endTo, from, to);

      legs.push({
        type: 'walk',
        from: fromLoc,
        to: toLoc,
        distance: dist
      });

      i = j;
    }
  }

  // Convert “walk between bus legs” into transfer leg (optional but giúp UI đẹp hơn)
  // If a walk leg is between bus legs => mark as transfer
  for (let k = 0; k < legs.length; k++) {
    if (legs[k].type !== 'walk') continue;
    const prev = legs[k - 1];
    const next = legs[k + 1];
    if (prev?.type === 'bus' && next?.type === 'bus') {
      legs[k].type = 'transfer';
      legs[k].from = {
        ...legs[k].from,
        name: `Chuyển tuyến tại ${legs[k].from.name || ''}`.trim()
      };
    }
  }

  return legs;
}

function buildRouteSummary(legs, costMinutes, maxTransfers) {
  const busLegs = legs.filter(l => l.type === 'bus');
  const transfers = Math.max(0, busLegs.length - 1);

  if (transfers > maxTransfers) return null;

  let walkToStop = 0;
  let walkFromStop = 0;
  let walkTotal = 0;
  let busDistance = 0;

  for (const l of legs) {
    if (l.type === 'bus') busDistance += l.distance;
    if (l.type === 'walk') walkTotal += l.distance;
    if (l.type === 'transfer') walkTotal += l.distance; // transfer is still walking
  }

  // first “walk” from A
  const firstWalk = legs.find(l => l.type === 'walk' && l.from?.name === 'Điểm A');
  if (firstWalk) walkToStop = firstWalk.distance;

  // last “walk” to B
  for (let i = legs.length - 1; i >= 0; i--) {
    const l = legs[i];
    if ((l.type === 'walk') && l.to?.name === 'Điểm B') {
      walkFromStop = l.distance;
      break;
    }
  }

  const totalDistance = walkTotal + busDistance;

  return {
    type: transfers === 0 ? 'direct' : `${transfers}-transfer`,
    transfers,
    walkToStop,
    walkFromStop,
    walkTotal,        // <<< thêm để frontend hiển thị tổng đi bộ đúng
    busDistance,
    totalDistance,
    estimatedTime: Math.round(costMinutes),
    legs
  };
}

function dedupAndAttachAlternatives(candidateRoutes) {
  // group by signature of bus legs using CLUSTER KEY (tọa độ làm tròn)
  const groups = new Map();

  for (const r of candidateRoutes) {
    const busLegs = r.legs.filter(l => l.type === 'bus');
    const sig = [
      r.transfers,
      ...busLegs.map(l => `${clusterKeyByStopId(l.from.stop_id)}->${clusterKeyByStopId(l.to.stop_id)}`)
    ].join('|');

    if (!groups.has(sig)) {
      groups.set(sig, {
        best: r,
        altsByLeg: busLegs.map(() => new Map()), // idx -> route_id -> info
      });
    }
    const g = groups.get(sig);

    if (r.estimatedTime < g.best.estimatedTime) g.best = r;

    busLegs.forEach((leg, idx) => {
      if (leg.route_id) {
        g.altsByLeg[idx].set(leg.route_id, {
          route_id: leg.route_id,
          routeNumber: getRouteLabel(leg.route_id),
          routeName: getRouteName(leg.route_id),
        });
      }
    });
  }

  const out = [];
  for (const g of groups.values()) {
    const best = JSON.parse(JSON.stringify(g.best));
    const busLegs = best.legs.filter(l => l.type === 'bus');

    busLegs.forEach((leg, idx) => {
      const alts = Array.from(g.altsByLeg[idx].values());
      leg.availableRoutes = alts;

      const uniqueNums = uniqueBy(alts, x => x.routeNumber).map(x => x.routeNumber);
      if (uniqueNums.length > 1) {
        leg.routeNumber =
          uniqueNums.slice(0, 4).join(' / ') +
          (uniqueNums.length > 4 ? ` (+${uniqueNums.length - 4})` : '');
        leg.routeName = `Có thể đi: ${uniqueNums.join(', ')}`;
      }
    });

    out.push(best);
  }

  // sort: ưu tiên ít transfers, rồi ít đi bộ, rồi thời gian
  out.sort((a, b) => {
    if (a.transfers !== b.transfers) return a.transfers - b.transfers;
    if (Math.abs(a.walkTotal - b.walkTotal) > 0.05) return a.walkTotal - b.walkTotal;
    return a.estimatedTime - b.estimatedTime;
  });

  return out;
}

function dijkstraK(from, to, options) {
  const {
    maxTransfers,
    kResults,
    walkRadiusKm,
    transferRadiusKm,
    endRadiusKm,
    walkMinPerKm,
    busMinPerKm,
    transferMinPenalty,
    maxExpandedStates,
  } = options;

  const pq = new MinHeap();

  const dist = new Map();      // stateKey -> bestCost
  const prev = new Map();      // stateKey -> { prevKey, edge }
  const results = [];

  const startKey = stateKey('A', null, 0);
  dist.set(startKey, 0);
  pq.push({
    cost: 0,
    node: 'A',
    lastRoute: null,
    transfers: 0
  });

  let expanded = 0;

  while (pq.size() > 0) {
    const cur = pq.pop();
    const curKey = stateKey(cur.node, cur.lastRoute, cur.transfers);

    const best = dist.get(curKey);
    if (best == null || cur.cost !== best) continue;

    expanded++;
    if (expanded > maxExpandedStates) break;

    if (cur.node === 'B') {
      // reconstruct edges
      const edges = [];
      let k = curKey;
      while (k !== startKey) {
        const p = prev.get(k);
        if (!p) break;
        edges.push(p.edge);
        k = p.prevKey;
      }
      edges.reverse();

      const legs = compressEdgesToLegs(edges, from, to);
      const summary = buildRouteSummary(legs, cur.cost, maxTransfers);
      if (summary) results.push(summary);

      if (results.length >= kResults) break;
      continue;
    }

    // neighbors
    const neighbors = [];

    if (cur.node === 'A') {
      // walk from A to nearby stops
      const near = getStopsWithinRadius(from.lat, from.lon, walkRadiusKm, 200)
        .slice(0, 20); // limit start branching
      for (const x of near) {
        neighbors.push({
          type: 'walk',
          fromNode: 'A',
          toNode: x.stopId,
          distKm: x.distance
        });
      }
    } else if (cur.node !== 'B') {
      // 1) bus edges
      const busEdges = busAdj[cur.node] || [];
      for (const e of busEdges) {
        neighbors.push({
          type: 'bus',
          fromNode: cur.node,
          toNode: e.toStopId,
          distKm: e.distKm,
          route_id: e.route_id
        });
      }

      // 2) transfer walking edges between close stops
      const walkNeighbors = getStopToStopWalkNeighbors(cur.node, transferRadiusKm, 30);
      for (const w of walkNeighbors) {
        neighbors.push({
          type: 'walk',
          fromNode: cur.node,
          toNode: w.stopId,
          distKm: w.distance
        });
      }

      // 3) walk to destination if close enough
      const s = stopsById.get(cur.node);
      const slat = toFloat(s?.stop_lat);
      const slon = toFloat(s?.stop_lon);
      if (slat != null && slon != null) {
        const dToB = haversineKm(slat, slon, to.lat, to.lon);
        if (dToB <= endRadiusKm) {
          neighbors.push({
            type: 'walk',
            fromNode: cur.node,
            toNode: 'B',
            distKm: dToB
          });
        }
      }
    }

    for (const e of neighbors) {
      if (e.type === 'bus') {
        const newLast = e.route_id;
        let newTransfers = cur.transfers;

        // count transfer when switching bus route (after having boarded once)
        if (cur.lastRoute && newLast !== cur.lastRoute) {
          newTransfers += 1;
        }

        if (newTransfers > maxTransfers) continue;

        const rideCost = e.distKm * busMinPerKm;
        const transferPenalty = (cur.lastRoute && newLast !== cur.lastRoute) ? transferMinPenalty : 0;

        const newCost = cur.cost + rideCost + transferPenalty;
        const nk = stateKey(e.toNode, newLast, newTransfers);

        if (!dist.has(nk) || newCost < dist.get(nk)) {
          dist.set(nk, newCost);
          prev.set(nk, { prevKey: curKey, edge: e });
          pq.push({
            cost: newCost,
            node: e.toNode,
            lastRoute: newLast,
            transfers: newTransfers
          });
        }
      } else {
        // walk/transfer walk keeps lastRoute (to count switching when board next bus)
        const walkCost = e.distKm * walkMinPerKm;
        const newCost = cur.cost + walkCost;
        const nk = stateKey(e.toNode, cur.lastRoute, cur.transfers);

        if (!dist.has(nk) || newCost < dist.get(nk)) {
          dist.set(nk, newCost);
          prev.set(nk, { prevKey: curKey, edge: e });
          pq.push({
            cost: newCost,
            node: e.toNode,
            lastRoute: cur.lastRoute,
            transfers: cur.transfers
          });
        }
      }
    }
  }

  return results;
}

// ===== Transit API =====
app.get('/api/transit-route/:fromLat/:fromLon/:toLat/:toLon', (req, res) => {
  try {
    const from = {
      lat: parseFloat(req.params.fromLat),
      lon: parseFloat(req.params.fromLon),
    };
    const to = {
      lat: parseFloat(req.params.toLat),
      lon: parseFloat(req.params.toLon),
    };

    // options (you can tune from frontend by query params)
    const maxTransfers = Math.min(Math.max(parseInt(req.query.maxTransfers || '3', 10), 0), 3);
    const kResults = Math.min(Math.max(parseInt(req.query.k || '10', 10), 1), 3);

    const walkRadiusKm = Math.min(Math.max(parseFloat(req.query.walkRadiusKm || '1'), 0.2), 2.0);       // A->stop
    const endRadiusKm = Math.min(Math.max(parseFloat(req.query.endRadiusKm || '0.8'), 0.2), 2.0);        // stop->B
    const transferRadiusKm = Math.min(Math.max(parseFloat(req.query.transferRadiusKm || '0.2'), 0.05), 0.5); // stop<->stop

    // Cost weights (minutes):
    // Walking is expensive to force "ít đi bộ"
    const walkMinPerKm = Math.min(Math.max(parseFloat(req.query.walkMinPerKm || '12'), 10), 40);   // default 12 min/km
    const busMinPerKm = Math.min(Math.max(parseFloat(req.query.busMinPerKm || '3'), 1), 10);       // default 3 min/km
    const transferMinPenalty = Math.min(Math.max(parseFloat(req.query.transferMin || '6'), 0), 15); // default 6 min each transfer

    const directKm = haversineKm(from.lat, from.lon, to.lat, to.lon);

    // quick “sanity”: if A & B too close -> just suggest walking
    if (directKm < 0.3) {
      return res.json({
        from, to,
        routes: [{
          type: 'walk-only',
          transfers: 0,
          walkToStop: directKm,
          walkFromStop: 0,
          walkTotal: directKm,
          busDistance: 0,
          totalDistance: directKm,
          estimatedTime: Math.round(directKm * 12),
          legs: [{
            type: 'walk',
            from: { lat: from.lat, lon: from.lon, name: 'Điểm A' },
            to: { lat: to.lat, lon: to.lon, name: 'Điểm B' },
            distance: directKm
          }]
        }],
        message: 'Điểm A và B rất gần nhau, nên đi bộ là hợp lý nhất.'
      });
    }

    const candidates = dijkstraK(from, to, {
      maxTransfers,
      kResults: 50, // get more, then dedup to top kResults
      walkRadiusKm,
      transferRadiusKm,
      endRadiusKm,
      walkMinPerKm,
      busMinPerKm,
      transferMinPenalty,
      maxExpandedStates: 60000,
    });

    const deduped = dedupAndAttachAlternatives(candidates).slice(0, kResults);

    return res.json({
      from, to,
      routes: deduped,
      message: deduped.length === 0
        ? 'Không tìm thấy tuyến phù hợp (hãy thử tăng walkRadiusKm / endRadiusKm hoặc giảm yêu cầu maxTransfers).'
        : 'OK',
      debug: {
        directKm: Number(directKm.toFixed(2)),
        params: { maxTransfers, kResults, walkRadiusKm, endRadiusKm, transferRadiusKm, walkMinPerKm, busMinPerKm, transferMinPenalty }
      }
    });
  } catch (err) {
    console.error('Transit error:', err);
    res.status(500).json({ error: 'Transit routing failed' });
  }
});

// ============================
// ===== Start server =====
// ============================
async function main() {
  await pool.query('SELECT 1');
  await loadCachesFromDB();
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}

main().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
