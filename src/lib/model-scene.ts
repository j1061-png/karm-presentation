import { nanoid } from "nanoid";
import {
  ModelKeyframeSchema,
  ModelObjectSchema,
  ModelSceneSchema,
  type ModelKeyframe,
  type ModelObject,
  type ModelScene,
  type Vec3,
} from "./schema";
import { createModelObject, defaultMaterial, emptyModelScene, vec } from "./model-object";
import { solarCleaningScene, solarPanelScene, solarSurroundScene } from "./solar-kit";

export { createModelObject, defaultMaterial, emptyModelScene, vec };
export {
  insertSolarCleaningKit,
  insertSolarPanelKit,
  insertSolarSurroundKit,
  solarCleaningScene,
  solarPanelScene,
  solarSurroundScene,
} from "./solar-kit";

/** Blank models start as one PV module with a self-cleaning rig to design against. */
export function defaultStudioScene(): ModelScene {
  return solarPanelScene();
}

/** Deterministic scene when the AI is unavailable. */
export function sceneFromPrompt(prompt: string): ModelScene {
  const t = prompt.toLowerCase();
  const scene = emptyModelScene();
  const ground = createModelObject("plane", { name: "Ground", material: defaultMaterial("#2a2723") });
  scene.objects.push(ground);
  scene.objects.push(
    createModelObject("light", {
      name: "Sun",
      position: vec(5, 8, 4),
      light: { kind: "directional", intensity: 1.7, color: "#fff4e0" },
    })
  );

  if (/\b(room|interior|office|kitchen)\b/.test(t)) {
    scene.objects.push(
      createModelObject("cube", {
        name: "Back wall",
        position: vec(0, 1.5, -3),
        scale: vec(6, 3, 0.15),
        material: defaultMaterial("#3d3832"),
      }),
      createModelObject("cube", {
        name: "Desk",
        position: vec(0, 0.45, 0),
        scale: vec(2.4, 0.12, 1.1),
        material: defaultMaterial("#8a6a44"),
      }),
      createModelObject("cube", {
        name: "Monitor",
        position: vec(0, 1.05, -0.3),
        scale: vec(1.1, 0.7, 0.08),
        material: defaultMaterial("#1c1915"),
      })
    );
  } else if (/\b(car|vehicle|truck)\b/.test(t)) {
    scene.objects.push(
      createModelObject("cube", {
        name: "Body",
        position: vec(0, 0.55, 0),
        scale: vec(2.4, 0.55, 1.1),
        material: defaultMaterial("#c45c26"),
      }),
      createModelObject("cube", {
        name: "Cabin",
        position: vec(-0.25, 1.05, 0),
        scale: vec(1.1, 0.5, 1),
        material: defaultMaterial("#1c1915"),
      }),
      createModelObject("cylinder", {
        name: "Wheel FL",
        position: vec(0.7, 0.28, 0.58),
        rotation: vec(90, 0, 0),
        scale: vec(0.28, 0.12, 0.28),
        material: defaultMaterial("#222"),
      }),
      createModelObject("cylinder", {
        name: "Wheel FR",
        position: vec(0.7, 0.28, -0.58),
        rotation: vec(90, 0, 0),
        scale: vec(0.28, 0.12, 0.28),
        material: defaultMaterial("#222"),
      }),
      createModelObject("cylinder", {
        name: "Wheel RL",
        position: vec(-0.7, 0.28, 0.58),
        rotation: vec(90, 0, 0),
        scale: vec(0.28, 0.12, 0.28),
        material: defaultMaterial("#222"),
      }),
      createModelObject("cylinder", {
        name: "Wheel RR",
        position: vec(-0.7, 0.28, -0.58),
        rotation: vec(90, 0, 0),
        scale: vec(0.28, 0.12, 0.28),
        material: defaultMaterial("#222"),
      })
    );
  } else if (/\b(solar row|cleaning row|self[- ]clean(?:ing)? row)\b/.test(t)) {
    return solarCleaningScene();
  } else if (/\b(solar array|solar farm|surrounding (solar|array|panels?)|pv array|pv farm)\b/.test(t)) {
    return solarSurroundScene();
  } else if (
    /\b(solar panels?|photovoltaic|pv module|self[- ]clean(?:ing)?|soiling|cleaning (robot|gantry|brush))\b/.test(t)
  ) {
    return solarPanelScene();
  } else if (/\b(planet|solar system|outer space|galaxy|orbit)\b/.test(t)) {
    scene.grid = false;
    scene.background = "#07080c";
    scene.objects = [
      createModelObject("sphere", {
        name: "Sun",
        position: vec(0, 1, 0),
        scale: vec(1.4, 1.4, 1.4),
        material: { ...defaultMaterial("#ffb347"), emissive: "#ff8c1a", emissiveIntensity: 1.4, roughness: 1 },
      }),
      createModelObject("sphere", {
        name: "Planet",
        position: vec(3.2, 1, 0),
        scale: vec(0.45, 0.45, 0.45),
        material: defaultMaterial("#4d7cff"),
      }),
      createModelObject("light", {
        name: "Star light",
        position: vec(0, 1, 0),
        light: { kind: "point", intensity: 3, color: "#ffd08a" },
      }),
    ];
  } else if (/\b(character|robot|figure|person)\b/.test(t)) {
    scene.objects.push(
      createModelObject("cube", { name: "Torso", position: vec(0, 1.15, 0), scale: vec(0.7, 0.9, 0.4), material: defaultMaterial("#6b7c8a") }),
      createModelObject("sphere", { name: "Head", position: vec(0, 1.85, 0), scale: vec(0.32, 0.32, 0.32), material: defaultMaterial("#d8c4a8") }),
      createModelObject("cube", { name: "Leg L", position: vec(-0.18, 0.4, 0), scale: vec(0.2, 0.8, 0.2), material: defaultMaterial("#3d3832") }),
      createModelObject("cube", { name: "Leg R", position: vec(0.18, 0.4, 0), scale: vec(0.2, 0.8, 0.2), material: defaultMaterial("#3d3832") })
    );
  } else {
    return defaultStudioScene();
  }
  return scene;
}

export function repairScene(input: unknown): ModelScene {
  const parsed = ModelSceneSchema.safeParse(input ?? {});
  if (parsed.success && parsed.data.objects.length > 0) return parsed.data;
  const raw = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {};
  const objects = Array.isArray(raw.objects)
    ? raw.objects
        .map((row) => ModelObjectSchema.safeParse(row))
        .filter((r): r is { success: true; data: ModelObject } => r.success)
        .map((r) => r.data)
    : [];
  const keyframes = Array.isArray(raw.keyframes)
    ? raw.keyframes
        .map((row) => ModelKeyframeSchema.safeParse(row))
        .filter((r): r is { success: true; data: ModelKeyframe } => r.success)
        .map((r) => r.data)
    : [];
  const base = objects.length > 0 ? emptyModelScene() : defaultStudioScene();
  if (objects.length > 0) base.objects = objects;
  base.keyframes = keyframes;
  if (typeof raw.background === "string") base.background = raw.background;
  if (typeof raw.fps === "number") base.fps = raw.fps;
  if (typeof raw.duration === "number") base.duration = raw.duration;
  if (typeof raw.grid === "boolean") base.grid = raw.grid;
  return ModelSceneSchema.parse(base);
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), z: lerp(a.z, b.z, t) };
}

/** Sample an object's animated transform at a frame. */
export function sampleObjectAtFrame(obj: ModelObject, keyframes: ModelKeyframe[], frame: number): ModelObject {
  const ks = keyframes.filter((k) => k.objectId === obj.id).sort((a, b) => a.frame - b.frame);
  if (ks.length === 0) return obj;
  const before = [...ks].reverse().find((k) => k.frame <= frame) ?? ks[0];
  const after = ks.find((k) => k.frame >= frame) ?? ks[ks.length - 1];
  const span = Math.max(1, after.frame - before.frame);
  const t = after.frame === before.frame ? 0 : (frame - before.frame) / span;
  return {
    ...obj,
    position: before.position && after.position ? lerpVec(before.position, after.position, t) : before.position ?? obj.position,
    rotation: before.rotation && after.rotation ? lerpVec(before.rotation, after.rotation, t) : before.rotation ?? obj.rotation,
    scale: before.scale && after.scale ? lerpVec(before.scale, after.scale, t) : before.scale ?? obj.scale,
  };
}

export function insertKeyframe(scene: ModelScene, objectId: string, frame: number): ModelScene {
  const obj = scene.objects.find((o) => o.id === objectId);
  if (!obj) return scene;
  const existing = scene.keyframes.find((k) => k.objectId === objectId && k.frame === frame);
  const key: ModelKeyframe = {
    id: existing?.id ?? nanoid(8),
    objectId,
    frame,
    position: { ...obj.position },
    rotation: { ...obj.rotation },
    scale: { ...obj.scale },
  };
  return {
    ...scene,
    keyframes: [...scene.keyframes.filter((k) => k.id !== key.id), key],
  };
}

export function duplicateModelObject(obj: ModelObject): ModelObject {
  return {
    ...obj,
    id: nanoid(8),
    name: `${obj.name} copy`,
    position: { x: obj.position.x + 0.6, y: obj.position.y, z: obj.position.z + 0.4 },
    material: obj.material ? { ...obj.material } : undefined,
    light: obj.light ? { ...obj.light } : undefined,
    params: obj.params ? { ...obj.params } : undefined,
  };
}

export interface ModelEditResponse {
  summary: string;
  upsert?: ModelObject[];
  deleteIds?: string[];
  keyframes?: ModelKeyframe[];
  background?: string;
  duration?: number;
}

export function applyModelEdit(scene: ModelScene, edit: ModelEditResponse): ModelScene {
  const byId = new Map(scene.objects.map((o) => [o.id, o]));
  for (const obj of edit.upsert ?? []) {
    const parsed = ModelObjectSchema.safeParse(obj);
    if (parsed.success) byId.set(parsed.data.id, parsed.data);
  }
  for (const id of edit.deleteIds ?? []) byId.delete(id);
  let keyframes = scene.keyframes;
  if (edit.keyframes) {
    const parsed = edit.keyframes
      .map((k) => ModelKeyframeSchema.safeParse(k))
      .filter((r): r is { success: true; data: ModelKeyframe } => r.success)
      .map((r) => r.data);
    if (parsed.length) keyframes = parsed;
  }
  return ModelSceneSchema.parse({
    ...scene,
    objects: [...byId.values()],
    keyframes,
    background: edit.background ?? scene.background,
    duration: edit.duration ?? scene.duration,
  });
}
