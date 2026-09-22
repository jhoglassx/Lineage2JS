import UAActor, { EPhysics_T } from "../un-aactor";
import { UObject } from "@l2js/core";
import FVector from "../un-vector";
import FBox from "@client/assets/unreal/un-box";
import FColor from "@client/assets/unreal/un-color";
import cyrb53 from "@client/utils/hash-cyrb";

type StaticMeshActorDecodeResult_T = { object: GD.IStaticMeshActorDecodeInfo, leafIndices: number[], zoneUuid: string, geometryUuid: string, zoneBounds: { min: number[], max: number[] } } | null;

abstract class FAccessory extends UObject {
    // public unkBytes: Uint8Array;

    // public load(pkg: UPackage, tag?: PropertyTag): this {
    //     this.unkBytes = new Uint8Array(pkg.read(BufferValue.allocBytes(11)).bytes.buffer);

    //     return this;
    // }
}

function getSwayPhase(uuid: string): number {
    return cyrb53(uuid) / Number.MAX_SAFE_INTEGER * Math.PI * 2;
}

function getSceneObjectReference(value: any): GD.ISceneObjectReference | null {
    if (!value) return null;

    // H5 scene export must not force-load referenced assets. In particular,
    // Lineage2JS StaticMesh binary geometry is not the Genesis geometry source;
    // UModel is authoritative for mesh payloads. Metadata available on the
    // object reference is enough to resolve the imported UE5 asset later.
    //
    // Do not expose Lineage2JS's runtime uuid here: UObject.uuid contains a
    // generated UUID and therefore changes between runs. External scene
    // reconstruction needs a deterministic source identity.
    const ctor = value?.constructor;
    const pkg = value?.pkg;
    const packagePath = pkg?.path ?? pkg?.name ?? "unknown-package";
    const objectPath = value?.name ?? value?.objectName ?? "unknown-object";
    const exportIndex = Number.isInteger(value?.exportIndex) ? value.exportIndex : null;
    const sourceId = exportIndex !== null
        ? `${packagePath}#export:${exportIndex}`
        : `${packagePath}#object:${objectPath}`;

    return {
        sourceId,
        package: pkg?.name ?? null,
        path: pkg?.path ?? null,
        objectPath: value?.name ?? null,
        exportIndex,
        name: value?.objectName ?? value?.name ?? null,
        class: ctor?.friendlyName ?? ctor?.name ?? null
    };
}

function getSceneArrayValues(value: any): any[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;

    const count = typeof value.getElemCount === "function"
        ? Number(value.getElemCount())
        : typeof value.length === "number"
            ? Number(value.length)
            : 0;

    const result: any[] = [];
    for (let index = 0; index < count; index++) {
        result.push(
            typeof value.getElem === "function"
                ? value.getElem(index)
                : value[index]
        );
    }
    return result;
}

abstract class UStaticMeshActor extends UAActor {

    declare protected mesh: GA.UStaticMesh | GA.UTexture;
    declare protected instance: GA.UStaticMeshInstance;

    declare protected colLocation: FVector;
    declare protected touching: C.FIndexArray;
    declare protected isUpdatingShadow: boolean;
    declare protected stepSound1: GA.USound;
    declare protected stepSound2: GA.USound;
    declare protected stepSound3: GA.USound;
    declare protected isCollidingActors: boolean;

    declare protected isBlockingZeroExtentTraces: boolean;
    declare protected isBlockingNonZeroExtentTraces: boolean;

    declare protected forcedRegion: number;

    declare protected lodViewDuration: number;
    declare protected currentLod: number;
    declare protected isUnlit: boolean;
    declare protected isShadowCast: boolean;

    declare protected serverObjectID: number;
    declare protected serverObjectRealID: number;
    declare protected serverObjectType: number;

    declare protected hasStaticLighting: boolean;
    declare protected isLightingVisibile: boolean;
    declare protected isDynamicLightMover: boolean;

    declare protected isAgitDefaultStaticMesh: boolean;
    declare protected agitID: number;
    declare protected accessoryIndex: number;
    declare protected accessoryTypeList: C.FArray<FAccessory>;

    declare protected disableSorting: boolean;
    declare protected lodBias: number;

    declare protected leaves: GA.FLeaf[];

    // protected _agitStatus: any;
    // protected _currAccessoryType: any;
    // protected _bTimeReactor: any;
    // protected _showTime: any;
    // protected _hideTime: any;
    // protected _bExactProjectileCollision: any;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "StaticMesh": "mesh",
            "StaticMeshInstance": "instance",

            "ColLocation": "colLocation",
            "Touching": "touching",
            "bUpdateShadow": "isUpdatingShadow",
            "StepSound_1": "stepSound1",
            "StepSound_2": "stepSound2",
            "StepSound_3": "stepSound3",
            "bCollideActors": "isCollidingActors",
            "bBlockZeroExtentTraces": "isBlockingZeroExtentTraces",
            "bBlockNonZeroExtentTraces": "isBlockingNonZeroExtentTraces",

            "ForcedRegion": "forcedRegion",

            "L2LodViewDuration": "lodViewDuration",
            "L2CurrentLod": "currentLod",
            "bUnlit": "isUnlit",
            "bShadowCast": "isShadowCast",

            "L2ServerObjectType": "serverObjectType",
            "L2ServerObjectID": "serverObjectID",
            "L2ServerObjectRealID": "serverObjectRealID",


            "bStaticLighting": "hasStaticLighting",
            "bLightingVisibility": "isLightingVisibile",
            "bDynamicLightMover": "isDynamicLightMover",

            "bAgitDefaultStaticMesh": "isAgitDefaultStaticMesh",
            "AgitID": "agitID",
            "AccessoryIndex": "accessoryIndex",
            "AccessoryTypeList": "accessoryTypeList",

            "bDisableSorting": "disableSorting",
            "LODBias": "lodBias",

            "Leaves": "leaves",

            // "AgitStatus": "_agitStatus",
            // "CurrAccessoryType": "_currAccessoryType",
            // "bTimeReactor": "_bTimeReactor",
            // "ShowTime": "_showTime",
            // "HideTime": "_hideTime",
            // "bExactProjectileCollision": "_bExactProjectileCollision",
        });
    }

    protected getActorDecodeInfo(): Partial<GD.IStaticMeshActorDecodeInfo> { return {}; }

    /**
     * Return deterministic source metadata for rebuilding this actor in an
     * external scene. Geometry/material extraction remains in getDecodeInfo();
     * this method only describes the source actor, mesh reference and transform.
     */
    public getSceneExportInfo(): GD.IStaticMeshActorSceneExportInfo | null {
        if (this.isDeleteMe || this.isPendingDelete || !this.mesh) return null;

        const meshRef = getSceneObjectReference(this.mesh);
        if (!meshRef) return null;

        const skins = getSceneArrayValues(this.skins).map((skin, slot) => ({
            slot,
            material: getSceneObjectReference(skin)
        } as GD.ISceneSkinReference));

        return {
            schemaVersion: 1,
            sourceId: this.getSceneSourceId(),
            exportIndex: Number.isInteger(this.exportIndex) ? this.exportIndex : null,
            objectPath: this.name ?? null,
            type: "StaticMeshActor",
            name: this.objectName ?? null,
            class: this.constructor.friendlyName ?? this.constructor.name ?? null,
            mesh: meshRef,
            skins,
            transform: this.getSceneTransformInfo(),
            // Geometry/bounds are intentionally not decoded here for H5.
            // UModel remains the authoritative Genesis geometry backend.
            bounds: null
        };
    }

    public getDecodeInfo(builder: GD.DecodeLibraryBuilder): StaticMeshActorDecodeResult_T {
        const library = builder.library;

        if (!this.mesh) {
            console.warn(`StaticMeshActor '${this.objectName}' has no static mesh, skipping`);
            return null;
        }

        const mesh = this.mesh.loadSelf() as GA.UStaticMesh;
        const meshInfo = builder.pullStaticMesh(mesh, null);

        const level = this.getLevel();
        const baseModel = level.getModel();
        const localToWorld = this.localToWorld();

        // Calculate bounding box for leaves (needed for export and lighting)
        const predictedBox = mesh.getRenderBoundingBox(this).transformBy(localToWorld);

        this.instance?.loadSelf().setActor(this);

        const isStatic = this.physics === EPhysics_T.PHYS_None;

        // AMover defaults Physics=PHYS_MovingBrush, bStatic=False (Mover.uc); retail gates
        // static per-vertex lighting on bStatic || (mover && !bDynamicLightMover) (UnStaticMesh.cpp Illuminate)
        const isMoverWithoutDynamicLight = this.physics === EPhysics_T.PHYS_MovingBrush && !this.isDynamicLightMover;

        if (!isStatic && !isMoverWithoutDynamicLight) {
            return this.getActorDecodeResult(library, meshInfo, null, predictedBox, null);
        }

        if (this.isHiddenInEditor) {
            // Still export actor even if hidden, is this really needed?
            return this.getActorDecodeResult(library, meshInfo, null, predictedBox, null);
        }

        const leaves: GA.FLeaf[] = baseModel ? baseModel.boxLeaves(predictedBox) : [];
        const instance = this.instance ? this.instance.getDecodeInfo(library) : null

        // if (attributes.positions.length / 3 === 1587)
        //     debugger;

        const instanceColors = (mesh.useVertexColor && instance?.color) || null;
        const ambActor = this.getAmbientLightingActor();
        const xmodel = this.levelInfo.getLevel().getModel();

        let ambX = 0, ambY = 0, ambZ = 0;

        if (!this.isSunAffected) {
            if (leaves.length > 0) {
                for (const leaf of leaves) { // seems that precalculated may be wrong for some objects and need to re-calc from zone, already had this regression, not sure why i gone back to using zone vector
                    const amb = xmodel.getZoneActor(leaf.iZone).ambientVector;

                    ambX = Math.max(ambX, amb.x);
                    ambY = Math.max(ambY, amb.y);
                    ambZ = Math.max(ambZ, amb.z);
                }
            } else {
                [ambX, ambY, ambZ] = this.getZone().ambientVector.getElements();
            }
        }

        const ambVector = FColor.fromFloating(ambX, ambY, ambZ).toArray() as number[];
        const ambientProps = {
            glow: ambActor.ambientGlow,
            vector: ambVector,
            isUnlit: this.isUnlit
        };

        return this.getActorDecodeResult(library, meshInfo, instanceColors, predictedBox, ambientProps, instance?.lights);
    }

    protected getActorDecodeResult(library: GD.DecodeLibrary, meshInfo: GD.IStaticMeshObjectDecodeInfo, instanceColors: Float32Array | Uint8Array | null, predictedBox: GA.FBox, ambient: { glow: number, vector: number[], isUnlit: boolean }, lights?: GD.ILightInstanceDecodeInfo): StaticMeshActorDecodeResult_T {
        this.instance?.loadSelf().setActor(this);

        const geometryInfo = library.geometries[meshInfo.geometry];
        if (!geometryInfo) {
            console.warn(`Geometry info not found for meshInfo.geometry: ${meshInfo.geometry}, actor: ${this.objectName}`);
            return null;
        }

        const level = this.getLevel();
        const baseModel = level.getModel();
        const zone = this.getZone();
        const _position = this.location.getElements();

        // skip actors outside of the sector as it doesn't make sense
        if (library.sector) {
            const sectorSize = 256 * 128;
            const gridMinX = (library.sector[0] - 20) * sectorSize;
            const gridMaxX = gridMinX + sectorSize;
            const gridMinY = (library.sector[1] - 18) * sectorSize;
            const gridMaxY = gridMinY + sectorSize;
            const loc = this.location;

            if (loc.x < gridMinX || loc.x > gridMaxX ||
                loc.y < gridMinY || loc.y > gridMaxY) {
                return null;
            }
        }

        // physicsRotation only runs when bRotateToDesired or bFixedRotationDir is set (UnPhysic.cpp:401);
        // fixed-dir spin is `result += deltaRate` per axis, 65536 units per revolution (fixedTurn, UnPhysic.cpp:460)
        const rotating = this.physics === EPhysics_T.PHYS_Rotating && this.isFixedRotationDir && this.rotationRate && (this.rotationRate.pitch !== 0 || this.rotationRate.yaw !== 0 || this.rotationRate.roll !== 0)
            ? { rotator: [this.rotation.pitch, this.rotation.yaw, this.rotation.roll], rate: [this.rotationRate.pitch, this.rotationRate.yaw, this.rotationRate.roll] } as GD.IRotatingDecodeInfo
            : undefined;

        const actorInfo = {
            uuid: this.uuid,
            type: "StaticMeshActor",
            name: this.objectName,
            position: _position,
            scaledGlow: this.scaleGlow,
            isSunAffected: this.isSunAffected,
            ambient,
            rotating,
            dontBatch: !!this.dontBatch || !!rotating,
            isRangeIgnored: !!this.isRangeIgnored,
            scale: this.scale?.multiplyScalar(this.drawScale).getElements() || [1, 1, 1],
            quaternion: this.rotation?.getQuaternionElements() || [0, 0, 0, 1],
            instance: {
                mesh: meshInfo,
                type: "StaticMeshInstance",
                uuid: this.instance?.uuid || null,
                name: this.instance?.objectName || null,
                swayPhase: getSwayPhase(this.uuid),
                attributes: { colors: instanceColors },
                lights
            } as GD.IStaticMeshInstanceDecodeInfo,
            bounds: {
                min: [predictedBox.min.x, predictedBox.min.y, predictedBox.min.z],
                max: [predictedBox.max.x, predictedBox.max.y, predictedBox.max.z]
            },
            ...this.getActorDecodeInfo()
        } as GD.IStaticMeshActorDecodeInfo;

        const extent = predictedBox.getExtents();
        const margin = extent.multiplyScalar(0.05);
        const inflatedBox = FBox.make(predictedBox.min.sub(margin), predictedBox.max.add(margin), 1);

        actorInfo.bounds = {
            isValid: true,
            min: [inflatedBox.min.x, inflatedBox.min.y, inflatedBox.min.z],
            max: [inflatedBox.max.x, inflatedBox.max.y, inflatedBox.max.z]
        };

        let actorZoneMask = 0n;
        let leafIndices: number[] = [];

        if (baseModel) {
            const origin = inflatedBox.getCenter();
            const inflatedExtent = inflatedBox.getExtents();
            leafIndices = baseModel.boxLeavesRecursive(0, origin, inflatedExtent);

            for (const leafIndex of leafIndices) {
                const leaf = library.bspLeaves[leafIndex];
                if (leaf && leaf.zone !== undefined && leaf.zone >= 0) {
                    actorZoneMask |= (1n << BigInt(leaf.zone));
                }
            }
        }

        actorInfo.zoneMask = actorZoneMask;

        let zoneBounds: { min: number[], max: number[] } = null;
        if (geometryInfo.bounds?.box) {
            const { min, max } = geometryInfo.bounds.box;
            const _min = min.map((v, i) => v + _position[i]);
            const _max = max.map((v, i) => v + _position[i]);

            zoneBounds = { min: _min, max: _max };
        }

        return { object: actorInfo, leafIndices, zoneUuid: zone.uuid, geometryUuid: meshInfo.geometry, zoneBounds };
    }
}

export default UStaticMeshActor;
export { UStaticMeshActor };
