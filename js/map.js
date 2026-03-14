(function () {
  const PandaTD = (window.PandaTD = window.PandaTD || {});

  PandaTD.MAPS = [
    {
      id: "bambooBend",
      name: "Bamboo Bend",
      description: "A polished winding valley with ponds, bridges, and broad grassy build zones.",
      width: 1024,
      height: 640,
      pathWidth: 70,
      pathPoints: [
        { x: 0, y: 110 },
        { x: 160, y: 110 },
        { x: 240, y: 210 },
        { x: 420, y: 210 },
        { x: 520, y: 88 },
        { x: 760, y: 88 },
        { x: 860, y: 242 },
        { x: 700, y: 388 },
        { x: 420, y: 388 },
        { x: 340, y: 540 },
        { x: 640, y: 540 },
        { x: 760, y: 450 },
        { x: 1024, y: 450 }
      ],
      water: [
        { x: 622, y: 240, rx: 92, ry: 54 },
        { x: 210, y: 432, rx: 84, ry: 62 },
        { x: 864, y: 540, rx: 96, ry: 58 }
      ],
      decorations: {
        bambooClusters: [
          { x: 86, y: 42, s: 1.1 },
          { x: 932, y: 124, s: 1.25 },
          { x: 124, y: 560, s: 1.1 },
          { x: 930, y: 328, s: 1.05 },
          { x: 520, y: 286, s: 0.9 },
          { x: 536, y: 602, s: 1.05 }
        ],
        rocks: [
          { x: 340, y: 82, s: 1.2 },
          { x: 572, y: 185, s: 0.9 },
          { x: 758, y: 317, s: 1 },
          { x: 174, y: 272, s: 1.15 },
          { x: 768, y: 594, s: 0.85 }
        ],
        flowers: [
          { x: 430, y: 90, s: 1 },
          { x: 112, y: 230, s: 1.1 },
          { x: 914, y: 245, s: 1.1 },
          { x: 450, y: 475, s: 0.95 },
          { x: 652, y: 332, s: 0.95 }
        ]
      }
    }
  ];

  PandaTD.MapUtils = {
    pointToSegmentDistance(px, py, ax, ay, bx, by) {
      const abx = bx - ax;
      const aby = by - ay;
      const apx = px - ax;
      const apy = py - ay;
      const denom = abx * abx + aby * aby || 1;
      const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / denom));
      const cx = ax + abx * t;
      const cy = ay + aby * t;
      return Math.hypot(px - cx, py - cy);
    },

    buildPathCache(map) {
      const segments = [];
      let totalLength = 0;
      for (let i = 0; i < map.pathPoints.length - 1; i += 1) {
        const start = map.pathPoints[i];
        const end = map.pathPoints[i + 1];
        const length = Math.hypot(end.x - start.x, end.y - start.y);
        segments.push({ start, end, length, totalLength });
        totalLength += length;
      }
      return { segments, totalLength };
    },

    samplePoint(cache, distance) {
      const clamped = Math.max(0, Math.min(cache.totalLength, distance));
      for (let i = 0; i < cache.segments.length; i += 1) {
        const segment = cache.segments[i];
        if (clamped <= segment.totalLength + segment.length || i === cache.segments.length - 1) {
          const local = (clamped - segment.totalLength) / segment.length;
          return {
            x: segment.start.x + (segment.end.x - segment.start.x) * local,
            y: segment.start.y + (segment.end.y - segment.start.y) * local
          };
        }
      }
      return { x: cache.segments[0].start.x, y: cache.segments[0].start.y };
    },

    isPointOnPath(map, x, y, padding) {
      const threshold = map.pathWidth * 0.5 + (padding || 0);
      for (let i = 0; i < map.pathPoints.length - 1; i += 1) {
        const a = map.pathPoints[i];
        const b = map.pathPoints[i + 1];
        if (this.pointToSegmentDistance(x, y, a.x, a.y, b.x, b.y) <= threshold) {
          return true;
        }
      }
      return false;
    },

    isPointInWater(map, x, y, padding) {
      const extra = padding || 0;
      return map.water.some((pond) => {
        const dx = x - pond.x;
        const dy = y - pond.y;
        const rx = pond.rx + extra;
        const ry = pond.ry + extra;
        return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
      });
    },

    isNearWater(map, x, y, distance) {
      return map.water.some((pond) => {
        const dx = x - pond.x;
        const dy = y - pond.y;
        const rx = pond.rx + distance;
        const ry = pond.ry + distance;
        return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1;
      });
    }
  };
})();
