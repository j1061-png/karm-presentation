import { nanoid } from "nanoid";
import {
  aluminumMaterial,
  createModelObject,
  defaultMaterial,
  emptyModelScene,
  glassMaterial,
  safetyMaterial,
  vec,
} from "./model-object";
import type { ModelKeyframe, ModelObject, ModelObjectType, ModelScene, Vec3 } from "./schema";

export const SOLAR_TYPES: ModelObjectType[] = [
  "solarPanel",
  "mount",
  "rail",
  "cleaner",
  "brush",
  "nozzle",
  "tank",
];

export function isSolarType(type: ModelObjectType): boolean {
  return SOLAR_TYPES.includes(type);
}

const PANEL_W = 1.7;
const PANEL_H = 1.0;
const TILT = -28;
const COUNT = 4;
const SPACING = 1.9;
const BACK_Z = -2.2;
const WING_X = 4.55;

function panelX(i: number, count = COUNT) {
  return (i - (count - 1) / 2) * SPACING;
}

function key(
  objectId: string,
  frame: number,
  position: ModelObject["position"],
  rotation: ModelObject["rotation"]
): ModelKeyframe {
  return {
    id: nanoid(8),
    objectId,
    frame,
    position: { ...position },
    rotation: { ...rotation },
    scale: { x: 1, y: 1, z: 1 },
  };
}

function isKitFiller(type: ModelObjectType) {
  return type === "camera" || type === "light" || type === "plane";
}

/** One PV module on a tilt, ready to drop into a scene. */
export function createSolarPanel(extras: Partial<ModelObject> = {}): ModelObject {
  return createModelObject("solarPanel", {
    name: extras.name ?? "Solar panel",
    position: extras.position ?? vec(0, 1.15, 0),
    rotation: extras.rotation ?? vec(TILT, 0, 0),
    material: extras.material ?? glassMaterial(),
    params: extras.params ?? { width: PANEL_W, height: PANEL_H, thickness: 0.045, cellsX: 6, cellsY: 10 },
  });
}

function addModule(scene: ModelScene, name: string, position: Vec3, yaw = 0) {
  scene.objects.push(
    createModelObject("mount", {
      name: `${name} mount`,
      position: vec(position.x, 0, position.z + (yaw === 0 ? 0.08 : 0)),
      rotation: vec(0, yaw, 0),
      material: aluminumMaterial(),
      params: { height: 1.05 },
    })
  );
  return createSolarPanel({
    name,
    position,
    rotation: vec(TILT, yaw, 0),
  });
}

function addRow(scene: ModelScene, prefix: string, z: number, count = COUNT) {
  const panels: ModelObject[] = [];
  for (let i = 0; i < count; i++) {
    panels.push(addModule(scene, `${prefix} ${i + 1}`, vec(panelX(i, count), 1.15, z)));
  }
  scene.objects.push(...panels);
  return panels;
}

function addCleaningRig(
  scene: ModelScene,
  startX: number,
  endX: number,
  railZ: number,
  railLen: number
) {
  scene.objects.push(
    createModelObject("rail", {
      name: "Guide rail",
      position: vec(0, 0.58, railZ),
      material: aluminumMaterial(),
      params: { length: railLen },
    }),
    createModelObject("rail", {
      name: "Upper rail",
      position: vec(0, 1.55, railZ - 0.5),
      material: aluminumMaterial(),
      params: { length: railLen },
    })
  );

  const cleanerZ = railZ + 0.17;
  const brushZ = railZ - 0.36;
  const nozzleZ = railZ - 0.16;
  const cleaner = createModelObject("cleaner", {
    name: "Cleaning robot",
    position: vec(startX, 0.95, cleanerZ),
    material: safetyMaterial(),
    params: { width: 0.55 },
  });
  const brush = createModelObject("brush", {
    name: "Brush roller",
    position: vec(startX, 1.15, brushZ),
    rotation: vec(90, 0, 0),
    material: defaultMaterial("#2a2a2a"),
    params: { radius: 0.09, length: 1.1 },
  });
  const nozzleA = createModelObject("nozzle", {
    name: "Spray nozzle L",
    position: vec(startX - 0.14, 1.18, nozzleZ),
    material: defaultMaterial("#4a90c8"),
  });
  const nozzleB = createModelObject("nozzle", {
    name: "Spray nozzle R",
    position: vec(startX + 0.14, 1.18, nozzleZ),
    material: defaultMaterial("#4a90c8"),
  });
  scene.objects.push(cleaner, brush, nozzleA, nozzleB);

  scene.keyframes = [
    { obj: cleaner, y: 0.95, z: cleanerZ, rot: vec() },
    { obj: brush, y: 1.15, z: brushZ, rot0: vec(90, 0, 0), rot1: vec(90, 0, 720) },
    { obj: nozzleA, y: 1.18, z: nozzleZ, rot: vec() },
    { obj: nozzleB, y: 1.18, z: nozzleZ, rot: vec() },
  ].flatMap(({ obj, y, z, rot, rot0, rot1 }) => [
    key(
      obj.id,
      0,
      vec(startX + (obj === nozzleB ? 0.12 : obj === nozzleA ? -0.12 : 0), y, z),
      rot0 ?? rot ?? vec()
    ),
    key(
      obj.id,
      96,
      vec(endX + (obj === nozzleB ? 0.12 : obj === nozzleA ? -0.12 : 0), y, z),
      rot1 ?? rot ?? vec()
    ),
  ]);
}

function addYardAndLights(
  scene: ModelScene,
  opts: { yard: number; camera: Vec3; target: Vec3; fov: number; pathZ?: number }
) {
  scene.objects.push(
    createModelObject("plane", {
      name: "Yard",
      material: defaultMaterial("#4a4034"),
      scale: vec(opts.yard, opts.yard, 1),
    }),
    createModelObject("cube", {
      name: "Service path",
      position: vec(0, 0.015, opts.pathZ ?? 0.45),
      scale: vec(opts.yard * 0.55, 0.03, 3.1),
      material: defaultMaterial("#5c5348"),
    }),
    createModelObject("light", {
      name: "Sun",
      position: vec(7, 11, 5),
      light: { kind: "directional", intensity: 1.85, color: "#fff1cc" },
    }),
    createModelObject("light", {
      name: "Sky fill",
      position: vec(-5, 3.8, -2),
      light: { kind: "point", intensity: 0.45, color: "#9eb6d4" },
    }),
    createModelObject("camera", { name: "Camera", position: opts.camera })
  );
  scene.camera = { position: opts.camera, target: opts.target, fov: opts.fov };
}

function addTankAndHose(scene: ModelScene, tank: Vec3, hoseTo: Vec3) {
  const dx = hoseTo.x - tank.x;
  const dz = hoseTo.z - tank.z;
  const len = Math.max(0.8, Math.hypot(dx, dz));
  const yaw = (Math.atan2(dx, dz) * 180) / Math.PI;
  scene.objects.push(
    createModelObject("tank", {
      name: "Water tank",
      position: tank,
      material: defaultMaterial("#d5e1e8"),
      params: { radius: 0.42, height: 0.85 },
    }),
    createModelObject("cylinder", {
      name: "Supply hose",
      position: vec((tank.x + hoseTo.x) / 2, 0.16, (tank.z + hoseTo.z) / 2),
      rotation: vec(90, yaw, 0),
      scale: vec(0.045, len, 0.045),
      material: defaultMaterial("#4a90c8"),
    })
  );
}

/** A 4-panel row with mounts, rails, a water tank, and an animated cleaner. */
export function solarCleaningScene(): ModelScene {
  const scene = emptyModelScene();
  scene.background = "#1a222c";
  scene.duration = 96;
  scene.fps = 24;

  addYardAndLights(scene, {
    yard: 14,
    camera: vec(6.8, 3.1, 8.6),
    target: vec(0.2, 0.85, 0.15),
    fov: 42,
    pathZ: 0.7,
  });
  addRow(scene, "Panel", 0);
  const railLen = (COUNT - 1) * SPACING + PANEL_W + 0.4;
  addCleaningRig(scene, panelX(0) - 0.55, panelX(COUNT - 1) + 0.55, 0.78, railLen);
  addTankAndHose(scene, vec(panelX(0) - 2.6, 0.48, 1.35), vec(panelX(0), 0.2, 0.78));
  return scene;
}

/**
 * Default studio scene: panels wrap three sides of a courtyard so the
 * self-cleaning robot sits in the middle of an array, not on a lone row.
 */
export function solarSurroundScene(): ModelScene {
  const scene = emptyModelScene();
  scene.background = "#1a222c";
  scene.duration = 96;
  scene.fps = 24;

  addYardAndLights(scene, {
    yard: 22,
    camera: vec(8.6, 3.8, 10.2),
    target: vec(0.1, 0.9, -0.45),
    fov: 40,
    pathZ: 0.15,
  });

  addRow(scene, "Back panel", BACK_Z);

  const left: ModelObject[] = [];
  const right: ModelObject[] = [];
  for (const [i, z] of [-2.2, -0.3].entries()) {
    left.push(addModule(scene, `West panel ${i + 1}`, vec(-WING_X, 1.15, z), 90));
    right.push(addModule(scene, `East panel ${i + 1}`, vec(WING_X, 1.15, z), -90));
  }
  scene.objects.push(...left, ...right);

  scene.objects.push(
    createModelObject("rail", {
      name: "West rail",
      position: vec(-WING_X + 0.82, 0.58, -1.25),
      rotation: vec(0, 90, 0),
      material: aluminumMaterial(),
      params: { length: 3.6 },
    }),
    createModelObject("rail", {
      name: "East rail",
      position: vec(WING_X - 0.82, 0.58, -1.25),
      rotation: vec(0, 90, 0),
      material: aluminumMaterial(),
      params: { length: 3.6 },
    })
  );

  const railLen = (COUNT - 1) * SPACING + PANEL_W + 0.4;
  addCleaningRig(scene, panelX(0) - 0.55, panelX(COUNT - 1) + 0.55, BACK_Z + 0.82, railLen);
  addTankAndHose(scene, vec(-2.55, 0.48, 1.65), vec(panelX(0), 0.2, BACK_Z + 0.82));
  return scene;
}

function insertKit(scene: ModelScene, kit: ModelScene): ModelScene {
  const moved = kit.objects.filter((o) => !isKitFiller(o.type));
  const occupied = scene.objects.some((o) => !isKitFiller(o.type));
  let dz = 0;
  if (occupied && moved.length) {
    const existingMax = Math.max(...scene.objects.map((o) => o.position.z));
    const kitMin = Math.min(...moved.map((o) => o.position.z));
    dz = existingMax - kitMin + 4.4;
  }
  const shifted = moved.map((o) => ({
    ...o,
    position: { ...o.position, z: o.position.z + dz },
  }));
  const idSet = new Set(shifted.map((o) => o.id));
  const keys = kit.keyframes.map((k) =>
    idSet.has(k.objectId) && k.position ? { ...k, position: { ...k.position, z: k.position.z + dz } } : k
  );
  return {
    ...scene,
    objects: [...scene.objects, ...shifted],
    keyframes: [...scene.keyframes, ...keys],
  };
}

/** Append a cleaning-row kit beside whatever is already in the scene. */
export function insertSolarCleaningKit(scene: ModelScene): ModelScene {
  return insertKit(scene, solarCleaningScene());
}

/** Append a surrounding courtyard array beside the current scene. */
export function insertSolarSurroundKit(scene: ModelScene): ModelScene {
  return insertKit(scene, solarSurroundScene());
}
