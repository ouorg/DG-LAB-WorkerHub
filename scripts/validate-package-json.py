#!/usr/bin/env python3
"""Validate npm JSON manifests without silently accepting duplicate object keys."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any


class ManifestError(ValueError):
    pass


def unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ManifestError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"), object_pairs_hook=unique_object)
    except (json.JSONDecodeError, ManifestError) as error:
        raise ManifestError(f"{path}: {error}") from error
    if not isinstance(value, dict):
        raise ManifestError(f"{path}: top-level JSON value must be an object")
    return value


def require_object(manifest: dict[str, Any], path: Path, key: str) -> dict[str, Any]:
    value = manifest.get(key)
    if not isinstance(value, dict):
        raise ManifestError(f"{path}: {key} must be a JSON object")
    return value


def main() -> None:
    package_path = Path("package.json")
    lock_path = Path("package-lock.json")
    package = load_json(package_path)
    lock = load_json(lock_path)
    scripts = require_object(package, package_path, "scripts")
    dependencies = require_object(package, package_path, "devDependencies")
    if scripts.get("deploy") != "./scripts/deploy-worker.sh":
        raise ManifestError(f"{package_path}: scripts.deploy must call ./scripts/deploy-worker.sh")
    if not isinstance(dependencies.get("wrangler"), str):
        raise ManifestError(f"{package_path}: devDependencies.wrangler must be a version string")
    if lock.get("name") != package.get("name") or lock.get("version") != package.get("version"):
        raise ManifestError(f"{lock_path}: name and version must match package.json")
    print("package manifests validated: package.json, package-lock.json")


if __name__ == "__main__":
    try:
        main()
    except ManifestError as error:
        raise SystemExit(str(error)) from error
