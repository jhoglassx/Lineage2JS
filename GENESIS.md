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
