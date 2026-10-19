const LADO_PX = 400;
const CALIDAD = 0.7;

/**
 * Reduce una foto elegida a ~400 px en JPEG y la devuelve como data URI (unas decenas de KB),
 * igual que la app móvil: así se guarda en el backend sin subir archivos grandes.
 */
export function reducirFoto(archivo: File, ladoPx = LADO_PX): Promise<string> {
  return new Promise((resolver, rechazar) => {
    if (!archivo.type.startsWith('image/')) {
      rechazar(new Error('Elige una imagen'));
      return;
    }
    const url = URL.createObjectURL(archivo);
    const imagen = new Image();
    imagen.onload = () => {
      const escala = Math.min(1, ladoPx / Math.max(imagen.width, imagen.height));
      const lienzo = document.createElement('canvas');
      lienzo.width = Math.round(imagen.width * escala);
      lienzo.height = Math.round(imagen.height * escala);
      lienzo.getContext('2d')?.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
      URL.revokeObjectURL(url);
      resolver(lienzo.toDataURL('image/jpeg', CALIDAD));
    };
    imagen.onerror = () => {
      URL.revokeObjectURL(url);
      rechazar(new Error('No se pudo leer la imagen'));
    };
    imagen.src = url;
  });
}
