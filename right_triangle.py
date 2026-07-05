from __future__ import annotations

import math


def solve_right_triangle(known_leg: float, angle_deg: float, relation: str) -> dict[str, float]:
    """Solve a right triangle from one leg and one acute angle.

    relation:
    - "adjacent": known_leg is adjacent to angle_deg
    - "opposite": known_leg is opposite to angle_deg
    """
    if known_leg <= 0:
        raise ValueError("known_leg must be positive.")
    if not 0 < angle_deg < 90:
        raise ValueError("angle_deg must be between 0 and 90.")
    if relation not in {"adjacent", "opposite"}:
        raise ValueError("relation must be 'adjacent' or 'opposite'.")

    angle_rad = math.radians(angle_deg)

    if relation == "adjacent":
        adjacent = known_leg
        opposite = adjacent * math.tan(angle_rad)
        hypotenuse = adjacent / math.cos(angle_rad)
    else:
        opposite = known_leg
        adjacent = opposite / math.tan(angle_rad)
        hypotenuse = opposite / math.sin(angle_rad)

    return {
        "adjacent": adjacent,
        "opposite": opposite,
        "hypotenuse": hypotenuse,
        "other_angle_deg": 90 - angle_deg,
    }

print(solve_right_triangle(10, 30, "adjacent"))