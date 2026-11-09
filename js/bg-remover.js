// Ponte entre a tela e o removedor de fundo (js/bg-worker.js).

export function createBgRemover() {
  const worker = new Worker(new URL('./bg-worker.js', import.meta.url));
  const pending = new Map();
  let seq = 0;
  let size = null;
  let out = null; // canvas com o resultado, usado direto pelo editor

  worker.onmessage = (e) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    p(e.data);
  };

  function send(msg, transfer) {
    const id = ++seq;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      worker.postMessage({ ...msg, id }, transfer || []);
    });
  }

  return {
    // Prepara a foto original.
    async load(img) {
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, w, h);
      size = { w, h };
      out = document.createElement('canvas');
      out.width = w;
      out.height = h;
      await send({ type: 'load', buffer: data.data.buffer, w, h }, [data.data.buffer]);
    },

    // ops: [{ kind: 'edges' } | { kind: 'point', x, y }]; tolerance: 1–100.
    // Se outra chamada começar antes desta terminar, esta devolve null (vale sempre a mais nova).
    async run(ops, tolerance) {
      const mine = seq + 1;
      const res = await send({ type: 'run', ops, tolerance });
      if (res.id !== seq || res.id < mine) return null;
      const data = new ImageData(new Uint8ClampedArray(res.buffer), size.w, size.h);
      out.getContext('2d').putImageData(data, 0, 0);
      return { canvas: out, coverage: res.coverage, ms: res.ms };
    },

    destroy() {
      worker.terminate();
      pending.clear();
    },
  };
}
