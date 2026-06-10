import {
  createOfficeThreeRendererLifecycle,
  type OfficeThreeRendererCanvas,
  type OfficeThreeRendererLifecycle,
  type OfficeThreeRendererLifecycleInput,
} from "./orchestrator-office-three-renderer";

export type OfficeThreeLifecycleCreationResult<TLifecycle> =
  | {
      readonly kind: "ready";
      readonly lifecycle: TLifecycle;
    }
  | {
      readonly error: unknown;
      readonly kind: "unavailable";
    };

export function createOfficeThreeViewLifecycle<
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
  createLifecycle: (
    lifecycleInput: OfficeThreeRendererLifecycleInput<
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
  ) => OfficeThreeRendererLifecycle<
    TRenderer,
    TScene,
    TCamera,
    TNode,
    TMesh
  > = createOfficeThreeRendererLifecycle,
): OfficeThreeLifecycleCreationResult<
  OfficeThreeRendererLifecycle<TRenderer, TScene, TCamera, TNode, TMesh>
> {
  try {
    return {
      kind: "ready",
      lifecycle: createLifecycle(input),
    };
  } catch (error) {
    return {
      error,
      kind: "unavailable",
    };
  }
}
