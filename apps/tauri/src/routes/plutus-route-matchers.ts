function routeSegments(path: string) {
  return path.split("/").filter(Boolean);
}

export function oneSegmentRoute(path: string, root: string) {
  const segments = routeSegments(path);
  return segments.length === 2 && segments[0] === root;
}

export function artifactRoute(path: string) {
  const segments = routeSegments(path);
  return (
    segments.length === 4 &&
    segments[0] === "runs" &&
    segments[2] === "artifacts"
  );
}

export function remoteOneSegmentRoute(path: string, root: string) {
  const segments = routeSegments(path);
  return (
    segments.length === 3 && segments[0] === "remote" && segments[1] === root
  );
}
