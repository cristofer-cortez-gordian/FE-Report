// Script para agregar margen a un logo PNG usando sharp
const sharp = require('sharp');
const path = require('path');

const inputPath = path.join(__dirname, '../assets/images/logofe-report1.png');
const outputPath = path.join(__dirname, '../assets/images/logofe-report1-padded.png');

const SIZE = 1024;
const PADDING = 220; // 22% de margen aprox

(async () => {
  try {
    // Crear fondo transparente
    const background = {
      create: {
        width: SIZE,
        height: SIZE,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      }
    };
    // Redimensionar el logo original para dejar margen
    const logo = await sharp(inputPath)
      .resize(SIZE - 2 * PADDING, SIZE - 2 * PADDING, { fit: 'contain' })
      .toBuffer();
    // Componer el logo centrado sobre el fondo
    await sharp(background)
      .composite([
        { input: logo, left: PADDING, top: PADDING }
      ])
      .png()
      .toFile(outputPath);
    console.log('Logo con margen generado en:', outputPath);
  } catch (err) {
    console.error('Error generando logo con margen:', err);
  }
})();
