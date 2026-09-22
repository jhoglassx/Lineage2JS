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
