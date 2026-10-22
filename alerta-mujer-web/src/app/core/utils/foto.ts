const SIDE_PX = 400;
const QUALITY = 0.7;

/**
 * Reduce una foto elegida a ~400 px en JPEG y la devuelve como data URI (unas decenas de KB),
 * igual que la app móvil: así se guarda en el backend sin subir archivos grandes.
 */
export function shrinkPhoto(file: File, sidePx = SIDE_PX): Promise<string> {
  return new Promise((resolver, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Elige una imagen'));
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, sidePx / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolver(canvas.toDataURL('image/jpeg', QUALITY));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('No se pudo leer la imagen'));
    };
    image.src = url;
  });
}
