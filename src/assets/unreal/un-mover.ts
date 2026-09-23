import UStaticMeshActor from "./static-mesh/un-static-mesh-actor";
import FRotator from "./un-rotator";

enum EMoverGlideType_T {
    MV_MoveByTime,
    MV_GlideByTime
}

// Likely for doors and stuff
abstract class UMover extends UStaticMeshActor {
    public readonly careUnread: boolean = false;

    declare protected moverGlideType: EMoverGlideType_T;
    declare protected keyNum: number;
    declare protected numKeys: number;
    declare protected moveTime: number;
    declare protected stayOpenTime: number;
    declare protected delayTime: number;
    declare protected triggerOnceOnly: boolean;
    declare protected keyPos: (GA.FVector | null)[];
    declare protected keyRot: (GA.FRotator | null)[];
    declare protected basePos: GA.FVector;
    declare protected baseRot: GA.FRotator;
    declare protected initialState: string;

    protected getPropertyMap() {
        return Object.assign({}, super.getPropertyMap(), {
            "MoverGlideType": "moverGlideType",
            "KeyNum": "keyNum",
            "NumKeys": "numKeys",
            "MoveTime": "moveTime",
            "StayOpenTime": "stayOpenTime",
            "DelayTime": "delayTime",
            "bTriggerOnceOnly": "triggerOnceOnly",
            "KeyPos": "keyPos",
            "KeyRot": "keyRot",
            "BasePos": "basePos",
            "BaseRot": "baseRot",
            "InitialState": "initialState"
        });
    }

    public getDynamicSceneExportInfo(): GD.IDynamicStaticMeshActorSceneExportInfo | null {
        const actor = this.getSceneExportInfo();
        if (!actor) return null;

        const mover = this.getActorDecodeInfo().mover;
        if (!mover) return null;

        return {
            schemaVersion: 1,
            actor,
            behavior: {
                kind: "mover",
                mover
            }
        };
    }

    protected getActorDecodeInfo(): Partial<GD.IStaticMeshActorDecodeInfo> {
        const keyPositions: GD.Vector3Arr[] = [];
        const keyQuaternions: GD.QuaternionArr[] = [];
        const numKeys = Math.max(0, Number(this.numKeys ?? 0));
        const basePos = this.basePos ?? this.location;
        const baseRot = this.baseRot ?? this.rotation;

        for (let i = 0; i < numKeys; i++) {
            const keyPos = this.keyPos?.[i] ?? null;
            const keyRot = this.keyRot?.[i] ?? null;
            const rot = FRotator.make(
                (baseRot?.pitch ?? 0) + (keyRot ? keyRot.pitch : 0),
                (baseRot?.yaw ?? 0) + (keyRot ? keyRot.yaw : 0),
                (baseRot?.roll ?? 0) + (keyRot ? keyRot.roll : 0)
            );

            keyPositions.push([
                (basePos?.x ?? 0) + (keyPos ? keyPos.x : 0),
                (basePos?.y ?? 0) + (keyPos ? keyPos.y : 0),
                (basePos?.z ?? 0) + (keyPos ? keyPos.z : 0)
            ]);
            keyQuaternions.push(rot.getQuaternionElements());
        }

        return {
            dontBatch: true,
            mover: {
                initialState: this.initialState,
                keyNum: Number(this.keyNum ?? 0),
                keyPositions,
                keyQuaternions,
                moveTime: this.moveTime,
                stayOpenTime: this.stayOpenTime,
                delayTime: this.delayTime,
                collisionRadius: this.collisionRadius,
                collisionHeight: this.collisionHeight,
                isGliding: this.moverGlideType === EMoverGlideType_T.MV_GlideByTime,
                triggerOnceOnly: this.triggerOnceOnly
            }
        };
    }
}

export default UMover;
export { UMover, EMoverGlideType_T };
