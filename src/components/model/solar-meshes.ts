import * as THREE from "three";
import type { ModelObject } from "@/lib/schema";
import type { ShadingMode } from "./studio-engine";

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function mat(
  color: string,
  shading: ShadingMode,
  extras: { metalness?: number; roughness?: number; emissive?: string; emissiveIntensity?: number } = {}
) {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: extras.metalness ?? 0.2,
    roughness: extras.roughness ?? 0.4,
    emissive: extras.emissive ?? "#000000",
    emissiveIntensity: extras.emissiveIntensity ?? 0,
    wireframe: shading === "wire",
    flatShading: shading === "solid",
  });
}

function box(
  group: THREE.Group,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
  primary = false
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (primary) mesh.userData.primary = true;
  group.add(mesh);
  return mesh;
}

function cyl(
  group: THREE.Group,
  rTop: number,
  rBot: number,
  h: number,
  x: number,
  y: number,
  z: number,
  material: THREE.Material,
  rx = 0,
  rz = 0
) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, 20), material);
  mesh.position.set(x, y, z);
  mesh.rotation.x = rx;
  mesh.rotation.z = rz;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

export function buildSolarPart(group: THREE.Group, src: ModelObject, shading: ShadingMode) {
  const p = src.params ?? {};
  const base = src.material?.color;
  switch (src.type) {
    case "solarPanel": {
      const w = p.width ?? 1.7;
      const h = p.height ?? 1.0;
      const t = p.thickness ?? 0.045;
      const cols = clamp(Math.round(p.cellsX ?? 6), 2, 12);
      const rows = clamp(Math.round(p.cellsY ?? 10), 2, 16);
      const glass = mat(base ?? "#1b3358", shading, { metalness: 0.68, roughness: 0.14 });
      const frame = mat("#c5ccd3", shading, { metalness: 0.86, roughness: 0.28 });
      const cell = mat("#152a4a", shading, { metalness: 0.55, roughness: 0.22 });
      const bus = mat("#d7dde2", shading, { metalness: 0.9, roughness: 0.2 });
      box(group, w, h, t, 0, 0, 0, glass, true);
      box(group, w + 0.045, h + 0.045, t + 0.014, 0, 0, -0.006, frame);
      const inset = 0.055;
      const gap = 0.01;
      const cellW = (w - inset * 2 - gap * (cols - 1)) / cols;
      const cellH = (h - inset * 2 - gap * (rows - 1)) / rows;
      const startX = -w / 2 + inset + cellW / 2;
      const startY = -h / 2 + inset + cellH / 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          box(
            group,
            cellW,
            cellH,
            0.005,
            startX + c * (cellW + gap),
            startY + r * (cellH + gap),
            t / 2 + 0.002,
            cell
          );
        }
      }
      box(group, w - inset * 2, 0.007, 0.004, 0, 0, t / 2 + 0.005, bus);
      box(group, 0.007, h - inset * 2, 0.004, 0, 0, t / 2 + 0.005, bus);
      break;
    }
    case "mount": {
      const height = p.height ?? 1.05;
      const alu = mat(base ?? "#c5ccd3", shading, { metalness: 0.86, roughness: 0.28 });
      box(group, 0.09, height, 0.09, 0, height / 2, 0, alu, true);
      box(group, 0.07, 0.72, 0.07, 0, 0.55, -0.28, alu);
      box(group, 0.42, 0.06, 0.08, 0, 0.04, 0.02, alu);
      box(group, 1.05, 0.05, 0.06, 0, height * 0.92, 0.02, alu);
      break;
    }
    case "rail": {
      const length = p.length ?? 8;
      const alu = mat(base ?? "#c5ccd3", shading, { metalness: 0.86, roughness: 0.28 });
      box(group, length, 0.055, 0.055, 0, 0, 0, alu, true);
      box(group, length, 0.018, 0.08, 0, 0.03, 0, alu);
      break;
    }
    case "cleaner": {
      const body = mat(base ?? "#c4a265", shading, { metalness: 0.35, roughness: 0.4 });
      const dark = mat("#2a2a2a", shading, { metalness: 0.4, roughness: 0.5 });
      const glass = mat("#1b3358", shading, { metalness: 0.6, roughness: 0.2 });
      box(group, 0.78, 0.28, 0.5, 0, 0, 0, body, true);
      box(group, 0.46, 0.14, 0.28, 0, 0.18, -0.02, dark);
      box(group, 0.34, 0.03, 0.22, 0, 0.26, -0.02, glass);
      cyl(group, 0.07, 0.07, 0.08, -0.22, -0.12, 0.12, dark, 0, Math.PI / 2);
      cyl(group, 0.07, 0.07, 0.08, 0.22, -0.12, 0.12, dark, 0, Math.PI / 2);
      cyl(group, 0.07, 0.07, 0.08, -0.22, -0.12, -0.12, dark, 0, Math.PI / 2);
      cyl(group, 0.07, 0.07, 0.08, 0.22, -0.12, -0.12, dark, 0, Math.PI / 2);
      break;
    }
    case "brush": {
      const radius = p.radius ?? 0.08;
      const length = p.length ?? 1.05;
      const bristle = mat(base ?? "#2a2a2a", shading, { metalness: 0.1, roughness: 0.85 });
      const core = mat("#6b6b6b", shading, { metalness: 0.5, roughness: 0.4 });
      cyl(group, radius, radius, length, 0, 0, 0, bristle);
      cyl(group, radius * 0.35, radius * 0.35, length + 0.04, 0, 0, 0, core);
      group.children[0] && ((group.children[0] as THREE.Mesh).userData.primary = true);
      break;
    }
    case "nozzle": {
      const metal = mat(base ?? "#4a90c8", shading, { metalness: 0.7, roughness: 0.25 });
      cyl(group, 0.018, 0.018, 0.1, 0, 0.02, 0, metal);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 12), metal);
      cone.position.set(0, -0.06, 0);
      cone.rotation.x = Math.PI;
      cone.castShadow = true;
      cone.userData.primary = true;
      group.add(cone);
      break;
    }
    case "tank": {
      const radius = p.radius ?? 0.38;
      const height = p.height ?? 0.72;
      const shell = mat(base ?? "#d5e1e8", shading, { metalness: 0.25, roughness: 0.35 });
      const band = mat("#c4a265", shading, { metalness: 0.4, roughness: 0.4 });
      cyl(group, radius, radius, height, 0, 0, 0, shell);
      group.children[0] && ((group.children[0] as THREE.Mesh).userData.primary = true);
      cyl(group, radius + 0.01, radius + 0.01, 0.05, 0, 0.08, 0, band);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.92, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), shell);
      cap.position.set(0, height / 2, 0);
      cap.castShadow = true;
      group.add(cap);
      box(group, 0.08, 0.12, 0.08, radius * 0.7, -height / 2 + 0.12, 0, band);
      break;
    }
    default:
      break;
  }
}

export function isSolarMeshType(type: string) {
  return (
    type === "solarPanel" ||
    type === "mount" ||
    type === "rail" ||
    type === "cleaner" ||
    type === "brush" ||
    type === "nozzle" ||
    type === "tank"
  );
}
