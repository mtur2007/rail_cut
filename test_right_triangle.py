from __future__ import annotations

import importlib.util
import pathlib
import unittest


MODULE_PATH = pathlib.Path(__file__).with_name("right_triangle.py")
SPEC = importlib.util.spec_from_file_location("right_triangle", MODULE_PATH)
assert SPEC is not None and SPEC.loader is not None
right_triangle = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(right_triangle)


class SolveRightTriangleTest(unittest.TestCase):
    def test_solves_when_adjacent_leg_is_known(self) -> None:
        actual = right_triangle.solve_right_triangle(known_leg=10, angle_deg=30, relation="adjacent")

        self.assertAlmostEqual(actual["adjacent"], 10.0, places=7)
        self.assertAlmostEqual(actual["opposite"], 5.7735026919, places=7)
        self.assertAlmostEqual(actual["hypotenuse"], 11.5470053838, places=7)
        self.assertAlmostEqual(actual["other_angle_deg"], 60.0, places=7)

    def test_solves_when_opposite_leg_is_known(self) -> None:
        actual = right_triangle.solve_right_triangle(known_leg=5, angle_deg=30, relation="opposite")

        self.assertAlmostEqual(actual["adjacent"], 8.6602540378, places=7)
        self.assertAlmostEqual(actual["opposite"], 5.0, places=7)
        self.assertAlmostEqual(actual["hypotenuse"], 10.0, places=7)
        self.assertAlmostEqual(actual["other_angle_deg"], 60.0, places=7)

    def test_rejects_non_positive_leg_length(self) -> None:
        with self.assertRaises(ValueError):
            right_triangle.solve_right_triangle(known_leg=0, angle_deg=30, relation="adjacent")

    def test_rejects_invalid_angle(self) -> None:
        with self.assertRaises(ValueError):
            right_triangle.solve_right_triangle(known_leg=10, angle_deg=90, relation="adjacent")

    def test_rejects_invalid_relation(self) -> None:
        with self.assertRaises(ValueError):
            right_triangle.solve_right_triangle(known_leg=10, angle_deg=30, relation="hypotenuse")


if __name__ == "__main__":
    unittest.main()
