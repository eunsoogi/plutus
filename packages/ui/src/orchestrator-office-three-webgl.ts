export function officeThreeCanvasSize(canvas: HTMLCanvasElement): {
  readonly height: number;
  readonly width: number;
} {
  const bounds = canvas.getBoundingClientRect();
  return {
    height: Math.max(1, Math.round(bounds.height)),
    width: Math.max(1, Math.round(bounds.width)),
  };
}

export function canCreateOfficeThreeWebGLContext(
  canvas: HTMLCanvasElement,
): boolean {
  const contextAttributes = {
    antialias: true,
    preserveDrawingBuffer: true,
  } satisfies WebGLContextAttributes;

  try {
    return (
      canvas.getContext("webgl2", contextAttributes) !== null ||
      canvas.getContext("webgl", contextAttributes) !== null
    );
  } catch {
    return false;
  }
}
