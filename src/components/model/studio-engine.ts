import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { sampleObjectAtFrame } from "@/lib/model-scene";
import type { ModelObject, ModelObjectType, ModelScene, Vec3 } from "@/lib/schema";
import { buildSolarPart, isSolarMeshType } from "./solar-meshes";

export type TransformMode = "select" | "translate" | "rotate" | "scale";
export type ShadingMode = "wire" | "solid" | "material";

export interface EngineHandlers {
  onSelect: (id: string | null) => void;
  onTransform: (id: string, next: { position: Vec3; rotation: Vec3; scale: Vec3 }) => void;
}

function deg(v: THREE.Euler): Vec3 {
  return {
    x: THREE.MathUtils.radToDeg(v.x),
    y: THREE.MathUtils.radToDeg(v.y),
    z: THREE.MathUtils.radToDeg(v.z),
  };
}

function applyTransform(obj: THREE.Object3D, o: ModelObject) {
  obj.position.set(o.position.x, o.position.y, o.position.z);
  obj.rotation.set(
    THREE.MathUtils.degToRad(o.rotation.x),
    THREE.MathUtils.degToRad(o.rotation.y),
    THREE.MathUtils.degToRad(o.rotation.z)
  );
  obj.scale.set(o.scale.x, o.scale.y, o.scale.z);
  obj.visible = o.visible;
}

function geometryFor(type: ModelObjectType, params?: Record<string, number>): THREE.BufferGeometry {
  const segs = Math.max(8, Math.round(params?.segments ?? 32));
  switch (type) {
    case "sphere":
      return new THREE.SphereGeometry(params?.radius ?? 0.5, segs, Math.max(8, Math.round(segs * 0.75)));
    case "cylinder":
      return new THREE.CylinderGeometry(params?.radiusTop ?? 0.5, params?.radiusBottom ?? 0.5, params?.height ?? 1, segs);
    case "cone":
      return new THREE.ConeGeometry(params?.radius ?? 0.5, params?.height ?? 1, segs);
    case "plane":
      return new THREE.PlaneGeometry(params?.width ?? 1, params?.height ?? 1);
    case "torus":
      return new THREE.TorusGeometry(params?.radius ?? 0.45, params?.tube ?? 0.16, 16, segs);
    case "ico":
      return new THREE.IcosahedronGeometry(params?.radius ?? 0.5, params?.detail ?? 1);
    case "cube":
    default:
      return new THREE.BoxGeometry(params?.width ?? 1, params?.height ?? 1, params?.depth ?? 1);
  }
}

export class StudioEngine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly orbit: OrbitControls;
  readonly transform: TransformControls;
  private readonly root = new THREE.Group();
  private readonly helpers = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly nodes = new Map<string, THREE.Object3D>();
  private grid: THREE.GridHelper | null = null;
  private axes = new THREE.AxesHelper(1.4);
  private model: ModelScene;
  private shading: ShadingMode = "material";
  private selectedId: string | null = null;
  private frame = 0;
  private playing = false;
  private last = 0;
  private raf = 0;
  private disposed = false;
  private handlers: EngineHandlers;
  private interactive = true;
  private resizeObserver: ResizeObserver | null = null;
  private downX = 0;
  private downY = 0;

  constructor(canvas: HTMLCanvasElement, model: ModelScene, handlers: EngineHandlers, interactive = true) {
    this.model = model;
    this.handlers = handlers;
    this.interactive = interactive;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(model.background);
    this.scene.add(this.root);
    this.scene.add(this.helpers);
    this.helpers.add(this.axes);

    const cam = model.camera;
    this.camera = new THREE.PerspectiveCamera(cam.fov, 1, 0.05, 200);
    this.camera.position.set(cam.position.x, cam.position.y, cam.position.z);

    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.target.set(cam.target.x, cam.target.y, cam.target.z);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
    this.orbit.enabled = interactive;

    this.transform = new TransformControls(this.camera, this.renderer.domElement);
    this.transform.setSize(0.85);
    this.transform.addEventListener("dragging-changed", (e) => {
      this.orbit.enabled = !e.value && this.interactive;
    });
    this.transform.addEventListener("objectChange", () => this.emitTransform());
    this.scene.add(this.transform.getHelper());

    this.rebuild(model);
    this.resize();
    this.renderer.domElement.addEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.addEventListener("pointerup", this.onPointerUp);
    window.addEventListener("resize", this.resize);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      const parent = canvas.parentElement ?? canvas;
      this.resizeObserver.observe(parent);
    }
    this.tick(0);
  }

  private emitTransform() {
    const obj = this.transform.object;
    if (!obj) return;
    const id = obj.userData.id as string | undefined;
    if (!id) return;
    this.handlers.onTransform(id, {
      position: { x: obj.position.x, y: obj.position.y, z: obj.position.z },
      rotation: deg(obj.rotation),
      scale: { x: obj.scale.x, y: obj.scale.y, z: obj.scale.z },
    });
  }

  private onPointerDown = (e: PointerEvent) => {
    this.downX = e.clientX;
    this.downY = e.clientY;
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.interactive || this.transform.dragging) return;
    const dx = e.clientX - this.downX;
    const dy = e.clientY - this.downY;
    if (dx * dx + dy * dy > 16) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects([...this.nodes.values()], true);
    const hit = hits.find((h) => {
      let n: THREE.Object3D | null = h.object;
      while (n) {
        if (n.userData.id) return true;
        n = n.parent;
      }
      return false;
    });
    if (!hit) {
      if (e.button === 0) this.handlers.onSelect(null);
      return;
    }
    let n: THREE.Object3D | null = hit.object;
    while (n && !n.userData.id) n = n.parent;
    if (n && e.button === 0) this.handlers.onSelect(n.userData.id as string);
  };

  private resize = () => {
    const el = this.renderer.domElement;
    const w = el.clientWidth || el.parentElement?.clientWidth || 1;
    const h = el.clientHeight || el.parentElement?.clientHeight || 1;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  };

  private makeNode(src: ModelObject): THREE.Object3D {
    const group = new THREE.Group();
    group.userData.id = src.id;
    group.userData.type = src.type;
    group.name = src.name;

    if (src.type === "light") {
      const kind = src.light?.kind ?? "directional";
      const color = new THREE.Color(src.light?.color ?? "#fff4e0");
      const intensity = src.light?.intensity ?? 1.2;
      let light: THREE.Light;
      if (kind === "point") light = new THREE.PointLight(color, intensity, 40);
      else if (kind === "spot") light = new THREE.SpotLight(color, intensity, 40, 0.5, 0.3);
      else if (kind === "ambient") light = new THREE.AmbientLight(color, intensity);
      else {
        const dir = new THREE.DirectionalLight(color, intensity);
        dir.castShadow = true;
        dir.shadow.mapSize.set(1024, 1024);
        light = dir;
      }
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 12, 12),
        new THREE.MeshBasicMaterial({ color })
      );
      bulb.userData.helper = true;
      group.add(light);
      group.add(bulb);
    } else if (src.type === "camera") {
      const helper = new THREE.Mesh(
        new THREE.ConeGeometry(0.12, 0.22, 8),
        new THREE.MeshBasicMaterial({ color: 0x88aaff, wireframe: true })
      );
      helper.rotation.x = Math.PI / 2;
      group.add(helper);
    } else if (src.type === "empty") {
      group.add(new THREE.AxesHelper(0.4));
    } else if (isSolarMeshType(src.type)) {
      buildSolarPart(group, src, this.shading);
      group.userData.params = src.params ?? {};
    } else {
      const geo = geometryFor(src.type, src.params);
      const mat = new THREE.MeshStandardMaterial({
        color: src.material?.color ?? "#c8c4bc",
        metalness: src.material?.metalness ?? 0.15,
        roughness: src.material?.roughness ?? 0.45,
        emissive: src.material?.emissive ?? "#000000",
        emissiveIntensity: src.material?.emissiveIntensity ?? 0,
        transparent: (src.material?.opacity ?? 1) < 1,
        opacity: src.material?.opacity ?? 1,
        wireframe: this.shading === "wire" || !!src.material?.wireframe,
        flatShading: this.shading === "solid",
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.id = src.id;
      group.add(mesh);
    }
    applyTransform(group, src);
    return group;
  }

  rebuild(model: ModelScene) {
    this.model = model;
    this.scene.background = new THREE.Color(model.background);
    this.root.clear();
    this.nodes.clear();
    if (this.grid) {
      this.helpers.remove(this.grid);
      this.grid.dispose();
      this.grid = null;
    }
    if (model.grid) {
      this.grid = new THREE.GridHelper(20, 20, 0x5a534a, 0x2e2a26);
      this.helpers.add(this.grid);
    }
    this.axes.visible = model.grid;
    for (const obj of model.objects) {
      const sampled = sampleObjectAtFrame(obj, model.keyframes, this.frame);
      const node = this.makeNode(sampled);
      this.nodes.set(obj.id, node);
      this.root.add(node);
    }
    this.attachSelected();
  }

  /** Incremental update: rebuild only when the object set or shading inputs change. */
  sync(model: ModelScene) {
    const prevIds = [...this.nodes.keys()].sort().join(",");
    const nextIds = model.objects.map((o) => o.id).sort().join(",");
    const typeChanged = model.objects.some((o) => this.nodes.get(o.id)?.userData.type !== o.type);
    const paramsChanged = model.objects.some((o) => {
      const node = this.nodes.get(o.id);
      return !!node && JSON.stringify(node.userData.params ?? null) !== JSON.stringify(o.params ?? null);
    });
    const structureChanged =
      prevIds !== nextIds ||
      typeChanged ||
      paramsChanged ||
      this.model.background !== model.background ||
      this.model.grid !== model.grid;
    this.model = model;
    this.scene.background = new THREE.Color(model.background);
    if (structureChanged) {
      this.rebuild(model);
      return;
    }
    for (const obj of model.objects) {
      const node = this.nodes.get(obj.id);
      if (!node) continue;
      const draggingThis = this.transform.dragging && this.selectedId === obj.id;
      if (!draggingThis) {
        applyTransform(node, sampleObjectAtFrame(obj, model.keyframes, this.frame));
      }
      const mesh =
        node.children.find((c): c is THREE.Mesh => c instanceof THREE.Mesh && c.userData.primary) ??
        node.children.find((c): c is THREE.Mesh => c instanceof THREE.Mesh && !c.userData.helper);
      if (mesh && mesh.material instanceof THREE.MeshStandardMaterial && obj.material) {
        mesh.material.color.set(obj.material.color);
        mesh.material.metalness = obj.material.metalness;
        mesh.material.roughness = obj.material.roughness;
        mesh.material.emissive.set(obj.material.emissive);
        mesh.material.emissiveIntensity = obj.material.emissiveIntensity;
        mesh.material.opacity = obj.material.opacity;
        mesh.material.transparent = obj.material.opacity < 1;
        mesh.material.wireframe = this.shading === "wire" || obj.material.wireframe;
        mesh.material.needsUpdate = true;
      }
    }
    this.attachSelected();
  }

  setFrame(frame: number) {
    this.frame = frame;
    for (const obj of this.model.objects) {
      const node = this.nodes.get(obj.id);
      if (!node) continue;
      applyTransform(node, sampleObjectAtFrame(obj, this.model.keyframes, frame));
    }
  }

  setPlaying(playing: boolean) {
    this.playing = playing;
  }

  setSelected(id: string | null) {
    this.selectedId = id;
    this.attachSelected();
  }

  setMode(mode: TransformMode) {
    if (mode === "select") {
      this.transform.detach();
      return;
    }
    this.transform.setMode(mode);
    this.attachSelected();
  }

  setShading(mode: ShadingMode) {
    this.shading = mode;
    this.rebuild(this.model);
  }

  private attachSelected() {
    const node = this.selectedId ? this.nodes.get(this.selectedId) : undefined;
    const src = this.model.objects.find((o) => o.id === this.selectedId);
    if (!this.interactive || !node || !src || src.locked) {
      this.transform.detach();
      return;
    }
    this.transform.attach(node);
  }

  focusSelected() {
    const node = this.selectedId ? this.nodes.get(this.selectedId) : undefined;
    const box = new THREE.Box3();
    if (node) box.setFromObject(node);
    else box.setFromObject(this.root);
    if (box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3()).length();
    const center = box.getCenter(new THREE.Vector3());
    this.orbit.target.copy(center);
    this.camera.position.copy(center.clone().add(new THREE.Vector3(size * 0.7, size * 0.45, size * 0.8)));
  }

  private tick = (t: number) => {
    if (this.disposed) return;
    const dt = this.last ? (t - this.last) / 1000 : 0;
    this.last = t;
    if (this.playing) {
      this.frame = (this.frame + dt * this.model.fps) % this.model.duration;
      this.setFrame(this.frame);
    }
    this.orbit.update();
    this.renderer.render(this.scene, this.camera);
    this.raf = requestAnimationFrame(this.tick);
  };

  screenshot(): string {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL("image/png");
  }

  exportGLB(): Promise<Blob> {
    const exporter = new GLTFExporter();
    return new Promise((resolve, reject) => {
      exporter.parse(
        this.root,
        (result) => {
          if (result instanceof ArrayBuffer) resolve(new Blob([result], { type: "model/gltf-binary" }));
          else resolve(new Blob([JSON.stringify(result)], { type: "model/gltf+json" }));
        },
        reject,
        { binary: true }
      );
    });
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.renderer.domElement.removeEventListener("pointerdown", this.onPointerDown);
    this.renderer.domElement.removeEventListener("pointerup", this.onPointerUp);
    window.removeEventListener("resize", this.resize);
    this.resizeObserver?.disconnect();
    this.transform.dispose();
    this.orbit.dispose();
    this.renderer.dispose();
  }
}
