import type {
  OfficeThreeSceneObject,
  OfficeThreeVector3,
} from "./orchestrator-office-three-types";
import {
  createOfficeThreeMotionRuntime,
  officeThreeObjectCanMove,
  type OfficeThreeMotionRuntimeTarget,
} from "./orchestrator-office-three-motion";
import type {
  OfficeThreeCanvasSize,
  OfficeThreeRendererAdapter,
  OfficeThreeRendererCanvas,
  OfficeThreeRendererLifecycle,
  OfficeThreeRendererLifecycleInput,
} from "./orchestrator-office-three-renderer-types";

export { officeThreeRendererAdapter } from "./orchestrator-office-three-adapter";
export type {
  OfficeThreeAnimationFrameScheduler,
  OfficeThreeCanvasSize,
  OfficeThreeMaterialInput,
  OfficeThreeRendererAdapter,
  OfficeThreeRendererCanvas,
  OfficeThreeRendererLifecycle,
  OfficeThreeRendererLifecycleInput,
} from "./orchestrator-office-three-renderer-types";

type OfficeThreeMeshResource<TGeometry, TMaterial> = {
  readonly geometry: TGeometry;
  readonly material: TMaterial;
};

const officeThreeDefaultPixelRatio = 1;
const officeThreeKeyLightPosition = [4, 7, 5] satisfies OfficeThreeVector3;
const officeThreeNoRotation = [0, 0, 0] satisfies OfficeThreeVector3;
const officeThreeUnitScale = [1, 1, 1] satisfies OfficeThreeVector3;

function assertNever(value: never): never {
  throw new Error(`Unhandled office Three.js scene object: ${value}`);
}

function aspectFor(size: OfficeThreeCanvasSize): number {
  return size.height > 0 ? size.width / size.height : 1;
}

function canvasSizeFor(
  canvas: OfficeThreeRendererCanvas,
): OfficeThreeCanvasSize {
  return {
    height: canvas.clientHeight > 0 ? canvas.clientHeight : canvas.height,
    width: canvas.clientWidth > 0 ? canvas.clientWidth : canvas.width,
  };
}

function geometryForObject<
  TCanvas extends OfficeThreeRendererCanvas,
  TRenderer,
  TScene,
  TCamera,
  TNode,
  TMesh extends TNode,
  TGeometry,
  TMaterial,
  TBackground,
>(
  adapter: OfficeThreeRendererAdapter<
    TCanvas,
    TRenderer,
    TScene,
    TCamera,
    TNode,
    TMesh,
    TGeometry,
    TMaterial,
    TBackground
  >,
  object: OfficeThreeSceneObject,
): TGeometry {
  switch (object.shape) {
    case "box":
      return adapter.createBoxGeometry();
    case "cylinder":
      return adapter.createCylinderGeometry();
    case "sphere":
      if (object.kind === "agent") {
        return adapter.createSphereGeometry(object.radius);
      }
      return adapter.createSphereGeometry(0.5);
    case undefined:
      break;
    default:
      return assertNever(object.shape);
  }

  switch (object.kind) {
    case "agent":
      return adapter.createSphereGeometry(object.radius);
    case "amenity":
    case "desk":
    case "nameplate":
    case "room":
      return adapter.createBoxGeometry();
    default:
      return assertNever(object);
  }
}

function scaleForObject(object: OfficeThreeSceneObject): OfficeThreeVector3 {
  switch (object.kind) {
    case "agent":
      return officeThreeUnitScale;
    case "amenity":
    case "desk":
    case "nameplate":
    case "room":
      return object.scale;
    default:
      return assertNever(object);
  }
}

export function createOfficeThreeRendererLifecycle<
  TCanvas extends OfficeThreeRendererCanvas,
  TRenderer,
  TScene,
  TCamera,
  TNode,
  TMesh extends TNode,
  TGeometry,
  TMaterial,
  TBackground,
>(
  input: OfficeThreeRendererLifecycleInput<
    TCanvas,
    TRenderer,
    TScene,
    TCamera,
    TNode,
    TMesh,
    TGeometry,
    TMaterial,
    TBackground
  >,
): OfficeThreeRendererLifecycle<TRenderer, TScene, TCamera, TNode, TMesh> {
  const { adapter, animationFrame, canvas, contract } = input;
  const renderer = adapter.createRenderer({ antialias: true, canvas });
  const scene = adapter.createScene();
  const root = adapter.createRoot();
  const initialSize = canvasSizeFor(canvas);
  const camera = adapter.createPerspectiveCamera(
    contract.camera.fov,
    aspectFor(initialSize),
    contract.camera.near,
    contract.camera.far,
  );
  const meshResources: OfficeThreeMeshResource<TGeometry, TMaterial>[] = [];
  const motionTargets: OfficeThreeMotionRuntimeTarget<TMesh>[] = [];
  const meshesByObjectId = new Map<string, TMesh>();
  let disposed = false;
  let animationFrameId: number | undefined;

  adapter.setPixelRatio(
    renderer,
    input.pixelRatio ?? officeThreeDefaultPixelRatio,
  );
  adapter.setSceneBackground(
    scene,
    adapter.createColor(contract.scene.background),
  );
  adapter.setPosition(camera, contract.camera.position);
  adapter.pointCameraAt(camera, contract.camera.target);
  adapter.addToScene(scene, root);

  for (const object of contract.scene.objects) {
    const geometry = geometryForObject(adapter, object);
    const material = adapter.createMaterial({
      color: object.color,
      opacity: object.opacity ?? 1,
    });
    const mesh = adapter.createMesh(geometry, material);

    adapter.setPosition(mesh, object.position);
    adapter.setRotation(mesh, object.rotation ?? officeThreeNoRotation);
    adapter.setScale(mesh, scaleForObject(object));
    adapter.setVisible(mesh, object.visible ?? true);
    adapter.addToObject(root, mesh);
    meshResources.push({ geometry, material });
    meshesByObjectId.set(object.id, mesh);
    if (officeThreeObjectCanMove(object)) {
      motionTargets.push({ mesh, object });
    }
  }

  const ambientLight = adapter.createAmbientLight("#f7efe0", 1.35);
  const directionalLight = adapter.createDirectionalLight("#ffffff", 2.4);
  adapter.setPosition(directionalLight, officeThreeKeyLightPosition);
  adapter.addToScene(scene, ambientLight);
  adapter.addToScene(scene, directionalLight);
  const motionRuntime = createOfficeThreeMotionRuntime({
    mode: contract.scene.motion.mode,
    onFrameDiagnostics: input.onFrameDiagnostics,
    setPosition: adapter.setPosition,
    setRotation: adapter.setRotation,
    targets: motionTargets,
  });

  function resize(size: OfficeThreeCanvasSize): void {
    if (disposed) return;
    adapter.setSize(renderer, size.width, size.height, false);
    adapter.setCameraAspect(camera, aspectFor(size));
    adapter.updateProjectionMatrix(camera);
  }

  function render(): void {
    if (disposed) return;
    adapter.render(renderer, scene, camera);
  }

  function tick(time: number): void {
    if (disposed) return;
    motionRuntime.apply(time);
    render();
    animationFrameId = animationFrame.request(tick);
  }

  function stop(): void {
    if (animationFrameId === undefined) return;
    animationFrame.cancel(animationFrameId);
    animationFrameId = undefined;
  }

  function start(): void {
    if (disposed || animationFrameId !== undefined) return;
    animationFrameId = animationFrame.request(tick);
  }

  function dispose(): void {
    if (disposed) return;
    disposed = true;
    stop();
    for (const resource of meshResources) {
      adapter.disposeGeometry(resource.geometry);
      adapter.disposeMaterial(resource.material);
    }
    adapter.disposeRenderer(renderer);
  }

  resize(initialSize);

  return {
    camera,
    dispose,
    getDiagnostics: motionRuntime.getDiagnostics,
    meshesByObjectId,
    render,
    renderer,
    resize,
    root,
    scene,
    start,
    stop,
  };
}
