"""
DISC-PHASE3 synthetic user experiment.

This is a deterministic, synthetic design study. It does not claim to be
observed social-media data and does not read any personal vault content.
It tests whether the proposed exploration surfaces are likely to help
different young-adult usage profiles before implementation decisions.

Run: python research/phase3_simulation.py
"""

from __future__ import annotations

import json
import math
import random
from dataclasses import dataclass
from statistics import mean

SEED = 20261027
PERSONAS = 1200
TASKS = 4

DESIGNS = {
    "flat_list": {"structure": 0.0, "matrix": 0.0, "ai": 0.0, "trend": 0.0},
    "theme_cards": {"structure": 0.55, "matrix": 0.0, "ai": 0.0, "trend": 0.0},
    "theme_matrix": {"structure": 0.55, "matrix": 0.35, "ai": 0.0, "trend": 0.0},
    "theme_matrix_trend": {"structure": 0.55, "matrix": 0.35, "ai": 0.0, "trend": 0.25},
    "theme_matrix_ai": {"structure": 0.55, "matrix": 0.35, "ai": 0.40, "trend": 0.0},
    "full_explorer": {"structure": 0.55, "matrix": 0.35, "ai": 0.40, "trend": 0.25},
}

AGE_PROFILES = [
    ("18-24", 0.42, 0.10, 0.18),
    ("25-30", 0.38, 0.06, 0.06),
    ("31-35", 0.20, 0.02, -0.02),
]

PLATFORMS = [
    ("short_form", 0.35, 0.12),
    ("social_feed", 0.28, 0.08),
    ("search", 0.22, -0.02),
    ("community", 0.15, 0.04),
]

NOTE_FREQUENCY = [
    ("daily", 0.30, 0.10),
    ("weekly", 0.47, 0.04),
    ("sporadic", 0.23, -0.04),
]


@dataclass
class Persona:
    age: str
    platform: str
    frequency: str
    projects: int
    interests: int
    digital_confidence: float
    reflection_need: float
    ai_skepticism: float


def pick_weighted(rng: random.Random, choices):
    point = rng.random()
    cumulative = 0.0
    for choice in choices:
        cumulative += choice[1]
        if point <= cumulative:
            return choice
    return choices[-1]


def make_persona(rng: random.Random) -> Persona:
    age, _, age_bonus, _ = pick_weighted(rng, AGE_PROFILES)
    platform, _, platform_bonus = pick_weighted(rng, PLATFORMS)
    frequency, _, frequency_bonus = pick_weighted(rng, NOTE_FREQUENCY)
    return Persona(
        age=age,
        platform=platform,
        frequency=frequency,
        projects=rng.randint(1, 6),
        interests=rng.randint(3, 15),
        digital_confidence=max(0.05, min(0.98, 0.52 + age_bonus + platform_bonus + frequency_bonus + rng.gauss(0, 0.10))),
        reflection_need=max(0.05, min(0.98, rng.random())),
        ai_skepticism=max(0.05, min(0.98, rng.random())),
    )


def simulate_task(persona: Persona, design: dict[str, float], rng: random.Random) -> dict[str, float]:
    # Structural discovery support; matrix helps cross-project sense-making.
    structure = design["structure"]
    matrix = design["matrix"]
    ai = design["ai"]
    trend = design["trend"]

    age_support = {"18-24": 0.04, "25-30": 0.02, "31-35": -0.01}[persona.age]
    platform_support = {"short_form": 0.03, "social_feed": 0.02, "search": 0.01, "community": 0.03}[persona.platform]
    frequency_support = {"daily": 0.03, "weekly": 0.01, "sporadic": -0.02}[persona.frequency]
    complexity = min(0.18, persona.projects * 0.012 + persona.interests * 0.004)
    base = 0.36 + structure * 0.20 + matrix * 0.14 + trend * 0.06 + ai * 0.10
    base += age_support + platform_support + frequency_support + persona.digital_confidence * 0.08
    base -= complexity * (1 - structure * 0.5)
    # AI is useful, but not to users who are strongly skeptical.
    base -= ai * persona.ai_skepticism * 0.08
    noise = rng.gauss(0, 0.055)
    success = max(0.03, min(0.98, base + noise))

    time_seconds = 54 - structure * 10 - matrix * 5 - trend * 3 - ai * 4
    time_seconds += complexity * 22 + persona.interests * 0.5 - persona.digital_confidence * 5
    time_seconds = max(14, time_seconds + rng.gauss(0, 2.5))

    confusion = 0.28 - structure * 0.12 - matrix * 0.07 - trend * 0.03 - ai * 0.02
    confusion += complexity * 0.20 + persona.ai_skepticism * ai * 0.05
    confusion = max(0.01, min(0.80, confusion + rng.gauss(0, 0.035)))

    confidence = 0.36 + success * 0.38 + structure * 0.08 + matrix * 0.08 + trend * 0.04
    confidence += ai * (0.06 - persona.ai_skepticism * 0.03) + rng.gauss(0, 0.04)
    confidence = max(0.02, min(0.98, confidence))

    return {
        "success": success,
        "time": time_seconds,
        "confusion": confusion,
        "confidence": confidence,
    }


def ci95(values: list[float]) -> float:
    if len(values) < 2:
        return 0.0
    variance = sum((value - mean(values)) ** 2 for value in values) / (len(values) - 1)
    return 1.96 * math.sqrt(variance) / math.sqrt(len(values))


def main() -> None:
    rng = random.Random(SEED)
    personas = [make_persona(rng) for _ in range(PERSONAS)]
    results: dict[str, list[dict[str, float]]] = {name: [] for name in DESIGNS}
    for persona in personas:
        for _ in range(TASKS):
            for name, design in DESIGNS.items():
                results[name].append(simulate_task(persona, design, rng))

    summary = {}
    for name, rows in results.items():
        summary[name] = {
            "trials": len(rows),
            "success": round(mean(row["success"] for row in rows), 3),
            "success_ci95": round(ci95([row["success"] for row in rows]), 3),
            "time_seconds": round(mean(row["time"] for row in rows), 1),
            "confusion": round(mean(row["confusion"] for row in rows), 3),
            "confidence": round(mean(row["confidence"] for row in rows), 3),
        }

    # Aggregate young cohort for the full explorer only.
    young_rows = []
    for index, persona in enumerate(personas):
        if persona.age in ("18-24", "25-30"):
            young_rows.extend(results["full_explorer"][index * TASKS:(index + 1) * TASKS])
    summary["young_cohort_full_explorer"] = {
        "personas": len([p for p in personas if p.age in ("18-24", "25-30")]),
        "trials": len(young_rows),
        "success": round(mean(row["success"] for row in young_rows), 3),
        "time_seconds": round(mean(row["time"] for row in young_rows), 1),
        "confusion": round(mean(row["confusion"] for row in young_rows), 3),
        "confidence": round(mean(row["confidence"] for row in young_rows), 3),
    }

    print(json.dumps({
        "seed": SEED,
        "personas": PERSONAS,
        "tasks": TASKS,
        "label": "synthetic design study; not observed social-media data",
        "summary": summary,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
