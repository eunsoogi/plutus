export type OfficeCanvasDrag = {
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
};

export type OfficeCanvasDragStart = {
  readonly isPrimary?: boolean;
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
};

export type OfficeCanvasDragMove = {
  readonly isPrimary?: boolean;
  readonly pointerId: number;
  readonly x: number;
  readonly y: number;
};

export type OfficeCanvasDragUpdate = {
  readonly deltaX: number | null;
  readonly deltaY: number | null;
  readonly drag: OfficeCanvasDrag | null;
};

export type OfficeCanvasPointerTransition = {
  readonly deltaX: number | null;
  readonly deltaY: number | null;
  readonly nextDrag: OfficeCanvasDrag | null;
  readonly shouldCapture: boolean;
  readonly shouldRelease: boolean;
};

function unchangedDragUpdate(
  drag: OfficeCanvasDrag | null,
): OfficeCanvasDragUpdate {
  return {
    deltaX: null,
    deltaY: null,
    drag,
  };
}

export function beginOfficeCanvasDrag(
  drag: OfficeCanvasDrag | null,
  event: OfficeCanvasDragStart,
): OfficeCanvasDrag | null {
  if (drag !== null || !(event.isPrimary ?? true)) {
    return drag;
  }

  return {
    pointerId: event.pointerId,
    x: event.x,
    y: event.y,
  };
}

export function updateOfficeCanvasDrag(
  drag: OfficeCanvasDrag | null,
  event: OfficeCanvasDragMove,
): OfficeCanvasDragUpdate {
  if (
    drag === null ||
    !(event.isPrimary ?? true) ||
    drag.pointerId !== event.pointerId ||
    (drag.x === event.x && drag.y === event.y)
  ) {
    return unchangedDragUpdate(drag);
  }

  return {
    deltaX: event.x - drag.x,
    deltaY: event.y - drag.y,
    drag: {
      pointerId: drag.pointerId,
      x: event.x,
      y: event.y,
    },
  };
}

export function endOfficeCanvasDrag(
  drag: OfficeCanvasDrag | null,
  pointerId: number,
): {
  readonly didEnd: boolean;
  readonly drag: OfficeCanvasDrag | null;
} {
  if (drag === null || drag.pointerId !== pointerId) {
    return {
      didEnd: false,
      drag,
    };
  }

  return {
    didEnd: true,
    drag: null,
  };
}

export function reduceOfficeCanvasPointerDrag(
  drag: OfficeCanvasDrag | null,
  event:
    | {
        readonly clientX: number;
        readonly clientY: number;
        readonly isPrimary?: boolean;
        readonly kind: "pointerdown";
        readonly pointerId: number;
      }
    | {
        readonly clientX: number;
        readonly clientY: number;
        readonly isPrimary?: boolean;
        readonly kind: "pointermove";
        readonly pointerId: number;
      }
    | {
        readonly clientX: number;
        readonly clientY: number;
        readonly kind: "pointercancel";
        readonly pointerId: number;
      }
    | {
        readonly clientX: number;
        readonly clientY: number;
        readonly kind: "pointerup";
        readonly pointerId: number;
      },
): OfficeCanvasPointerTransition {
  switch (event.kind) {
    case "pointerdown": {
      const nextDrag = beginOfficeCanvasDrag(drag, {
        isPrimary: event.isPrimary,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      });

      return {
        deltaX: null,
        deltaY: null,
        nextDrag,
        shouldCapture: nextDrag !== drag,
        shouldRelease: false,
      };
    }
    case "pointermove": {
      const nextMove = updateOfficeCanvasDrag(drag, {
        isPrimary: event.isPrimary,
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      });

      return {
        deltaX: nextMove.deltaX,
        deltaY: nextMove.deltaY,
        nextDrag: nextMove.drag,
        shouldCapture: false,
        shouldRelease: false,
      };
    }
    case "pointerup":
    case "pointercancel": {
      const nextEnd = endOfficeCanvasDrag(drag, event.pointerId);

      return {
        deltaX: null,
        deltaY: null,
        nextDrag: nextEnd.drag,
        shouldCapture: false,
        shouldRelease: nextEnd.didEnd,
      };
    }
  }
}
