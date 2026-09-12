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
  opts: { yard: number; camera: Vec3; target: Vec3; fov: number }
) {
  scene.objects.push(
    createModelObject("plane", {
      name: "Yard",
      material: defaultMaterial("#7a6d5a"),
      scale: vec(opts.yard, opts.yard, 1),
    }),
    createModelObject("light", {
      name: "Sun",
      position: vec(8, 12, 6),
      light: { kind: "directional", intensity: 2.15, color: "#fff1cc" },
    }),
    createModelObject("light", {
      name: "Sky fill",
      position: vec(-4, 4, 3),
      light: { kind: "point", intensity: 0.7, color: "#b7c8dc" },
    }),
    createModelObject("light", {
      name: "Ambient",
      position: vec(0, 3, 0),
      light: { kind: "ambient", intensity: 0.38, color: "#c5d0dc" },
    }),
    createModelObject("camera", { name: "Camera", position: opts.camera })
  );
  scene.camera = { position: opts.camera, target: opts.target, fov: opts.fov };
}

function addTankAndHose(scene: ModelScene, tank: Vec3, hoseTo: Vec3) {
  const yaw = (Math.atan2(hoseTo.x - tank.x, hoseTo.z - tank.z) * 180) / Math.PI;
  scene.objects.push(
    createModelObject("cube", {
      name: "Tank pad",
      position: vec(tank.x, 0.03, tank.z),
      scale: vec(1.15, 0.06, 1.15),
      material: defaultMaterial("#5c5348"),
    }),
    createModelObject("tank", {
      name: "Water tank",
      position: tank,
      material: defaultMaterial("#d5e1e8"),
      params: { radius: 0.38, height: 1.05 },
    }),
    createModelObject("cylinder", {
      name: "Supply hose",
      position: vec(tank.x + 0.15, 0.14, tank.z - 0.55),
      rotation: vec(90, yaw, 0),
      scale: vec(0.04, 1.15, 0.04),
      material: defaultMaterial("#4a90c8"),
    })
  );
}

/**
 * Default design bench: one PV module, its mount, and the self-cleaning
 * hardware (rails, robot, brush, nozzles, tank) so the cleaner can be
 * designed against a single panel.
 */
export function solarPanelScene(): ModelScene {
  const scene = emptyModelScene();
  scene.background = "#1a222c";
  scene.duration = 96;
  scene.fps = 24;

  addYardAndLights(scene, {
    yard: 8,
    camera: vec(3.05, 1.55, 3.55),
    target: vec(0.05, 0.88, 0.05),
    fov: 40,
  });

  scene.objects.push(addModule(scene, "Solar panel", vec(0, 1.15, 0)));
  const travel = PANEL_W / 2 + 0.12;
  addCleaningRig(scene, -travel, travel, 0.78, PANEL_W + 0.55);
  addTankAndHose(scene, vec(-1.75, 0.48, 1.05), vec(-0.15, 0.2, 0.78));
  return scene;
}

/** A 4-panel row with mounts, rails, a water tank, and an animated cleaner. */
export function solarCleaningScene(): ModelScene {
  const scene = emptyModelScene();
  scene.background = "#1a222c";
  scene.duration = 96;
  scene.fps = 24;

  addYardAndLights(scene, {
    yard: 14,
    camera: vec(6.2, 1.85, 7.6),
    target: vec(0.2, 0.7, 0.25),
    fov: 46,
  });
  addRow(scene, "Panel", 0);
  const railLen = (COUNT - 1) * SPACING + PANEL_W + 0.4;
  addCleaningRig(scene, panelX(0) - 0.55, panelX(COUNT - 1) + 0.55, 0.78, railLen);
  addTankAndHose(scene, vec(panelX(0) - 2.6, 0.48, 1.35), vec(panelX(0), 0.2, 0.78));
  return scene;
}

/** Optional courtyard: panels wrap three sides so the robot sits in an array. */
export function solarSurroundScene(): ModelScene {
  const scene = emptyModelScene();
  scene.background = "#1a222c";
  scene.duration = 96;
  scene.fps = 24;

  addYardAndLights(scene, {
    yard: 22,
    camera: vec(5.8, 1.72, 7.15),
    target: vec(0.35, 0.68, 0.55),
    fov: 46,
  });

  addRow(scene, "Back panel", BACK_Z);
  addRow(scene, "Front panel", 0);

  const wingX = panelX(0) - SPACING;
  const eastX = panelX(COUNT - 1) + SPACING;
  const wings: ModelObject[] = [];
  for (const [i, z] of [2.05, 3.55].entries()) {
    wings.push(addModule(scene, `West panel ${i + 1}`, vec(wingX, 1.15, z)));
    wings.push(addModule(scene, `East panel ${i + 1}`, vec(eastX, 1.15, z)));
  }
  scene.objects.push(...wings);

  const railLen = (COUNT - 1) * SPACING + PANEL_W + 0.4;
  addCleaningRig(scene, -0.25, panelX(COUNT - 1) + 0.55, 0.78, railLen);
  addTankAndHose(scene, vec(-2.15, 0.52, 3.35), vec(-0.25, 0.2, 0.78));
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

/** Append a single-panel design bench beside whatever is already in the scene. */
export function insertSolarPanelKit(scene: ModelScene): ModelScene {
  return insertKit(scene, solarPanelScene());
}

/** Append a cleaning-row kit beside whatever is already in the scene. */
export function insertSolarCleaningKit(scene: ModelScene): ModelScene {
  return insertKit(scene, solarCleaningScene());
}

/** Append a surrounding courtyard array beside the current scene. */
export function insertSolarSurroundKit(scene: ModelScene): ModelScene {
  return insertKit(scene, solarSurroundScene());
}
