const textColorPicker = document.getElementById('textColorPicker');
const textColorInput = document.getElementById('textColorInput');
const analyzeButton = document.getElementById('analyzeButton');
const settings = document.getElementById('settings');
const imageLoader = document.getElementById('imageLoader');
const canvas = document.getElementById('imageCanvas');
const segmentValue = document.getElementById("precision");
const solidFillRadio = document.getElementById('solidFill');
const gradientFillRadio = document.getElementById('gradientFill');
const ctx = canvas.getContext('2d');
let lastTextColor = '#000000';
let lastImageSrc = '';
let analysisPerformed = false;
let originalImageData = null;
let useSolidColors = false;
analyzeButton.disabled = true;
const colorAfficheur = document.querySelector('.color-afficheur'); // Assurez-vous que cet élément existe

function updateColorAfficheur() {
    const color = textColorPicker.value;
    colorAfficheur.style.backgroundColor = color;
}

[textColorPicker, textColorInput].forEach(element => {
    element.addEventListener('input', function() {
        updateColorInputs(element.value);
        updateColorAfficheur(); // Mettez à jour la couleur de fond lorsque la couleur change
    });
});

// Assurez-vous de mettre à jour la couleur lors du chargement initial
updateColorAfficheur();

function settingsToggle() {
    let para = document.getElementById("settings");
    para.classList.toggle("highlight");

    let imageElement = document.querySelector('.image');
    let colorElement = document.querySelector('.color');
    let precisionElement = document.querySelector('.settings-precision');
    let affichageElement = document.querySelector('.settings-color');

    imageElement.classList.toggle('translate');
    colorElement.classList.toggle('translate');
    precisionElement.classList.toggle('translate2');
    affichageElement.classList.toggle('translate2');
}

function updateColorInputs(color) {
    textColorPicker.value = color;
    textColorInput.value = color;
}

[textColorPicker, textColorInput].forEach(element => {
    element.addEventListener('input', function() {
        updateColorInputs(element.value);
    });
});

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function luminance(r, g, b) {
    const a = [r, g, b].map(v => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function contrastRatio(rgb1, rgb2) {
    const lum1 = luminance(rgb1.r, rgb1.g, rgb1.b);
    const lum2 = luminance(rgb2.r, rgb2.g, rgb2.b);
    return lum1 > lum2 ? (lum1 + 0.05) / (lum2 + 0.05) : (lum2 + 0.05) / (lum1 + 0.05);
}

imageLoader.addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                lastImageSrc = img.src;
                analyzeButton.disabled = false;
                analysisPerformed = false;
                originalImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
});




function analyzeImage() {
    analyzeButton.disabled = true;
    analyzeButton.classList.add('cool');

    restoreCanvasState();

    setTimeout(() => {
        const width = canvas.width;
        const height = canvas.height;
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        const segmentSize = parseInt(segmentValue.value);
        const textColorHex = textColorPicker.value;
        const textColorRgb = hexToRgb(textColorHex);
        const alpha = 0.5; // La transparence peut être ajustée ici

        for (let y = 0; y < height; y += segmentSize) {
            for (let x = 0; x < width; x += segmentSize) {
                const segmentWidth = Math.min(segmentSize, width - x);
                const segmentHeight = Math.min(segmentSize, height - y);
                const segmentColor = getAverageColor(data, x, y, width, segmentWidth, segmentHeight);

                let transparentPixelDetected = false;
                for (let sy = y; sy < y + segmentHeight; sy++) {
                    for (let sx = x; sx < x + segmentWidth; sx++) {
                        const index = (sy * width + sx) * 4;
                        if (data[index + 3] < 255) {
                            transparentPixelDetected = true;
                            break;
                        }
                    }
                    if (transparentPixelDetected) break;
                }

                let fillColor;
                if (transparentPixelDetected) {
                    // Forcer les pixels transparents à être verts avec un ratio de 21
                    fillColor = `rgba(0, 255, 0, ${alpha})`;
                } else {
                    const ratio = contrastRatio({ r: textColorRgb.r, g: textColorRgb.g, b: textColorRgb.b }, segmentColor);
                    
                    if (useSolidColors) {
                        if (ratio < 4.5) {
                            fillColor = `rgba(255, 0, 0, ${alpha})`; // Rouge solide avec alpha
                        } else if (ratio < 7) {
                            fillColor = `rgba(255, 255, 0, ${alpha})`; // Jaune solide avec alpha
                        } else {
                            fillColor = `rgba(0, 255, 0, ${alpha})`; // Vert solide avec alpha
                        }
                    } else {
                        if (ratio < 4.5) {
                            const redAmount = 255 * (4.5 - ratio) / 4.5;
                            fillColor = `rgba(255, ${redAmount}, 0, ${alpha})`;
                        } else if (ratio < 7) {
                            const yellowAmount = 255 * (ratio - 4.5) / 2.5;
                            fillColor = `rgba(255, ${255 - yellowAmount}, 0, ${alpha})`;
                        } else {
                            fillColor = `rgba(0, 255, 0, ${alpha})`;
                        }
                    }
                }

                ctx.fillStyle = fillColor;
                ctx.fillRect(x, y, segmentWidth, segmentHeight);
            }
        }

        analyzeButton.disabled = false;
        analyzeButton.classList.remove('cool');
        analysisPerformed = true;
    }, 2000);
}

function getAverageColor(data, startX, startY, imageWidth, segmentWidth, segmentHeight) {
    let r = 0, g = 0, b = 0, count = 0;

    for (let y = startY; y < startY + segmentHeight; y++) {
        for (let x = startX; x < startX + segmentWidth; x++) {
            const index = (y * imageWidth + x) * 4;
            r += data[index];
            g += data[index + 1];
            b += data[index + 2];
            count++;
        }
    }

    return {
        r: Math.floor(r / count),
        g: Math.floor(g / count),
        b: Math.floor(b / count)
    };
}

function restoreCanvasState() {
    if (originalImageData) {
        ctx.putImageData(originalImageData, 0, 0);
    }
}

solidFillRadio.addEventListener('change', function() {
    useSolidColors = solidFillRadio.checked;
});

gradientFillRadio.addEventListener('change', function() {
    useSolidColors = !gradientFillRadio.checked;
});

analyzeButton.addEventListener('click', analyzeImage);
