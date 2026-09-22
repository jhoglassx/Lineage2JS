# Genesis fork

This fork is maintained for the Lineage2 High Five -> Unreal Engine 5 Genesis migration pipeline.

## Upstream

- Repository: realratchet/Lineage2JS
- Upstream branch: stable
- Genesis base branch: genesis/stable

## Scope

Keep UE2/Lineage II interpretation here:

- package/class semantic decoding
- actors, static meshes, terrain, BSP, lights and emitters
- material semantics
- UE2 transforms, pivots, scale and rotation
- deterministic scene metadata needed by the Genesis migration pipeline

Keep UE5-specific creation/import logic in Lineage2_H5_Genesis.

Changes should stay generic and source-driven. Do not hard-code individual maps, actors, packages or material names.

The Genesis branch uses the matching jhoglassx/l2js-core genesis/stable branch so parser fixes can be versioned independently from higher-level Lineage2JS semantics.

## H5 scene export contract

The Genesis fork exposes source-driven scene metadata directly from the UE2 actor model.
This avoids reimplementing UE2 transform rules in the UE5 Python layer.

### UAActor.getSceneTransformInfo()

Returns both the effective transform and the original UE2 values:

- `position`: translation from the complete UE2 `LocalToWorld` matrix. This includes `PrePivot`.
- `quaternion`: UE2 actor rotation converted by the existing Lineage2JS rotator implementation.
- `scale`: `DrawScale3D * DrawScale`.
- `localToWorld`: the native 4x4 UE2 matrix, with no Genesis/UE5 axis conversion applied.
- `source.location`, `source.rotation`, `source.drawScale`, `source.drawScale3D`, `source.prePivot`, and `source.postPivot`: raw source values retained for diagnostics.

The fork deliberately does **not** convert UE2 coordinates to UE5 coordinates. That conversion belongs to the Genesis coordinate bridge so it can be validated against the actual mesh import path (UModel/glTF/Interchange) once, centrally.

### UStaticMeshActor.getSceneExportInfo()

Returns schema version 1 metadata containing:

- Lineage2JS actor UUID, source name and source class;
- mesh reference: UUID, package, package path, object name and class;
- skin/material override references by slot;
- the normalized scene transform above;
- source-space world render bounds when Lineage2JS can calculate them.

Bounds are diagnostic metadata and never block export. Missing skin entries are preserved as null references rather than guessed.

### Intended pipeline

```text
H5 .unr
  -> l2js-core package parsing
  -> Lineage2JS actor semantics
  -> getSceneExportInfo()
  -> Genesis map-scene.json
  -> one validated UE2 -> UE5 coordinate bridge
  -> UE5 Level Builder
```

The current scope is StaticMeshActor-compatible actors. Mover, terrain, lights, fog, emitters and other scene types should extend the same source-driven contract rather than creating separate ad-hoc conversion paths.

### ULevel.getStaticMeshSceneExportInfo()

The level now exposes a collection API that walks its actor table and invokes `getSceneExportInfo()` only on actors that support the scene contract. This keeps map exporters independent from protected Lineage2JS actor internals.

The returned object is schema version 1:

```json
{
  "schemaVersion": 1,
  "map": "17_25",
  "actors": [
    {
      "schemaVersion": 1,
      "uuid": "...",
      "type": "StaticMeshActor",
      "name": "...",
      "class": "StaticMeshActor",
      "mesh": {
        "uuid": "...",
        "package": "...",
        "path": "...",
        "name": "...",
        "class": "StaticMesh"
      },
      "skins": [],
      "transform": {
        "position": [0, 0, 0],
        "quaternion": [0, 0, 0, 1],
        "scale": [1, 1, 1],
        "localToWorld": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        "source": {
          "location": [0, 0, 0],
          "rotation": { "pitch": 0, "yaw": 0, "roll": 0 },
          "drawScale": 1,
          "drawScale3D": [1, 1, 1],
          "prePivot": [0, 0, 0],
          "postPivot": [0, 0, 0]
        }
      },
      "bounds": null
    }
  ],
  "errors": []
}
```

Actors marked deleted/pending-delete are intentionally omitted. Per-actor decode failures are captured in `errors` so one malformed object does not abort the entire map scene export.
