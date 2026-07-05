const SVG_NS = "http://www.w3.org/2000/svg";
const WIDTH = 720;
const HEIGHT = 520;
const PADDING = 60;
const DEFAULT_POINTS = {
  x1: 40,
  y1: 60,
  x2: 220,
  y2: 180,
  widthAb: 60,
  x3: 80,
  y3: 220,
  x4: 260,
  y4: 40,
  widthCd: 60,
};
const DEFAULT_VISIBILITY = {
  ab: true,
  cd: true,
};
const customPolygons = [];
const renderState = {
  view: null,
};
const dragState = {
  active: false,
  kind: "",
  key: "",
  polygonIndex: -1,
  pointIndex: -1,
};
let isRunningUserCode = false;
let userCodeExecutionMode = "";
let currentSearchTerm = "";
let activeSearchResultLine = 0;
let latestMainOutputText = "[return]\nここに実行結果が表示されます。";
let latestErrorOutputText = "[error]\nエラーはありません。";

const svg = document.getElementById("canvas");
const outputPreviewCanvas = document.getElementById("output-preview-canvas");
const outputDivider = document.getElementById("output-divider");
const errorOutputDivider = document.getElementById("error-output-divider");
const statusText = document.getElementById("status-text");
const codeInput = document.getElementById("code-input");
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");
const codeOutput = document.getElementById("code-output");
const codeErrorOutput = document.getElementById("code-error-output");
const codeSearchHighlights = document.getElementById("code-search-highlights");
const codeHighlights = document.getElementById("code-highlights");
const lineNumbers = document.getElementById("line-numbers");
const floatingRunnerFooter = document.querySelector(".floating-runner-footer");
const layout = document.querySelector(".layout");
const controlPanel = document.getElementById("control-panel");
const togglePanelButton = document.getElementById("toggle-panel-btn");
const runnerResizeHandle = document.getElementById("runner-resize-handle");
const fields = {
  x1: document.getElementById("x1"),
  y1: document.getElementById("y1"),
  x2: document.getElementById("x2"),
  y2: document.getElementById("y2"),
  widthAb: document.getElementById("width-ab"),
  x3: document.getElementById("x3"),
  y3: document.getElementById("y3"),
  x4: document.getElementById("x4"),
  y4: document.getElementById("y4"),
  widthCd: document.getElementById("width-cd"),
};
const visibilityControls = {
  ab: document.getElementById("show-ab"),
  cd: document.getElementById("show-cd"),
};

const output = {
  lineAB: document.getElementById("line-ab-text"),
  lineCD: document.getElementById("line-cd-text"),
  lengthAB: document.getElementById("length-ab-text"),
  lengthCD: document.getElementById("length-cd-text"),
  slopeAB: document.getElementById("slope-ab-text"),
  widthAB: document.getElementById("width-ab-text"),
  slopeCD: document.getElementById("slope-cd-text"),
  widthCD: document.getElementById("width-cd-text"),
  equationAB: document.getElementById("equation-ab-text"),
  equationCD: document.getElementById("equation-cd-text"),
  intersection: document.getElementById("intersection-text"),
  intersectionState: document.getElementById("intersection-state-text"),
};

function createSvgElement(tag, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, String(value));
  });
  return element;
}

function formatNumber(value) {
  return Number(value).toFixed(2).replace(/\.00$/, "");
}

function formatExecutionResult(value) {
  if (value === undefined) {
    return "undefined";
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch (_error) {
    return String(value);
  }
}

function formatConsoleArgs(args) {
  return args
    .map((value) => {
      if (typeof value === "string") {
        return value;
      }
      try {
        return JSON.stringify(value, null, 2);
      } catch (_error) {
        return String(value);
      }
    })
    .join(" ");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractUserCodeLineNumber(stack) {
  if (typeof stack !== "string") {
    return null;
  }

  const expressionMatch = stack.match(/codex-user-expression\.js:(\d+):\d+/);
  if (expressionMatch) {
    // `new Function()` adds 2 wrapper lines, and expression mode adds `return (`
    return Math.max(1, Number(expressionMatch[1]) - 3);
  }

  const statementMatch = stack.match(/codex-user-statement\.js:(\d+):\d+/);
  if (statementMatch) {
    const rawLine = Number(statementMatch[1]);
    if (userCodeExecutionMode === "eval-statement") {
      return Math.max(1, rawLine);
    }
    // `new Function()` adds 2 wrapper lines before the provided source
    return Math.max(1, rawLine - 2);
  }

  return null;
}

function extractUserCodeErrorLineNumber(error) {
  if (!(error instanceof Error) || typeof error.stack !== "string") {
    return null;
  }

  const expressionMatch = error.stack.match(/codex-user-expression\.js:(\d+):\d+/);
  if (expressionMatch) {
    return Math.max(1, Number(expressionMatch[1]) - 3);
  }

  const statementMatch = error.stack.match(/codex-user-statement\.js:(\d+):\d+/);
  if (statementMatch) {
    const rawLine = Number(statementMatch[1]);
    if (error instanceof SyntaxError) {
      // Syntax errors in statement mode come from `new Function()`.
      return Math.max(1, rawLine - 2);
    }
    // Runtime errors in statement mode now come from `eval()`,
    // so the sourceURL line maps directly to the user's code.
    return Math.max(1, rawLine);
  }

  return null;
}

function resizeCodeInput() {
  codeInput.style.height = "auto";
  codeInput.style.height = `${codeInput.scrollHeight}px`;
  lineNumbers.style.height = `${codeInput.scrollHeight}px`;
  codeHighlights.style.height = `${codeInput.clientHeight}px`;
  codeSearchHighlights.style.height = `${codeInput.clientHeight}px`;
}

function insertTabAtSelection() {
  const start = codeInput.selectionStart;
  const end = codeInput.selectionEnd;
  const value = codeInput.value;
  const tab = "  ";

  if (start === end) {
    codeInput.value = `${value.slice(0, start)}${tab}${value.slice(end)}`;
    codeInput.selectionStart = start + tab.length;
    codeInput.selectionEnd = start + tab.length;
  } else {
    const selected = value.slice(start, end);
    const indented = selected
      .split("\n")
      .map((line) => `${tab}${line}`)
      .join("\n");
    codeInput.value = `${value.slice(0, start)}${indented}${value.slice(end)}`;
    codeInput.selectionStart = start;
    codeInput.selectionEnd = start + indented.length;
  }

  updateLineNumbers();
  resizeCodeInput();
}

function updateLineNumbers() {
  const lines = codeInput.value.split("\n");
  let braceDepth = 0;
  let activeFunctionBaseDepth = null;
  const separatorLines = [];
  const searchTerm = currentSearchTerm.trim().toLowerCase();
  const markup = lines.map((line, index) => {
    const isFunctionStart = /^\s*function\b/.test(line);
    const openBraceCount = (line.match(/{/g) || []).length;
    const closeBraceCount = (line.match(/}/g) || []).length;

    if (isFunctionStart && activeFunctionBaseDepth === null) {
      activeFunctionBaseDepth = braceDepth;
    }

    const shouldHighlight = activeFunctionBaseDepth !== null;
    const classes = ["line-number"];
    if (shouldHighlight) {
      classes.push("function-line");
    }
    if (searchTerm && line.toLowerCase().includes(searchTerm)) {
      classes.push("search-line");
    }

    braceDepth += openBraceCount;
    braceDepth -= closeBraceCount;

    if (activeFunctionBaseDepth !== null && braceDepth <= activeFunctionBaseDepth) {
      separatorLines.push(index + 1);
      activeFunctionBaseDepth = null;
    }

    return `<span class="${classes.join(" ")}">${index + 1}</span>`;
  }).join("");
  lineNumbers.innerHTML = markup || '<span class="line-number">1</span>';
  lineNumbers.scrollTop = codeInput.scrollTop;
  updateCodeHighlights(separatorLines);
  updateCodeSearchHighlights(lines);
}

function updateCodeHighlights(separatorLines = []) {
  const styles = window.getComputedStyle(codeInput);
  const lineHeight = Number.parseFloat(styles.lineHeight) || 22.4;
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
  const contentWidth = Math.max(codeInput.scrollWidth, codeInput.clientWidth);

  codeHighlights.innerHTML = separatorLines.map((lineNumber) => {
    const top = paddingTop + lineHeight * lineNumber - codeInput.scrollTop - 1;
    return `<div class="code-highlight-line" style="top:${top}px;width:${contentWidth}px;transform:translateX(${-codeInput.scrollLeft}px);"></div>`;
  }).join("");
}

function findMatchingSearchLines(lines = codeInput.value.split("\n")) {
  const term = currentSearchTerm.trim().toLowerCase();
  if (!term) {
    return [];
  }

  return lines.flatMap((line, index) => (
    line.toLowerCase().includes(term) ? [index] : []
  ));
}

function updateSearchResults(lines = codeInput.value.split("\n")) {
  const matchingLines = findMatchingSearchLines(lines);
  const selectedLine = Number(activeSearchResultLine || searchResults.value);

  if (!currentSearchTerm.trim()) {
    activeSearchResultLine = 0;
    searchResults.innerHTML = '<option value="">検索結果なし</option>';
    searchResults.value = "";
    return;
  }

  if (matchingLines.length === 0) {
    activeSearchResultLine = 0;
    searchResults.innerHTML = '<option value="">検索結果なし</option>';
    searchResults.value = "";
    return;
  }

  searchResults.innerHTML = '<option value="">検索結果を選択</option>' + matchingLines.map((lineIndex) => {
    const lineText = lines[lineIndex].trim() || "(空行)";
    const summary = lineText.length > 48 ? `${lineText.slice(0, 48)}...` : lineText;
    return `<option value="${lineIndex + 1}">L${lineIndex + 1}: ${escapeHtml(summary)}</option>`;
  }).join("");

  if (matchingLines.some((lineIndex) => lineIndex + 1 === selectedLine)) {
    activeSearchResultLine = selectedLine;
    searchResults.value = String(selectedLine);
  } else {
    activeSearchResultLine = 0;
    searchResults.value = "";
  }
}

function updateCodeSearchHighlights(lines = codeInput.value.split("\n")) {
  const term = currentSearchTerm.trim().toLowerCase();
  const styles = window.getComputedStyle(codeInput);
  const lineHeight = Number.parseFloat(styles.lineHeight) || 22.4;
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
  const contentWidth = Math.max(codeInput.scrollWidth, codeInput.clientWidth);
  if (!term) {
    codeSearchHighlights.innerHTML = "";
    return;
  }

  const matchingLines = findMatchingSearchLines(lines);

  codeSearchHighlights.innerHTML = matchingLines.map((lineIndex) => {
    const top = paddingTop + lineHeight * lineIndex - codeInput.scrollTop;
    return `<div class="code-search-line" style="top:${top}px;width:${contentWidth}px;height:${lineHeight}px;transform:translateX(${-codeInput.scrollLeft}px);"></div>`;
  }).join("");
}

function jumpToCodeLine(lineNumber) {
  const requestedLine = Number(lineNumber);
  if (!Number.isInteger(requestedLine) || requestedLine < 1) {
    return;
  }

  const lines = codeInput.value.split("\n");
  const targetLine = Math.min(requestedLine, lines.length);
  const beforeText = lines.slice(0, targetLine - 1).join("\n");
  const lineStart = beforeText.length === 0 ? 0 : beforeText.length + 1;
  const lineText = lines[targetLine - 1] || "";
  const lineEnd = lineStart + lineText.length;
  const styles = window.getComputedStyle(codeInput);
  const lineHeight = Number.parseFloat(styles.lineHeight) || 22.4;
  const paddingTop = Number.parseFloat(styles.paddingTop) || 0;
  const targetTop = Math.max(0, paddingTop + lineHeight * (targetLine - 1) - codeInput.clientHeight / 2 + lineHeight);

  activeSearchResultLine = targetLine;
  searchResults.value = String(targetLine);
  codeInput.focus({ preventScroll: true });
  codeInput.setSelectionRange(lineStart, lineEnd);
  codeInput.scrollTop = targetTop;
  lineNumbers.scrollTop = codeInput.scrollTop;
  updateLineNumbers();
  window.requestAnimationFrame(() => {
    codeInput.scrollTop = targetTop;
    lineNumbers.scrollTop = codeInput.scrollTop;
    updateLineNumbers();
  });
  statusText.textContent = `${targetLine} 行目へ移動しました。`;
}

function highlightSearchMatches(text) {
  const escapedText = escapeHtml(text);
  const term = currentSearchTerm.trim();
  if (!term) {
    return escapedText;
  }

  const pattern = new RegExp(escapeRegex(term), "gi");
  return escapedText.replace(pattern, (match) => `<mark>${match}</mark>`);
}

function setExecutionPanels(mainText, errorText = "[error]\nエラーはありません。") {
  latestMainOutputText = mainText;
  latestErrorOutputText = errorText;
  codeOutput.innerHTML = highlightSearchMatches(mainText);
  codeErrorOutput.innerHTML = highlightSearchMatches(errorText);
}

function readPointValues() {
  const values = Object.fromEntries(
    Object.entries(fields).map(([key, input]) => [key, Number(input.value)])
  );

  if (Object.values(values).some((value) => !Number.isFinite(value))) {
    throw new Error("すべての座標に数値を入力してください。");
  }

  if (values.x1 === values.x2 && values.y1 === values.y2) {
    throw new Error("A と B が同じ点です。AB の直線を作れません。");
  }

  if (values.x3 === values.x4 && values.y3 === values.y4) {
    throw new Error("C と D が同じ点です。CD の直線を作れません。");
  }

  if (!Number.isFinite(values.widthAb) || values.widthAb <= 0) {
    throw new Error("AB の太さは 0 より大きい数にしてください。");
  }

  if (!Number.isFinite(values.widthCd) || values.widthCd <= 0) {
    throw new Error("CD の太さは 0 より大きい数にしてください。");
  }

  return values;
}

function readVisibility() {
  return {
    ab: visibilityControls.ab.checked,
    cd: visibilityControls.cd.checked,
  };
}

function buildViewBox(points) {
  const xs = [points.x1, points.x2, points.x3, points.x4];
  const ys = [points.y1, points.y2, points.y3, points.y4];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 40);
  const spanY = Math.max(maxY - minY, 40);
  const scale = Math.min(
    (WIDTH - PADDING * 2) / spanX,
    (HEIGHT - PADDING * 2) / spanY
  );

  return {
    minX,
    maxX,
    minY,
    maxY,
    scale,
  };
}

function toSvgCoords(x, y, view) {
  const offsetX = (WIDTH - (view.maxX - view.minX) * view.scale) / 2;
  const offsetY = (HEIGHT - (view.maxY - view.minY) * view.scale) / 2;

  return {
    x: offsetX + (x - view.minX) * view.scale,
    y: HEIGHT - (offsetY + (y - view.minY) * view.scale),
  };
}

function fromSvgCoords(svgX, svgY, view) {
  const offsetX = (WIDTH - (view.maxX - view.minX) * view.scale) / 2;
  const offsetY = (HEIGHT - (view.maxY - view.minY) * view.scale) / 2;

  return {
    x: view.minX + (svgX - offsetX) / view.scale,
    y: view.minY + ((HEIGHT - svgY) - offsetY) / view.scale,
  };
}

function getSvgPointer(event) {
  const rect = svg.getBoundingClientRect();
  const clientX = event.touches ? event.touches[0].clientX : event.clientX;
  const clientY = event.touches ? event.touches[0].clientY : event.clientY;

  return {
    x: ((clientX - rect.left) / rect.width) * WIDTH,
    y: ((clientY - rect.top) / rect.height) * HEIGHT,
  };
}

function drawGrid(view) {
  const group = createSvgElement("g", { opacity: "0.85" });
  const lines = 8;

  for (let i = 0; i <= lines; i += 1) {
    const x = PADDING + ((WIDTH - PADDING * 2) / lines) * i;
    const y = PADDING + ((HEIGHT - PADDING * 2) / lines) * i;

    group.appendChild(createSvgElement("line", {
      x1: x,
      y1: PADDING,
      x2: x,
      y2: HEIGHT - PADDING,
      stroke: "#dbcdbd",
      "stroke-width": 1,
    }));
    group.appendChild(createSvgElement("line", {
      x1: PADDING,
      y1: y,
      x2: WIDTH - PADDING,
      y2: y,
      stroke: "#dbcdbd",
      "stroke-width": 1,
    }));
  }

  const origin = toSvgCoords(0, 0, view);
  group.appendChild(createSvgElement("line", {
    x1: origin.x,
    y1: 20,
    x2: origin.x,
    y2: HEIGHT - 20,
    stroke: "#9b8c7b",
    "stroke-width": 1.5,
    "stroke-dasharray": "6 6",
  }));
  group.appendChild(createSvgElement("line", {
    x1: 20,
    y1: origin.y,
    x2: WIDTH - 20,
    y2: origin.y,
    stroke: "#9b8c7b",
    "stroke-width": 1.5,
    "stroke-dasharray": "6 6",
  }));

  return group;
}

function drawPoint(point, label, color, options = {}) {
  const group = createSvgElement("g");
  const circle = createSvgElement("circle", {
    cx: point.x,
    cy: point.y,
    r: options.radius || 8,
    fill: color,
    stroke: options.stroke || "#ffffff",
    "stroke-width": options.strokeWidth || 2,
    cursor: options.draggable ? "grab" : "default",
  });
  if (options.draggable) {
    circle.addEventListener("mousedown", (event) => {
      event.preventDefault();
      startPointDrag(options.dragData, event);
    });
    circle.addEventListener("touchstart", (event) => {
      event.preventDefault();
      startPointDrag(options.dragData, event);
    }, { passive: false });
  }
  group.appendChild(circle);
  group.appendChild(createSvgElement("text", {
    x: point.x + 12,
    y: point.y - 12,
    fill: "#1e2430",
    "font-size": 18,
    "font-weight": 700,
  }));
  group.lastChild.textContent = label;
  return group;
}

function drawIntersection(point) {
  const group = createSvgElement("g");
  group.appendChild(createSvgElement("circle", {
    cx: point.x,
    cy: point.y,
    r: 9,
    fill: "#fff7cc",
    stroke: "#8b6f00",
    "stroke-width": 3,
  }));
  group.appendChild(createSvgElement("text", {
    x: point.x + 12,
    y: point.y + 22,
    fill: "#1e2430",
    "font-size": 18,
    "font-weight": 700,
  }));
  group.lastChild.textContent = "P";
  return group;
}

function syncOutputPreview() {
  outputPreviewCanvas.replaceChildren(...Array.from(svg.childNodes).map((node) => node.cloneNode(true)));
}

function drawPolygonOverlay(points, view, options = {}) {
  if (!Array.isArray(points) || points.length < 3) {
    return null;
  }

  const svgPoints = points.map((point) => toSvgCoords(point.x, point.y, view));
  const polygon = createSvgElement("polygon", {
    points: svgPoints.map((point) => `${point.x},${point.y}`).join(" "),
    fill: options.fill || "rgba(31, 111, 235, 0.18)",
    stroke: options.stroke || "#1f6feb",
    "stroke-width": options.strokeWidth || 3,
    "stroke-linejoin": "round",
  });

  return polygon;
}

function drawCustomPolygons(view) {
  customPolygons.forEach((entry, polygonIndex) => {
    const polygon = drawPolygonOverlay(entry.points, view, entry.options);
    if (polygon) {
      svg.appendChild(polygon);
    }
    entry.points.forEach((point, pointIndex) => {
      const handle = drawPoint(
        toSvgCoords(point.x, point.y, view),
        "",
        entry.options.handleFill || "#0f4fb8",
        {
          radius: 6,
          stroke: entry.options.handleStroke || "#ffffff",
          strokeWidth: 2,
          draggable: true,
          dragData: { kind: "polygon", polygonIndex, pointIndex },
        }
      );
      const textNode = handle.querySelector("text");
      if (textNode) {
        textNode.remove();
      }
      svg.appendChild(handle);
    });
  });
}

function setFieldPoint(keyX, keyY, point) {
  fields[keyX].value = String(point.x);
  fields[keyY].value = String(point.y);
}

function startPointDrag(dragData, event) {
  dragState.active = true;
  dragState.kind = dragData.kind;
  dragState.key = dragData.key || "";
  dragState.polygonIndex = Number.isInteger(dragData.polygonIndex) ? dragData.polygonIndex : -1;
  dragState.pointIndex = Number.isInteger(dragData.pointIndex) ? dragData.pointIndex : -1;
  updateDraggedPoint(event);
}

function updateDraggedPoint(event) {
  if (!dragState.active || !renderState.view) {
    return;
  }

  const pointer = getSvgPointer(event);
  const worldPoint = fromSvgCoords(pointer.x, pointer.y, renderState.view);

  if (dragState.kind === "field") {
    const [keyX, keyY] = dragState.key.split(",");
    setFieldPoint(keyX, keyY, worldPoint);
  } else if (dragState.kind === "polygon") {
    const polygon = customPolygons[dragState.polygonIndex];
    if (polygon && polygon.points[dragState.pointIndex]) {
      polygon.points[dragState.pointIndex] = worldPoint;
    }
  }

  render();
}

function stopPointDrag() {
  dragState.active = false;
  dragState.kind = "";
  dragState.key = "";
  dragState.polygonIndex = -1;
  dragState.pointIndex = -1;
}

function buildEquation(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  if (dx === 0) {
    return `x = ${formatNumber(start.x)}`;
  }

  const slope = dy / dx;
  const intercept = start.y - slope * start.x;
  const sign = intercept < 0 ? "-" : "+";
  return `y = ${formatNumber(slope)}x ${sign} ${formatNumber(Math.abs(intercept))}`;
}

function lineMetrics(start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  const slope = dx === 0 ? "未定義" : formatNumber(dy / dx);

  return {
    length: formatNumber(length),
    slope,
    equation: buildEquation(start, end),
  };
}

function updateInfo(points) {
  const visibility = readVisibility();
  const pointA = { x: points.x1, y: points.y1 };
  const pointB = { x: points.x2, y: points.y2 };
  const pointC = { x: points.x3, y: points.y3 };
  const pointD = { x: points.x4, y: points.y4 };
  const ab = lineMetrics(pointA, pointB);
  const cd = lineMetrics(pointC, pointD);
  const intersection = window.findLineIntersection(pointA, pointB, pointC, pointD);

  output.lineAB.textContent = visibility.ab
    ? `A(${formatNumber(pointA.x)}, ${formatNumber(pointA.y)}) - B(${formatNumber(pointB.x)}, ${formatNumber(pointB.y)})`
    : "非表示";
  output.lineCD.textContent = visibility.cd
    ? `C(${formatNumber(pointC.x)}, ${formatNumber(pointC.y)}) - D(${formatNumber(pointD.x)}, ${formatNumber(pointD.y)})`
    : "非表示";
  output.lengthAB.textContent = ab.length;
  output.lengthCD.textContent = cd.length;
  output.slopeAB.textContent = ab.slope;
  output.widthAB.textContent = formatNumber(points.widthAb);
  output.slopeCD.textContent = cd.slope;
  output.widthCD.textContent = formatNumber(points.widthCd);
  output.equationAB.textContent = ab.equation;
  output.equationCD.textContent = cd.equation;

  if (intersection.isParallel) {
    output.intersection.textContent = "平行なので交点はありません";
    output.intersectionState.textContent = "AB と CD は平行です";
  } else if (intersection.onFirstSegment && intersection.onSecondSegment) {
    output.intersection.textContent = `(${formatNumber(intersection.point.x)}, ${formatNumber(intersection.point.y)})`;
    output.intersectionState.textContent = "線分ABと線分CDの上で交差しています";
  } else {
    output.intersection.textContent = `延長線上の交点: (${formatNumber(intersection.point.x)}, ${formatNumber(intersection.point.y)})`;
    output.intersectionState.textContent = "線分同士は交差せず、延長線上で交わります";
  }

  return intersection;
}

function render() {
  try {
    const points = readPointValues();
    const view = buildViewBox(points);
    renderState.view = view;
    const pointA = toSvgCoords(points.x1, points.y1, view);
    const pointB = toSvgCoords(points.x2, points.y2, view);
    const pointC = toSvgCoords(points.x3, points.y3, view);
    const pointD = toSvgCoords(points.x4, points.y4, view);

    svg.replaceChildren();
    svg.appendChild(drawGrid(view));
    const visibility = readVisibility();
    if (visibility.ab) {
      svg.appendChild(createSvgElement("line", {
        x1: pointA.x,
        y1: pointA.y,
        x2: pointB.x,
        y2: pointB.y,
        stroke: "#2f5d62",
        "stroke-width": points.widthAb,
        "stroke-linecap": "round",
      }));
    }
    if (visibility.cd) {
      svg.appendChild(createSvgElement("line", {
        x1: pointC.x,
        y1: pointC.y,
        x2: pointD.x,
        y2: pointD.y,
        stroke: "#cb5c38",
        "stroke-width": points.widthCd,
        "stroke-linecap": "round",
      }));
    }
    svg.appendChild(drawPoint(pointA, "A", "#cb5c38", {
      draggable: true,
      dragData: { kind: "field", key: "x1,y1" },
    }));
    svg.appendChild(drawPoint(pointB, "B", "#4a7c59", {
      draggable: true,
      dragData: { kind: "field", key: "x2,y2" },
    }));
    svg.appendChild(drawPoint(pointC, "C", "#8f3b76", {
      draggable: true,
      dragData: { kind: "field", key: "x3,y3" },
    }));
    svg.appendChild(drawPoint(pointD, "D", "#d18f1b", {
      draggable: true,
      dragData: { kind: "field", key: "x4,y4" },
    }));

    const intersection = updateInfo(points);
    if (!isRunningUserCode) {
      console.clear();
      console.log("current_intersection", {
        isParallel: intersection.isParallel,
        point: intersection.point,
        onFirstSegment: intersection.onFirstSegment,
        onSecondSegment: intersection.onSecondSegment,
      });
    }
    if (!intersection.isParallel && intersection.onFirstSegment && intersection.onSecondSegment) {
      const crossPoint = toSvgCoords(intersection.point.x, intersection.point.y, view);
      svg.appendChild(drawIntersection(crossPoint));
    }

    drawCustomPolygons(view);
    syncOutputPreview();

    statusText.textContent = "AB と CD の直線を更新しました。";
  } catch (error) {
    statusText.textContent = error instanceof Error ? error.message : "描画に失敗しました。";
  }
}

function reset() {
  Object.entries(DEFAULT_POINTS).forEach(([key, value]) => {
    fields[key].value = String(value);
  });
  Object.entries(DEFAULT_VISIBILITY).forEach(([key, value]) => {
    visibilityControls[key].checked = value;
  });
  render();
}

function runCode() {
  const source = codeInput.value.trim();
  if (!source) {
    setExecutionPanels("[return]\nコードを入力してください。");
    return;
  }

  const logs = [];
  const originalConsoleLog = console.log;

  try {
    isRunningUserCode = true;
    console.log = (...args) => {
      const lineNumber = extractUserCodeLineNumber(new Error().stack);
      const prefix = lineNumber ? `[L${lineNumber}] ` : "";
      logs.push(`${prefix}${formatConsoleArgs(args)}`);
      originalConsoleLog(...args);
    };

    let result;

    try {
      try {
        userCodeExecutionMode = "expression";
        const expressionRunner = new Function(`return (\n${source}\n);\n//# sourceURL=codex-user-expression.js`);
        result = expressionRunner();
      } catch (_expressionError) {
        try {
          // `eval` keeps the completion value of the last statement, so
          // multi-line code ending in a function call still appears as [return].
          userCodeExecutionMode = "eval-statement";
          result = eval(`${source}\n//# sourceURL=codex-user-statement.js`);
        } catch (evalError) {
          if (!(evalError instanceof SyntaxError)) {
            throw evalError;
          }
          userCodeExecutionMode = "function-statement";
          const statementRunner = new Function(`${source}\n//# sourceURL=codex-user-statement.js`);
          result = statementRunner();
        }
      }
    } finally {
      console.log = originalConsoleLog;
      userCodeExecutionMode = "";
    }

    const sections = [];
    if (logs.length > 0) {
      sections.push(`[console.log]\n${logs.join("\n")}`);
    }
    sections.push(`[return]\n${formatExecutionResult(result)}`);
    setExecutionPanels(sections.join("\n\n"));
  } catch (error) {
    console.log = originalConsoleLog;
    const sections = [];
    if (logs.length > 0) {
      sections.push(`[console.log]\n${logs.join("\n")}`);
    }
    const mainText = sections.length > 0
      ? sections.join("\n\n")
      : "[return]\nundefined";
    if (error instanceof Error) {
      const lineNumber = extractUserCodeErrorLineNumber(error);
      const prefix = lineNumber ? `[L${lineNumber}] ` : "";
      setExecutionPanels(
        mainText,
        `[error]\n${prefix}${error.stack || error.message}`
      );
    } else {
      setExecutionPanels(
        mainText,
        `[error]\n${String(error)}`
      );
    }
  } finally {
    isRunningUserCode = false;
  }
}

function clearCodeOutput() {
  setExecutionPanels(
    "[return]\nここに実行結果が表示されます。",
    "[error]\nエラーはありません。"
  );
}

function drawPolygonOnCanvas(points, options = {}) {
  if (!Array.isArray(points) || points.length < 3) {
    throw new Error("3点以上の points が必要です。");
  }

  customPolygons.push({
    points: points.map((point) => ({ x: Number(point.x), y: Number(point.y) })),
    options,
  });
  render();
  return customPolygons[customPolygons.length - 1];
}

function clearCanvasPolygons() {
  customPolygons.length = 0;
  render();
}

function togglePanel() {
  const isHidden = controlPanel.classList.toggle("hidden");
  layout.classList.toggle("panel-hidden", isHidden);
  togglePanelButton.textContent = isHidden ? "panel を表示" : "panel を非表示";
}

function resizeRunnerOutput(nextHeight) {
  const minHeight = 190;
  const maxHeight = Math.max(minHeight, window.innerHeight - 40);
  const clampedHeight = Math.min(maxHeight, Math.max(minHeight, nextHeight));
  floatingRunnerFooter.style.height = `${clampedHeight}px`;
  updateFooterSafeSpace();
}

function updateFooterSafeSpace() {
  const footerHeight = floatingRunnerFooter.offsetHeight || 240;
  const extraSpace = window.innerWidth <= 700 ? 24 : 32;
  document.documentElement.style.setProperty("--footer-safe-space", `${footerHeight + extraSpace}px`);
}

function startRunnerResize(startY, startHeight) {
  const handleMove = (clientY) => {
    const delta = startY - clientY;
    resizeRunnerOutput(startHeight + delta);
  };

  const onMouseMove = (event) => {
    handleMove(event.clientY);
  };

  const onTouchMove = (event) => {
    if (event.touches.length > 0) {
      handleMove(event.touches[0].clientY);
    }
  };

  const stop = () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", stop);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", stop);
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", stop);
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  window.addEventListener("touchend", stop);
}

function resizePreviewWidth(nextWidth) {
  const minWidth = 120;
  const maxWidth = Math.max(minWidth, window.innerWidth * 0.5);
  const clampedWidth = Math.min(maxWidth, Math.max(minWidth, nextWidth));
  document.documentElement.style.setProperty("--preview-width", `${clampedWidth}px`);
}

function resizeErrorWidth(nextWidth) {
  const minWidth = 140;
  const maxWidth = Math.max(minWidth, window.innerWidth * 0.45);
  const clampedWidth = Math.min(maxWidth, Math.max(minWidth, nextWidth));
  document.documentElement.style.setProperty("--error-width", `${clampedWidth}px`);
}

function startOutputDividerResize(startX) {
  const currentWidthValue = getComputedStyle(document.documentElement).getPropertyValue("--preview-width").trim();
  const startWidth = Number.parseFloat(currentWidthValue) || 240;

  const handleMove = (clientX) => {
    const delta = clientX - startX;
    resizePreviewWidth(startWidth + delta);
  };

  const onMouseMove = (event) => {
    handleMove(event.clientX);
  };

  const onTouchMove = (event) => {
    if (event.touches.length > 0) {
      handleMove(event.touches[0].clientX);
    }
  };

  const stop = () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", stop);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", stop);
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", stop);
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  window.addEventListener("touchend", stop);
}

function startErrorOutputDividerResize(startX) {
  const currentWidthValue = getComputedStyle(document.documentElement).getPropertyValue("--error-width").trim();
  const startWidth = Number.parseFloat(currentWidthValue) || 280;

  const handleMove = (clientX) => {
    const delta = clientX - startX;
    resizeErrorWidth(startWidth + delta);
  };

  const onMouseMove = (event) => {
    handleMove(event.clientX);
  };

  const onTouchMove = (event) => {
    if (event.touches.length > 0) {
      handleMove(event.touches[0].clientX);
    }
  };

  const stop = () => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", stop);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", stop);
  };

  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", stop);
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  window.addEventListener("touchend", stop);
}

document.getElementById("draw-btn").addEventListener("click", render);
document.getElementById("reset-btn").addEventListener("click", reset);
document.getElementById("run-code-btn").addEventListener("click", runCode);
document.getElementById("clear-code-btn").addEventListener("click", clearCodeOutput);
togglePanelButton.addEventListener("click", togglePanel);
runnerResizeHandle.addEventListener("mousedown", (event) => {
  startRunnerResize(event.clientY, floatingRunnerFooter.offsetHeight);
});
runnerResizeHandle.addEventListener("touchstart", (event) => {
  if (event.touches.length > 0) {
    startRunnerResize(event.touches[0].clientY, floatingRunnerFooter.offsetHeight);
  }
}, { passive: true });
outputDivider.addEventListener("mousedown", (event) => {
  startOutputDividerResize(event.clientX);
});
outputDivider.addEventListener("touchstart", (event) => {
  if (event.touches.length > 0) {
    startOutputDividerResize(event.touches[0].clientX);
  }
}, { passive: true });
errorOutputDivider.addEventListener("mousedown", (event) => {
  startErrorOutputDividerResize(event.clientX);
});
errorOutputDivider.addEventListener("touchstart", (event) => {
  if (event.touches.length > 0) {
    startErrorOutputDividerResize(event.touches[0].clientX);
  }
}, { passive: true });
window.addEventListener("mousemove", (event) => {
  updateDraggedPoint(event);
});
window.addEventListener("touchmove", (event) => {
  updateDraggedPoint(event);
}, { passive: false });
window.addEventListener("mouseup", stopPointDrag);
window.addEventListener("touchend", stopPointDrag);
Object.values(fields).forEach((input) => {
  input.addEventListener("input", render);
});
Object.values(visibilityControls).forEach((input) => {
  input.addEventListener("input", render);
});
codeInput.addEventListener("keydown", (event) => {
  if (event.key === "Tab") {
    event.preventDefault();
    insertTabAtSelection();
    return;
  }
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    runCode();
  }
});
codeInput.addEventListener("input", () => {
  updateLineNumbers();
  updateSearchResults();
  resizeCodeInput();
});
codeInput.addEventListener("scroll", () => {
  lineNumbers.scrollTop = codeInput.scrollTop;
  updateLineNumbers();
});
searchInput.addEventListener("input", () => {
  currentSearchTerm = searchInput.value;
  updateLineNumbers();
  updateSearchResults();
  setExecutionPanels(latestMainOutputText, latestErrorOutputText);
});
function handleSearchResultSelection() {
  window.setTimeout(() => {
    const selectedValue = Number(
      searchResults.options[searchResults.selectedIndex]?.value || 0
    );
    if (!Number.isInteger(selectedValue) || selectedValue < 1) {
      return;
    }

    activeSearchResultLine = selectedValue;
    jumpToCodeLine(selectedValue);
  }, 0);
}

searchResults.addEventListener("change", handleSearchResultSelection);
updateLineNumbers();
updateSearchResults();
resizeCodeInput();
resizeRunnerOutput(floatingRunnerFooter.offsetHeight || 240);
window.addEventListener("resize", () => {
  updateLineNumbers();
  updateFooterSafeSpace();
});
window.drawPolygonOnCanvas = drawPolygonOnCanvas;
window.clearCanvasPolygons = clearCanvasPolygons;
reset();
