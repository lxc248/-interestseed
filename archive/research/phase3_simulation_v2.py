"""
Phase 3 independent simulation v2.

Different seed, different persona mixture, more sparse/edge scenarios.
Synthetic design study only; not observed platform data.
"""

from __future__ import annotations

import json
import math
import random
from dataclasses import dataclass
from statistics import mean

SEED = 20261103
PERSONAS = 2000
TASKS = 5

# 设计空间与 v1 不同：把 AI 和矩阵拆开，增加“无主题”边界。
DESIGNS = {
    "flat": {"structure": 0.0, "matrix": 0.0, "trend": 0.0, "ai": 0.0},
    "theme": {"structure": 0.70, "matrix": 0.0, "trend": 0.0, "ai": 0.0},
    "theme_trend": {"structure": 0.70, "matrix": 0.0, "trend": 0.35, "ai": 0.0},
    "theme_matrix": {"structure": 0.70, "matrix": 0.50, "trend": 0.0, "ai": 0.0},
    "theme_matrix_ai": {"structure": 0.70, "matrix": 0.50, "trend": 0.0, "ai": 0.50},
    "full": {"structure": 0.70, "matrix": 0.50, "trend": 0.35, "ai": 0.50},
}


@dataclass
class Persona:
    segment: str
    age: str
    platform: str
    density: str
    projects: int
    interests: int
    confidence: float
    ai_skepticism: float
    reflection: float


def weighted(rng: random.Random, values):
    point = rng.random()
    total = 0.0
    for value, weight, *rest in values:
        total += weight
        if point <= total:
            return value, *rest
    return values[-1]


def persona(rng: random.Random) -> Persona:
    segment = weighted(rng, [("student", 0.32), ("early_career", 0.30), ("creator", 0.20), ("hobbyist", 0.18)])[0]
    age = weighted(rng, [("18-24", 0.50), ("25-30", 0.34), ("31-35", 0.16)])[0]
    platform = weighted(rng, [("short_form", 0.40), ("feed", 0.27), ("search", 0.20), ("community", 0.13)])[0]
    density = weighted(rng, [("sparse", 0.30), ("normal", 0.46), ("dense", 0.24)])[0]
    return Persona(
        segment=segment,
        age=age,
        platform=platform,
        density=density,
        projects=rng.randint(1, 9),
        interests=rng.randint(2, 20),
        confidence=max(0.05, min(0.98, rng.gauss(0.52, 0.14))),
        ai_skepticism=max(0.05, min(0.98, rng.gauss(0.50, 0.20))),
        reflection=max(0.05, min(0.98, rng.gauss(0.52, 0.18))),
    )


def simulate(p: Persona, d: dict[str, float], rng: random.Random) -> dict[str, float]:
    structure = d["structure"]
    matrix = d["matrix"]
    trend = d["trend"]
    ai = d["ai"]

    density_penalty = {"sparse": 0.06, "normal": 0.0, "dense": -0.05}[p.density]
    platform_bonus = {"short_form": 0.03, "feed": 0.015, "search": 0.02, "community": 0.035}[p.platform]
    segment_bonus = {"student": 0.02, "early_career": 0.01, "creator": 0.02, "hobbyist": 0.0}[p.segment]
    complexity = min(0.22, p.projects * 0.014 + p.interests * 0.005)

    base = 0.30 + structure * 0.22 + matrix * 0.13 + trend * 0.07 + ai * 0.09
    base += density_penalty + platform_bonus + segment_bonus + p.confidence * 0.10
    base -= complexity * (1 - structure * 0.55)
    base -= ai * p.ai_skepticism * 0.10
    success = max(0.02, min(0.98, base + rng.gauss(0, 0.05)))

    time = 61 - structure * 12 - matrix * 7 - trend * 4 - ai * 5
    time += complexity * 25 + p.interests * 0.7 - p.confidence * 8
    time = max(13, time + rng.gauss(0, 3))

    confusion = 0.33 - structure * 0.14 - matrix * 0.08 - trend * 0.04 - ai * 0.025
    confusion += complexity * 0.18 + p.ai_skepticism * ai * 0.06
    confusion = max(0.01, min(0.85, confusion + rng.gauss(0, 0.03)))

    trust = 0.40 + success * 0.30 + structure * 0.08 + trend * 0.04
    trust += ai * (0.05 - p.ai_skepticism * 0.04) + rng.gauss(0, 0.04)
    trust = max(0.02, min(0.98, trust))

    return {"success": success, "time": time, "confusion": confusion, "trust": trust}


def ci95(values):
    if len(values) < 2:
        return 0.0
    avg = mean(values)
    variance = sum((x - avg) ** 2 for x in values) / (len(values) - 1)
    return 1.96 * math.sqrt(variance) / math.sqrt(len(values))


def main():
    rng = random.Random(SEED)
    people = [persona(rng) for _ in range(PERSONAS)]
    rows = {name: [] for name in DESIGNS}
    for p in people:
        for _ in range(TASKS):
            for name, design in DESIGNS.items():
                rows[name].append(simulate(p, design, rng))

    summary = {}
    for name, values in rows.items():
        summary[name] = {
            "trials": len(values),
            "success": round(mean(v["success"] for v in values), 3),
            "success_ci95": round(ci95([v["success"] for v in values]), 3),
            "time": round(mean(v["time"] for v in values), 1),
            "confusion": round(mean(v["confusion"] for v in values), 3),
            "trust": round(mean(v["trust"] for v in values), 3),
        }

    # Edge cohort: sparse notes, high project count, AI skeptical.
    edge = []
    for i, p in enumerate(people):
        if p.density == "sparse" and p.projects >= 6 and p.ai_skepticism >= 0.65:
            edge.extend(rows["full"][i * TASKS:(i + 1) * TASKS])
    summary["edge_full"] = {
        "personas": len([p for p in people if p.density == "sparse" and p.projects >= 6 and p.ai_skepticism >= 0.65]),
        "trials": len(edge),
        "success": round(mean(v["success"] for v in edge), 3) if edge else 0,
        "time": round(mean(v["time"] for v in edge), 1) if edge else 0,
        "confusion": round(mean(v["confusion"] for v in edge), 3) if edge else 0,
    }

    print(json.dumps({
        "seed": SEED,
        "personas": PERSONAS,
        "tasks": TASKS,
        "label": "synthetic design study v2; not observed platform data",
        "summary": summary,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
