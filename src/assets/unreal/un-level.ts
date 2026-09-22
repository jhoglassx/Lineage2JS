import FURL from "./un-url";
import { UObject, BufferValue } from "@l2js/core";
import { FObjectArray } from "@l2js/core/unreal/un-array";

const LOAD_SUB_OBJECTS = true;
const LOAD_SOUNDS = false;
const NUM_LEVEL_TEXT_BLOCKS = 16;

abstract class ULevelBase extends UObject {
    public readonly url: FURL = new FURL();

    protected ambientActors: FObjectArray<GA.AActor>;
    protected actors: FObjectArray<GA.AActor>;

    public doLoad(pkg: C.APackage, exp: C.UExport) {
        super.doLoad(pkg, exp);

        const verLicense = pkg.header.getLicenseeVersion();

        if (verLicense >= 23) {
            let dbNum = 0, dbMax = 0;

            dbNum = pkg.read("int32");
            dbMax = pkg.read("int32");

            this.ambientActors = FObjectArray.loadOfSize(dbNum, pkg);

            dbNum = pkg.read("int32");
            dbMax = pkg.read("int32");

            this.actors = FObjectArray.loadOfSize(dbNum, pkg);
        } else {
            // stock ue2 layout (older chronicle maps): a single actor array, no ambient pair
            const dbNum = pkg.read("int32");

            pkg.read("int32"); // dbMax

            this.ambientActors = FObjectArray.loadOfSize(0, pkg);
            this.actors = FObjectArray.loadOfSize(dbNum, pkg);
        }

        this.url.load(pkg);
    }
}

abstract class ULevel extends ULevelBase {
    public baseModelId: number;
    public levelInfoId: number;

    protected baseModel: GA.UModel;
    public levelInfo: GA.ULevelInfo;

    public get timeSeconds() { return 0; };

    protected info: GA.ULevelInfo;

    protected approxTime: number;
    protected firstDeletedId: number;

    protected objectList: UObject[] = [];

    public getInfo() { return this.info; }
    public setInfo(info: GA.ULevelInfo) { this.info = info; }

    public getModel() { return this.baseModel; }
    public getActors() { return this.actors; }
    public getAmbientActors() { return this.ambientActors; }

    /**
     * Collect source-driven StaticMeshActor-compatible scene records.
     * Actor-specific interpretation remains on the actor class itself; the
     * level only discovers objects exposing getSceneExportInfo().
     */
    public getStaticMeshSceneExportInfo(): GD.ILevelStaticMeshSceneExportInfo {
        const actors: GD.IStaticMeshActorSceneExportInfo[] = [];
        const deferredActors: GD.ISceneDeferredActor[] = [];
        const errors: GD.ISceneExportError[] = [];

        for (const actorRef of this.actors || []) {
            if (!actorRef) continue;

            // Do not load unrelated H5 actors just to discover their type.
            // The dynamic UObject already has its native prototype before its
            // serialized properties are loaded, so the scene-export method is
            // a safe capability check. This keeps Terrain/Emitter/Light/etc.
            // parsers outside the current StaticMeshActor migration boundary.
            if (typeof (actorRef as any)?.getSceneExportInfo !== "function") continue;

            // Mover and MovableStaticMeshActor have additional chronicle-
            // sensitive behavior/property layouts. Their base mesh placement
            // is intentionally deferred until those actor types receive their
            // own H5 audit; do not load them as a side effect of this export.
            const ctor = actorRef.constructor as any;
            const actorClass = ctor?.friendlyName ?? ctor?.name ?? null;
            const inheritance = Array.isArray(ctor?.inheritenceChain)
                ? ctor.inheritenceChain
                : [];
            const deferredClass = ["Mover", "MovableStaticMeshActor"].find(
                name => actorClass === name || inheritance.includes(name)
            );

            if (deferredClass) {
                deferredActors.push({
                    actor: actorRef.objectName ?? actorRef.name ?? null,
                    class: actorClass,
                    reason: `H5 audit pending for ${deferredClass}`
                });
                continue;
            }

            try {
                const actor = actorRef.loadSelf() as any;
                const info = actor.getSceneExportInfo() as GD.IStaticMeshActorSceneExportInfo | null;
                if (info) actors.push(info);
            } catch (error: any) {
                errors.push({
                    actor: actorRef.objectName ?? actorRef.name ?? null,
                    class: actorRef.constructor?.friendlyName ?? actorRef.constructor?.name ?? null,
                    error: error?.stack ?? error?.message ?? String(error)
                });
            }
        }

        return {
            schemaVersion: 1,
            map: this.url?.map ?? null,
            source: {
                package: this.pkg?.name ?? null,
                path: this.pkg?.path ?? null,
                archiveVersion: this.pkg?.header?.getArchiveFileVersion?.() ?? null,
                licenseeVersion: this.pkg?.header?.getLicenseeVersion?.() ?? null
            },
            actors,
            deferredActors,
            errors
        };
    }

    public doLoad(pkg: C.APackage, exp: C.UExport) {
        super.doLoad(pkg, exp);

        const verArchive = pkg.header.getArchiveFileVersion();

        this.baseModelId = pkg.read("compat32");

        if (verArchive < 98) {
            debugger;
        }

        this.approxTime = pkg.read("float");

        this.firstDeletedId = pkg.read("compat32");
        const textBlockIds = new Array<number>(NUM_LEVEL_TEXT_BLOCKS);

        for (let i = 0; i < NUM_LEVEL_TEXT_BLOCKS; i++)
            textBlockIds[i] = pkg.read("compat32");

        if (verArchive > 62) {
            const travelInfoPairsCount = pkg.read("compat32");

            if (travelInfoPairsCount !== 0)
                debugger;
        } else if (verArchive >= 61) {
            debugger;
        }

        this.levelInfo = this.actors[0] as GA.ULevelInfo;
        this.levelInfo.setLevel(this);

        if (LOAD_SUB_OBJECTS) {
            this.baseModel = pkg.fetchObject<GA.UModel>(this.baseModelId);

            if (LOAD_SOUNDS) {
                this.objectList = this.objectList.concat(this.ambientActors);
            }

            this.objectList = this.objectList.concat(this.actors);

            console.assert(this.levelInfo.constructor.friendlyName === "LevelInfo");
        }

        this.readHead = this.readTail;

        console.assert(this.bytesUnread === 0);

        return this;
    }

    // public getDecodeInfo(library: DecodeLibrary): IBaseObjectDecodeInfo {
    //     const groupedObjectList = this.objectList.reduce((accum, obj) => {

    //         const constrName = (obj.constructor as any).isDynamicClass
    //             ? (obj.constructor as any).getConstructorName()
    //             : obj.constructor.name;

    //         accum[constrName] = accum[constrName] || [];
    //         accum[constrName].push(obj);

    //         return accum;
    //     }, {} as Record<string, UObject[]>);

    //     for (const emitter of (groupedObjectList.Emitter as UEmitter[]))
    //         emitter.loadSelf().getDecodeInfo(library);

    //     // debugger;

    //     // return {
    //     //     type: "Level",
    //     //     name: this.url.map,
    //     //     children: (await Promise.all([
    //     //         this.baseModel.getDecodeInfo(library),
    //     //         "ATerrainInfo" in groupedObjectList ? Promise.all(groupedObjectList["ATerrainInfo"].map((exp: ATerrainInfo) => exp.getDecodeInfo(library))) : Promise.resolve([]),
    //     //         "UStaticMeshActor" in groupedObjectList ? Promise.all(groupedObjectList["UStaticMeshActor"].map((exp: UStaticMeshActor) => exp.getDecodeInfo(library))) : Promise.resolve([])
    //     //     ])).flat()
    //     // };
    // }
}

export default ULevel;
export { ULevel };
