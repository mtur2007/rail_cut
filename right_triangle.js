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

window.solveRightTriangle = solveRightTriangle;
