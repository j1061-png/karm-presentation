import { nanoid } from "nanoid";
import {
  ModelObjectSchema,
  ModelSceneSchema,
  type ModelObject,
  type ModelObjectType,
  type ModelScene,
  type Vec3,
} from "./schema";

export function vec(x = 0, y = 0, z = 0): Vec3 {
  return { x, y, z };
}

export function defaultMaterial(color = "#c8c4bc") {
  return {
    color,
    metalness: 0.15,
    roughness: 0.45,
    emissive: "#000000",
    emissiveIntensity: 0,
    opacity: 1,
    wireframe: false,
  };
}

export function glassMaterial() {
  return { ...defaultMaterial("#1b3358"), metalness: 0.68, roughness: 0.14 };
}

export function aluminumMaterial() {
  return { ...defaultMaterial("#c5ccd3"), metalness: 0.86, roughness: 0.28 };
}

export function safetyMaterial() {
  return { ...defaultMaterial("#c4a265"), metalness: 0.35, roughness: 0.4 };
}

function solarObjectDefaults(type: ModelObjectType): Partial<ModelObject> {
  switch (type) {
    case "solarPanel":
      return {
        position: vec(0, 1.15, 0),
        rotation: vec(-28, 0, 0),
        material: glassMaterial(),
        params: { width: 1.7, height: 1.0, thickness: 0.045, cellsX: 6, cellsY: 10 },
      };
    case "mount":
      return { position: vec(0, 0, 0.08), material: aluminumMaterial(), params: { height: 1.05 } };
    case "rail":
      return { position: vec(0, 0.62, 0.62), material: aluminumMaterial(), params: { length: 8 } };
    case "cleaner":
      return { position: vec(0, 1.12, 0.68), material: safetyMaterial(), params: { width: 0.55 } };
    case "brush":
      return {
        position: vec(0, 1.08, 0.22),
        rotation: vec(90, 0, 0),
        material: defaultMaterial("#2a2a2a"),
        params: { radius: 0.08, length: 1.05 },
      };
    case "nozzle":
      return { position: vec(0, 1.28, 0.42), material: defaultMaterial("#4a90c8") };
    case "tank":
      return {
        position: vec(-2.2, 0.48, -0.55),
        material: defaultMaterial("#d5e1e8"),
        params: { radius: 0.38, height: 0.72 },
      };
    default:
      return {};
  }
}

function structureDefaults(type: ModelObjectType): Partial<ModelObject> {
  if (type !== "lattice") return {};
  return {
    position: vec(0, 0.9, 0),
    material: { ...defaultMaterial("#9aa3ab"), metalness: 0.88, roughness: 0.32 },
    params: { width: 2.4, height: 1.8, depth: 2.4, cellsX: 3, cellsY: 2, cellsZ: 3, bar: 0.045, diagonals: 0 },
  };
}

export function createModelObject(
  type: ModelObjectType,
  extras: Partial<ModelObject> = {}
): ModelObject {
  const names: Record<ModelObjectType, string> = {
    cube: "Cube",
    sphere: "Sphere",
    cylinder: "Cylinder",
    cone: "Cone",
    plane: "Plane",
    torus: "Torus",
    ico: "Ico Sphere",
    light: "Light",
    camera: "Camera",
    empty: "Empty",
    solarPanel: "Solar panel",
    mount: "Mount",
    rail: "Guide rail",
    cleaner: "Cleaning robot",
    brush: "Brush roller",
    nozzle: "Spray nozzle",
    tank: "Water tank",
    lattice: "Metal lattice",
  };
  const typedDefaults = { ...solarObjectDefaults(type), ...structureDefaults(type) };
  const base: ModelObject = {
    id: nanoid(8),
    name: extras.name ?? names[type],
    type,
    visible: true,
    locked: false,
    position: extras.position ?? typedDefaults.position ?? (type === "plane" ? vec(0, 0, 0) : vec(0, type === "light" ? 5 : 0.75, 0)),
    rotation: extras.rotation ?? typedDefaults.rotation ?? (type === "plane" ? vec(-90, 0, 0) : vec()),
    scale: extras.scale ?? (type === "plane" ? vec(8, 8, 1) : vec(1, 1, 1)),
    params: extras.params ?? typedDefaults.params,
    material:
      type === "light" || type === "camera" || type === "empty"
        ? undefined
        : extras.material ?? typedDefaults.material ?? defaultMaterial(),
    light:
      type === "light"
        ? extras.light ?? { kind: "directional", intensity: 1.4, color: "#fff4e0" }
        : extras.light,
  };
  return ModelObjectSchema.parse(base);
}

export function emptyModelScene(): ModelScene {
  return ModelSceneSchema.parse({
    background: "#161412",
    objects: [],
    keyframes: [],
    fps: 24,
    duration: 96,
    grid: true,
    camera: { position: vec(6, 4.5, 7), target: vec(0, 0.8, 0), fov: 50 },
  });
}
