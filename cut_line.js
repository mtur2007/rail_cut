function findLineIntersection(a, b, c, d) {
  const denominator =
    (a.x - b.x) * (c.y - d.y) -
    (a.y - b.y) * (c.x - d.x);

  if (Math.abs(denominator) < 1e-10) {
    return {
      intersects: false,
      isParallel: true,
      point: null,
      onFirstSegment: false,
      onSecondSegment: false,
    };
  }

  const firstDeterminant = a.x * b.y - a.y * b.x;
  const secondDeterminant = c.x * d.y - c.y * d.x;
  const x =
    (firstDeterminant * (c.x - d.x) - (a.x - b.x) * secondDeterminant) /
    denominator;
  const y =
    (firstDeterminant * (c.y - d.y) - (a.y - b.y) * secondDeterminant) /
    denominator;

  const point = { x, y };
  const epsilon = 1e-10;
  const onFirstSegment =
    x >= Math.min(a.x, b.x) - epsilon &&
    x <= Math.max(a.x, b.x) + epsilon &&
    y >= Math.min(a.y, b.y) - epsilon &&
    y <= Math.max(a.y, b.y) + epsilon;
  const onSecondSegment =
    x >= Math.min(c.x, d.x) - epsilon &&
    x <= Math.max(c.x, d.x) + epsilon &&
    y >= Math.min(c.y, d.y) - epsilon &&
    y <= Math.max(c.y, d.y) + epsilon;

  return {
    intersects: true,
    isParallel: false,
    point,
    onFirstSegment,
    onSecondSegment,
  };
}

function solveRightTriangle(knownLeg, angleDeg, relation) {
  if (!Number.isFinite(knownLeg) || knownLeg <= 0) {
    throw new Error("knownLeg must be positive.");
  }
  if (!Number.isFinite(angleDeg) || !(angleDeg > 0 && angleDeg < 90)) {
    throw new Error("angleDeg must be between 0 and 90.");
  }
  if (relation !== "adjacent" && relation !== "opposite") {
    throw new Error("relation must be 'adjacent' or 'opposite'.");
  }

  const angleRad = angleDeg * Math.PI / 180;
  let adjacent;
  let opposite;
  let hypotenuse;

  if (relation === "adjacent") {
    adjacent = knownLeg;
    opposite = adjacent * Math.tan(angleRad);
    hypotenuse = adjacent / Math.cos(angleRad);
  } else {
    opposite = knownLeg;
    adjacent = opposite / Math.tan(angleRad);
    hypotenuse = opposite / Math.sin(angleRad);
  }

  return {
    adjacent,
    opposite,
    hypotenuse,
    otherAngleDeg: 90 - angleDeg,
  };
}

function findLineThickness(thickness) {
  if (!Number.isFinite(thickness) || thickness <= 0) {
    throw new Error("線の太さは 0 より大きい数にしてください。");
  }

  return Number(thickness);
}

function findCurrentLineThicknesses() {
  const widthAb = Number(document.getElementById("width-ab")?.value);
  const widthCd = Number(document.getElementById("width-cd")?.value);

  return {
    ab: findLineThickness(widthAb),
    cd: findLineThickness(widthCd),
  };
}

function findLineDirection(start, end) {
  if (
    !start ||
    !end ||
    !Number.isFinite(start.x) ||
    !Number.isFinite(start.y) ||
    !Number.isFinite(end.x) ||
    !Number.isFinite(end.y)
  ) {
    throw new Error("線の向きを求めるには有効な2点が必要です。");
  }

  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (Math.abs(dx) < 1e-10 && Math.abs(dy) < 1e-10) {
    throw new Error("同じ点どうしでは線の向きは求められません。");
  }

  const radians = Math.atan2(dy, dx);
  const degrees = radians * 180 / Math.PI;

  return {
    dx,
    dy,
    radians,
    degrees,
    normalizedRadians: normalizeRadian(radians),
    normalizedDegrees: normalizeAngle(degrees),
  };
}

function findCurrentLineDirections() {
  const { a, b, c, d } = readCurrentLinePoints();

  return {
    ab: findLineDirection(a, b),
    cd: findLineDirection(c, d),
  };
}

function normalizeAngle(angleDeg) {
  const normalized = angleDeg % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function normalizeRadian(angleRad) {
  const fullTurn = Math.PI * 2;
  const normalized = angleRad % fullTurn;
  return normalized < 0 ? normalized + fullTurn : normalized;
}

function findAngleDifference(angleA, angleB) {
  if (!Number.isFinite(angleA) || !Number.isFinite(angleB)) {
    throw new Error("角度は数値で指定してください。");
  }

  const normalizedA = normalizeAngle(angleA);
  const normalizedB = normalizeAngle(angleB);
  let difference = Math.abs(normalizedA - normalizedB);

  if (difference > 180) {
    difference = 360 - difference;
  }

  return difference;
}

function findRadianDifference(angleA, angleB) {
  if (!Number.isFinite(angleA) || !Number.isFinite(angleB)) {
    throw new Error("ラジアンは数値で指定してください。");
  }

  const normalizedA = normalizeRadian(angleA);
  const normalizedB = normalizeRadian(angleB);
  let difference = Math.abs(normalizedA - normalizedB);

  if (difference > Math.PI) {
    difference = Math.PI * 2 - difference;
  }

  return difference;
}

function normalizePoint(point, label) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new Error(`${label} の座標が不正です。`);
  }

  return {
    x: Number(point.x),
    y: Number(point.y),
  };
}

function addLengthAlongVector(former, angle, length) {
  const basePoint = normalizePoint(former, "former");
  const angleVector = normalizePoint(angle, "angle");

  if (!Number.isFinite(length) || length < 0) {
    throw new Error("length は 0 以上の数にしてください。");
  }

  const vectorLength = Math.hypot(angleVector.x, angleVector.y);
  if (vectorLength < 1e-10) {
    throw new Error("angle ベクトルの長さが 0 です。");
  }

  const unitX = angleVector.x / vectorLength;
  const unitY = angleVector.y / vectorLength;

  return {
    x: basePoint.x + unitX * length,
    y: basePoint.y + unitY * length,
  };
}

function createQuadrilateralFromVertices(a, b, c, d) {
  const pointA = normalizePoint(a, "A");
  const pointB = normalizePoint(b, "B");
  const pointC = normalizePoint(c, "C");
  const pointD = normalizePoint(d, "D");

  return {
    a: pointA,
    b: pointB,
    c: pointC,
    d: pointD,
    points: [pointA, pointB, pointC, pointD],
  };
}

function createTriangleFromVertices(a, b, c) {
  const pointA = normalizePoint(a, "A");
  const pointB = normalizePoint(b, "B");
  const pointC = normalizePoint(c, "C");

  return {
    a: pointA,
    b: pointB,
    c: pointC,
    points: [pointA, pointB, pointC],
  };
}

function drawQuadrilateralOnCanvas(a, b, c, d, options = {}) {
  const shape = createQuadrilateralFromVertices(a, b, c, d);
  if (typeof window.drawPolygonOnCanvas !== "function") {
    throw new Error("drawPolygonOnCanvas が見つかりません。line_builder.js の読み込み後に実行してください。");
  }
  return window.drawPolygonOnCanvas(shape.points, options);
}

function drawTriangleOnCanvas(a, b, c, options = {}) {
  const shape = createTriangleFromVertices(a, b, c);
  if (typeof window.drawPolygonOnCanvas !== "function") {
    throw new Error("drawPolygonOnCanvas が見つかりません。line_builder.js の読み込み後に実行してください。");
  }
  return window.drawPolygonOnCanvas(shape.points, options);
}

function readCurrentLinePoints() {
  const x1 = Number(document.getElementById("x1")?.value);
  const y1 = Number(document.getElementById("y1")?.value);
  const x2 = Number(document.getElementById("x2")?.value);
  const y2 = Number(document.getElementById("y2")?.value);
  const x3 = Number(document.getElementById("x3")?.value);
  const y3 = Number(document.getElementById("y3")?.value);
  const x4 = Number(document.getElementById("x4")?.value);
  const y4 = Number(document.getElementById("y4")?.value);

  const values = [x1, y1, x2, y2, x3, y3, x4, y4];
  if (values.some((value) => !Number.isFinite(value))) {
    throw new Error("交点計算に必要な座標入力が見つからないか、不正です。");
  }

  return {
    a: { x: x1, y: y1 },
    b: { x: x2, y: y2 },
    c: { x: x3, y: y3 },
    d: { x: x4, y: y4 },
  };
}

// 交点を求める
function findCurrentIntersection() {
  const { a, b, c, d } = readCurrentLinePoints();
  return findLineIntersection(a, b, c, d);
}

window.findLineIntersection = findLineIntersection;
window.solveRightTriangle = solveRightTriangle;
window.findLineThickness = findLineThickness;
window.findCurrentLineThicknesses = findCurrentLineThicknesses;
window.findLineDirection = findLineDirection;
window.findCurrentLineDirections = findCurrentLineDirections;
window.findAngleDifference = findAngleDifference;
window.findRadianDifference = findRadianDifference;
window.addLengthAlongVector = addLengthAlongVector;
window.createQuadrilateralFromVertices = createQuadrilateralFromVertices;
window.createTriangleFromVertices = createTriangleFromVertices;
window.drawQuadrilateralOnCanvas = drawQuadrilateralOnCanvas;
window.drawTriangleOnCanvas = drawTriangleOnCanvas;
window.findCurrentIntersection = findCurrentIntersection;


// 四角形
drawQuadrilateralOnCanvas(
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 120, y: 80 },
  { x: 20, y: 80 },
  { fill: "rgba(255, 120, 80, 0.2)", stroke: "#d9480f", strokeWidth: 4 }
)

// 三角形
drawTriangleOnCanvas(
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 50, y: 80 },
  { fill: "rgba(64, 136, 255, 0.2)", stroke: "#1f6feb", strokeWidth: 4 }
)
// 消す
// clearCanvasPolygons()

// 2つの角度の差を求める。
findRadianDifference(0, Math.PI / 2) 

// ２本の線の向きを取得
findCurrentLineDirections()

// 長さを求める関数(戻り値のhypotenuseを使用)
solveRightTriangle(10, 30, "adjacent")

// 線の太さ
const line_futosa = findCurrentLineThicknesses()['ab']

// 始点に、指定された向きへ、指定された長さ加算する
// addLengthAlongVector(former, angle, length)

function cut_line(){

    // const cut_range = solveRightTriangle(diff_angle, diff_range*2, "opposite")['hypotenuse']

    const line_angle = findCurrentLineDirections()
    const ab_angle = line_angle['ab']
    const cb_angle = line_angle['ab']

    const diff_angle = findRadianDifference(ab_angle, cb_angle)

    const cut_triangle = solveRightTriangle(diff_angle, line_futosa, "adjacent")
    const cut_range = cut_triangle.hypotenuse
    const space_range = cut_triangle.opposite

    const cross_point = findCurrentIntersection()

    const cut_0_point = addLengthAlongVector(cross_point, ab_angle, line_futosa*0.5) 
    const cut_1_point = addLengthAlongVector(cut_0_point, cb_angle, cut_range)
    const cut_2_point = addLengthAlongVector(cut_0_point, ab_angle, line_futosa)
    
    const cut_3_point = addLengthAlongVector(cut_1_point, ab_angle, space_range)
    const cut_4_point = addLengthAlongVector(cut_0_point, ab_angle, space_range)
    const cut_5_point = addLengthAlongVector(cut_4_point, ab_angle, line_futosa) 
}
