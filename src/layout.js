// Where things stand on the 1600 x 900 stage, worked out from the footprints ("box") the model declares.
// The result is a few lines of plain text appended to each request: the current view, what is piled on what,
// and where there is still open ground. No model is involved in producing it.
export function layoutReport(elements, camera) {
  const solid = elements.filter(e => e.box && e.layer >= 2 && e.box[2] * e.box[3] < 0.5 * 1600 * 900);
  const half = 800 / camera.zoom, lo = Math.round((camera.focus[0] - half) / 100) * 100, hi = Math.round((camera.focus[0] + half) / 100) * 100;
  const view = '\nCAMERA now: zoom ' + camera.zoom.toFixed(2) + ', focus ' + camera.focus.join(',') + '. The stage you can stand things on runs from x ' + lo + ' to x ' + hi + '.';
  if (!solid.length) return view;
  const piled = [];
  for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
    const a = solid[i].box, b = solid[j].box;
    const ox = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]), oy = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]);
    if (ox > 0 && oy > 0 && ox * oy > 0.4 * Math.min(a[2] * a[3], b[2] * b[3])) piled.push(solid[i].id + ' and ' + solid[j].id);
  }
  const free = []; let start = null;
  for (let x = lo; x <= hi; x += 100) {
    const used = x >= hi || solid.some(e => e.box[0] < x + 100 && e.box[0] + e.box[2] > x);
    if (!used) { if (start === null) start = x; } else if (start !== null) { if (x - start >= 200) free.push('x ' + start + '-' + x); start = null; }
  }
  return view + '\nLAYOUT: ' + (piled.length ? 'these are piled on top of each other: ' + piled.slice(0, 6).join('; ') + '. Fix at least one this round: move it, shrink it, send it behind, or merge the two into one element. ' : 'nothing is piled up. ')
    + (free.length ? 'Open ground with nothing standing on it: ' + free.join(', ') + '.' : 'There is no open ground left: work new ideas INTO existing elements, or pull the camera back to open more stage.');
}
