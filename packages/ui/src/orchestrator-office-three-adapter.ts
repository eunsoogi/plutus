import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
  SphereGeometry,
  WebGLRenderer,
  type BufferGeometry,
  type Material,
} from "three";
import type { OfficeThreeVector3 } from "./orchestrator-office-three-types";
import type {
  OfficeThreeMaterialInput,
  OfficeThreeRendererAdapter,
} from "./orchestrator-office-three-renderer-types";

export const officeThreeRendererAdapter = {
  addToObject: (parent: Object3D, child: Object3D) => {
    parent.add(child);
  },
  addToScene: (scene: Scene, child: Object3D) => {
    scene.add(child);
  },
  createAmbientLight: (color: string, intensity: number) =>
    new AmbientLight(color, intensity),
  createBoxGeometry: () => new BoxGeometry(1, 1, 1),
  createColor: (color: string) => new Color(color),
  createDirectionalLight: (color: string, intensity: number) =>
    new DirectionalLight(color, intensity),
  createMaterial: (input: OfficeThreeMaterialInput) =>
    new MeshStandardMaterial({
      color: input.color,
      opacity: input.opacity,
      transparent: input.opacity < 1,
    }),
  createMesh: (geometry: BufferGeometry, material: Material) =>
    new Mesh(geometry, material),
  createPerspectiveCamera: (
    fov: number,
    aspect: number,
    near: number,
    far: number,
  ) => new PerspectiveCamera(fov, aspect, near, far),
  createRenderer: (input: {
    readonly antialias: boolean;
    readonly canvas: HTMLCanvasElement;
  }) =>
    new WebGLRenderer({
      antialias: input.antialias,
      canvas: input.canvas,
      preserveDrawingBuffer: true,
    }),
  createRoot: () => new Object3D(),
  createScene: () => new Scene(),
  createSphereGeometry: (radius: number) => new SphereGeometry(radius, 32, 16),
  disposeGeometry: (geometry: BufferGeometry) => {
    geometry.dispose();
  },
  disposeMaterial: (material: Material) => {
    material.dispose();
  },
  disposeRenderer: (renderer: WebGLRenderer) => {
    renderer.dispose();
  },
  pointCameraAt: (camera: PerspectiveCamera, target: OfficeThreeVector3) => {
    camera.lookAt(target[0], target[1], target[2]);
  },
  render: (
    renderer: WebGLRenderer,
    scene: Scene,
    camera: PerspectiveCamera,
  ) => {
    renderer.render(scene, camera);
  },
  setCameraAspect: (camera: PerspectiveCamera, aspect: number) => {
    camera.aspect = aspect;
  },
  setPixelRatio: (renderer: WebGLRenderer, pixelRatio: number) => {
    renderer.setPixelRatio(pixelRatio);
  },
  setPosition: (
    target: Object3D | PerspectiveCamera,
    position: OfficeThreeVector3,
  ) => {
    target.position.set(position[0], position[1], position[2]);
  },
  setRotation: (node: Object3D, rotation: OfficeThreeVector3) => {
    node.rotation.set(rotation[0], rotation[1], rotation[2]);
  },
  setScale: (node: Object3D, scale: OfficeThreeVector3) => {
    node.scale.set(scale[0], scale[1], scale[2]);
  },
  setSceneBackground: (scene: Scene, background: Color) => {
    scene.background = background;
  },
  setSize: (
    renderer: WebGLRenderer,
    width: number,
    height: number,
    updateStyle: boolean,
  ) => {
    renderer.setSize(width, height, updateStyle);
  },
  setVisible: (node: Object3D, visible: boolean) => {
    node.visible = visible;
  },
  updateProjectionMatrix: (camera: PerspectiveCamera) => {
    camera.updateProjectionMatrix();
  },
} satisfies OfficeThreeRendererAdapter<
  HTMLCanvasElement,
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Object3D,
  Mesh<BufferGeometry, Material>,
  BufferGeometry,
  Material,
  Color
>;
