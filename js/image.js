// Abrir fotos e deixá-las num tamanho leve para o tablet.

const MAX_SIDE = 2800; // px: sobra qualidade para dar zoom e imprimir a 300 dpi

export function blobToImage(blob) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img); // a URL fica viva enquanto a imagem é usada
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('imagem inválida'));
    };
    img.src = url;
  });
}

export function releaseImage(img) {
  if (img && img.src && img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
}

// Lê o arquivo escolhido e devolve { blob, img } já reduzido se for muito grande.
export async function importImageFile(file) {
  if (!file || (file.type && !file.type.startsWith('image/'))) {
    throw new Error('Esse arquivo não é uma imagem.');
  }
  let img;
  try {
    img = await blobToImage(file);
  } catch (_) {
    throw new Error('Não consegui abrir essa imagem. Tente uma foto JPG ou PNG.');
  }
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const ratio = Math.min(1, MAX_SIDE / Math.max(w, h));
  const keepPng = file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif';

  if (ratio === 1 && (file.type === 'image/jpeg' || file.type === 'image/png')) {
    return { blob: file, img };
  }

  const c = document.createElement('canvas');
  c.width = Math.round(w * ratio);
  c.height = Math.round(h * ratio);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  releaseImage(img);
  const type = keepPng ? 'image/png' : 'image/jpeg';
  const blob = await new Promise((res) => c.toBlob(res, type, 0.92));
  return { blob, img: await blobToImage(blob) };
}

export function canvasToBlob(canvas, type = 'image/png', q) {
  return new Promise((res) => canvas.toBlob(res, type, q));
}
