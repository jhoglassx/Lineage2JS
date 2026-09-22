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

Returns schema version 1, source-only metadata for external reconstruction:

- deterministic `sourceId` based on package path + export index;
- source name, source class, export index and object path;
- mesh reference with deterministic source identity, package/path/name/class metadata;
- skin/material override references by slot without forcing referenced assets to load;
- the normalized UE2 scene transform above;
- `bounds: null` by design.

Lineage2JS runtime `uuid` values are intentionally excluded from this contract because they contain a generated UUID and change between runs. Missing skin entries remain null rather than being guessed.

The scene contract also deliberately avoids `StaticMesh.loadSelf()`. UModel remains the authoritative H5 geometry backend for Genesis; this API only supplies UE2 scene semantics and references.

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
  "source": {
    "package": "17_25",
    "path": "Maps/17_25.unr",
    "archiveVersion": 0,
    "licenseeVersion": 0
  },
  "actors": [
    {
      "schemaVersion": 1,
      "sourceId": "Maps/17_25.unr#export:42",
      "exportIndex": 42,
      "objectPath": "17_25.StaticMeshActor42",
      "type": "StaticMeshActor",
      "name": "StaticMeshActor42",
      "class": "StaticMeshActor",
      "mesh": {
        "sourceId": "StaticMeshes/example.usx#export:7",
        "package": "example",
        "path": "StaticMeshes/example.usx",
        "objectPath": "example.MeshName",
        "exportIndex": 7,
        "name": "MeshName",
        "class": "StaticMesh"
      },
      "skins": [],
      "transform": {
        "position": [0, 0, 0],
        "quaternion": [0, 0, 0, 1],
        "scale": [1, 1, 1],
        "localToWorld": [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
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

## High Five compatibility audit - current migration scope

Upstream targets older Lineage II data (the README documents C4), so Genesis does not assume that a successful parse implies High Five semantic parity.

Current status for the UE5 migration path:

| Area | H5 status | Genesis policy |
| --- | --- | --- |
| decoded UE2 package header/tables | VALIDATED-IN-PIPELINE | version metadata is emitted on scene reports; C4 fixture assertions were removed from the Genesis core fork |
| Core/Engine script bytecode | H5-FIXED | unknown native-call indices are parsed by UE2 token class in the Genesis core fork |
| material dependency discovery | H5-FIXED | High Five `GlowModifier` is registered in the Genesis core fork |
| material semantics | CROSS-VALIDATED | Lineage2JS is primary semantic decoder; UEViewer is used as an independent witness for disputed edges/null state |
| StaticMesh geometry | NOT AUTHORITATIVE | Genesis uses UModel for geometry; scene export must never force Lineage2JS StaticMesh geometry decode |
| StaticMeshActor named properties | VALIDATED-IN-PIPELINE | used for mesh refs and transforms; source archive/license versions remain attached to the report |
| actor transform math | READY-FOR-VISUAL-VALIDATION | Lineage2JS supplies UE2 LocalToWorld including PrePivot; the UE2->UE5 bridge is still intentionally outside this fork |
| Terrain/BSP | NOT YET H5-VALIDATED FOR GENESIS | do not use as migration authority until cross-backend/visual validation is completed |
| SkeletalMesh/Animation | NOT YET H5-VALIDATED FOR GENESIS | UEViewer shows multiple Lineage2 version-gated layouts; audit separately before character migration |
| Emitters/Lights/Fog/Movers | NOT YET H5-VALIDATED FOR GENESIS | extend only after map StaticMeshActor reconstruction is proven |

### H5 scene-export safety rules

- `UStaticMeshActor.getSceneExportInfo()` does **not** call `StaticMesh.loadSelf()`. Loading the full Lineage2JS StaticMesh geometry would accidentally make an unvalidated C4-era geometry parser part of the H5 migration path.
- scene records and mesh/skin references use deterministic `sourceId` values. The normal Lineage2JS `uuid` contains a generated UUID and is session-random, so it is excluded from the Genesis scene contract.
- mesh/skin references carry package path, object path and export index without forcing the referenced asset to decode.
- each level scene report includes `archiveVersion` and `licenseeVersion`; compatibility can therefore be audited from generated artifacts instead of inferred from the Chronicle name.
- geometry bounds remain null in this source-only scene contract until they can be sourced from the authoritative Genesis geometry path.

## High Five compatibility policy

Upstream `stable` targets older Lineage II data (the upstream README documents C4). Genesis therefore treats High Five compatibility as an explicit, versioned contract rather than assuming forward compatibility.

Rules for `genesis/stable`:

- low-level package fixes live in the pinned `jhoglassx/l2js-core` Genesis revision;
- every H5 report should preserve Unreal archive/licensee versions so format decisions can be traced to the actual source package;
- parsing success is not considered semantic validation;
- StaticMesh geometry is not authoritative for the Genesis migration path; UModel remains the geometry backend until Lineage2JS H5 geometry is separately validated;
- material disagreements are cross-checked against UEViewer rather than guessed;
- Terrain/BSP, SkeletalMesh/Animation, emitters, lights and other systems must be audited independently before they become migration authorities.

The current Genesis core pin includes H5 native-token parsing, GlowModifier package dependency support, and removal of an upstream C4 map-specific package-header fixture.
