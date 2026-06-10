import type { OfficeThreeRendererDiagnostics } from "./orchestrator-office-three-types";

export function writeOfficeThreeCanvasDiagnostics(
  canvas: HTMLCanvasElement,
  diagnostics: OfficeThreeRendererDiagnostics,
): void {
  canvas.dataset.officeMotionFrame = diagnostics.motionFrame.toString();
  canvas.dataset.officeMotionMode = diagnostics.motionMode;
  canvas.dataset.officeMotionSample = diagnostics.motionSample;
  if (diagnostics.motionSampleObjectId === undefined) {
    delete canvas.dataset.officeMotionSampleObjectId;
    return;
  }
  canvas.dataset.officeMotionSampleObjectId = diagnostics.motionSampleObjectId;
}
