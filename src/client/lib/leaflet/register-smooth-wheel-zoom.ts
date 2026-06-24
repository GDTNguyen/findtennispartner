import L from 'leaflet';

declare module 'leaflet' {
  interface MapOptions {
    smoothWheelZoom?: boolean | string;
    smoothSensitivity?: number;
  }
}

const g = globalThis as typeof globalThis & { L?: typeof L };
g.L = L;

import 'leaflet-smooth-zoom';

type SmoothWheelZoomHandler = L.Handler & {
  _centerPoint?: L.Point;
  _startLatLng?: L.LatLng;
  _wheelMousePosition?: L.Point;
  _wheelMouseLatLng?: L.LatLng;
  _onWheeling(e: WheelEvent): void;
  _updateWheelZoom(): void;
  _map: L.Map;
};

function isCenterWheelZoom(map: L.Map): boolean {
  return map.options.smoothWheelZoom === 'center';
}

function applyCenterSmoothWheelZoomPatch(): void {
  const SmoothWheelZoom = (L.Map as unknown as { SmoothWheelZoom?: { prototype: SmoothWheelZoomHandler } })
    .SmoothWheelZoom;
  if (!SmoothWheelZoom) return;

  const originalOnWheeling = SmoothWheelZoom.prototype._onWheeling;
  if (!(originalOnWheeling as { __f10pCenterPatched?: boolean }).__f10pCenterPatched) {
    const patchedOnWheeling = function (this: SmoothWheelZoomHandler, e: WheelEvent) {
      const result = originalOnWheeling.call(this, e);
      if (isCenterWheelZoom(this._map) && this._centerPoint && this._startLatLng) {
        this._wheelMousePosition = this._centerPoint;
        this._wheelMouseLatLng = this._startLatLng;
      }
      return result;
    };
    (patchedOnWheeling as { __f10pCenterPatched?: boolean }).__f10pCenterPatched = true;
    SmoothWheelZoom.prototype._onWheeling = patchedOnWheeling;
  }

  const originalUpdate = SmoothWheelZoom.prototype._updateWheelZoom;
  if (!(originalUpdate as { __f10pCenterPatched?: boolean }).__f10pCenterPatched) {
    const patchedUpdate = function (this: SmoothWheelZoomHandler) {
      if (isCenterWheelZoom(this._map) && this._centerPoint) {
        this._wheelMousePosition = this._centerPoint.add([1, 0]);
      }
      return originalUpdate.call(this);
    };
    (patchedUpdate as { __f10pCenterPatched?: boolean }).__f10pCenterPatched = true;
    SmoothWheelZoom.prototype._updateWheelZoom = patchedUpdate;
  }
}

applyCenterSmoothWheelZoomPatch();
