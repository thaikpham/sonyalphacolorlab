const recipesData = [
    {
        "id": "scl-001",
        "name": "SCL-001: Mojave Sun",
        "description": "A nostalgic, sun-drenched style that bathes scenes in the warm glow of golden hour.\nPerfect for travel and lifestyle, it recreates rich yellows and deep blues, evoking the feeling of an endless summer road trip.",
        "type": "color",
        "contrast": "normal",
        "saturation": "high",
        "tags": ["nostalgic", "sun-drenched", "warm", "travel", "lifestyle", "summer", "golden-hour"],
        "whiteBalance": "7000K, B3-M1.5",
        "settings": { "Black level": "-7", "Gamma": "Cine1", "Black Gamma": "Wide +5", "Knee": "Manual 75% +2", "Color Mode": "S-Gamut3", "Saturation": "+25", "Color Phase": "+1" },
        "colorDepth": { "R": "-1", "G": "+1", "B": "+5", "C": "+4", "M": "-2", "Y": "+2" },
        "detailSettings": {
            level: 0,
            mode: "Manual",
            vhBalance: "+2",
            bwBalance: "Type 3",
            limit: 3,
            crispening: 7,
            hiLightDetail: 4
        }
    },
    {
        "id": "scl-002",
        "name": "SCL-002: Kyoto Jade",
        "description": "A serene and subtle palette defined by rich jade tones and gentle skin colors.\nIdeal for contemplative portraits, street photography, and landscapes, creating a peaceful, painterly atmosphere.",
        "type": "color",
        "contrast": "normal",
        "saturation": "normal",
        "tags": ["serene", "subtle", "portrait", "street-photography", "landscape", "peaceful", "painterly"],
        "whiteBalance": "3700K, A7-M0.5",
        "settings": { "Black level": "0", "Gamma": "Cine1", "Black Gamma": "Wide +7", "Knee": "Manual 80% +3", "Color Mode": "Pro", "Saturation": "+12", "Color Phase": "-4" },
        "colorDepth": { "R": "-4", "G": "+7", "B": "-2", "C": "-2", "M": "-5", "Y": "-3" },
        "detailSettings": {
            level: 0,
            mode: "Manual",
            vhBalance: "+2",
            bwBalance: "Type 3",
            limit: 3,
            crispening: 7,
            hiLightDetail: 4
        }
    },
    {
        "id": "scl-009",
        "name": "SCL-009: Urban Teal",
        "description": "A muted, low-saturation color profile with a distinctive cyan-teal cast in the shadows and mid-tones.\nIt creates a subtle, gentle, and slightly melancholic mood, perfect for street photography and urban exploration.",
        "type": "color",
        "contrast": "normal",
        "saturation": "low",
        "tags": ["muted-color", "low-saturation", "cyan-teal", "subtle", "gentle", "melancholy", "street-photography", "urban-exploration"],
        "whiteBalance": "4000K, A7-M0.5",
        "settings": { "Black level": "-5", "Gamma": "Cine4", "Black Gamma": "Middle -7", "Knee": "Manual 80% +2", "Color Mode": "Still", "Saturation": "-2", "Color Phase": "+2" },
        "colorDepth": { "R": "-5", "G": "+6", "B": "+3", "C": "+4", "M": "-6", "Y": "-1" },
        "detailSettings": {
            level: 0,
            mode: "Manual",
            vhBalance: "+2",
            bwBalance: "Type 3",
            limit: 3,
            crispening: 7,
            hiLightDetail: 4
        }
    },
    {
        "id": "scl-015",
        "name": "SCL-015: Vintage Slide",
        "description": "A neutral, slightly faded style with a subtle green-cyan tint in the shadows.\nIt evokes the feeling of looking through old family slide films, perfect for nostalgic portraits and everyday scenes.",
        "type": "color",
        "contrast": "normal",
        "saturation": "faded",
        "tags": ["warm", "faded", "green-tint", "old-family-slides", "nostalgic-portrait", "everyday-scenes"],
        "whiteBalance": "3600K, A7-M1",
        "settings": { "Black level": "-2", "Gamma": "Cine1", "Black Gamma": "Middle -7", "Knee": "Manual 80% +4", "Color Mode": "Pro", "Saturation": "+10", "Color Phase": "-1" },
        "colorDepth": { "R": "+3", "G": "+5", "B": "-4", "C": "+2", "M": "+6", "Y": "+5" },
        "detailSettings": {
            level: 0,
            mode: "Manual",
            vhBalance: "+2",
            bwBalance: "Type 3",
            limit: 3,
            crispening: 7,
            hiLightDetail: 4
        }
    },
    {
        "id": "scl-025",
        "name": "SCL-025: Saturated Cinema",
        "description": "A powerful, high-saturation cinematic style, distinct from Fuji emulations.\nIt utilizes a wide color space to produce deep, rich colors with a filmic gamma curve, well-suited for vivid visual storytelling.",
        "type": "color",
        "contrast": "high",
        "saturation": "high",
        "tags": ["high-saturation", "powerful-cinematic", "wide-color-space", "deep-rich-colors", "cinematic-gamma-curve", "vivid-visual-storytelling"],
        "whiteBalance": "4000K, A7-M1",
        "settings": { "Black level": "-5", "Gamma": "Cine4", "Black Gamma": "Wide -5", "Knee": "Manual 87.5% +3", "Color Mode": "S-Gamut3", "Saturation": "+32", "Color Phase": "+6" },
        "colorDepth": { "R": "-3", "G": "-2", "B": "+3", "C": "+7", "M": "-3", "Y": "-2" },
        "detailSettings": {
            level: 0,
            mode: "Manual",
            vhBalance: "+2",
            bwBalance: "Type 3",
            limit: 3,
            crispening: 7,
            hiLightDetail: 4
        }
    },
    {
        "id": "scl-027",
        "name": "SCL-027: Daylight Cinema",
        "description": "A modern, clean cinematic style based on S-Cinetone.\nIt’s designed for daylight conditions, delivering beautiful skin tones, high saturation, and a professional, polished feel straight out of camera.",
        "type": "color",
        "contrast": "normal",
        "saturation": "high",
        "tags": ["modern-cinematic", "clean", "s-cinetone", "daylight", "beautiful-skin-tones", "high-saturation", "professional", "polished", "straight-out-of-camera"],
        "whiteBalance": "3700K, A5-M1.5",
        "settings": { "Black level": "-9", "Gamma": "S-Cinetone", "Black Gamma": "Narrow -7", "Knee": "Manual 75% +5", "Color Mode": "S-Cinetone", "Saturation": "+25", "Color Phase": "0" },
        "colorDepth": { "R": "-1", "G": "+3", "B": "+2", "C": "+2", "M": "-3", "Y": "-3" },
        "detailSettings": {
            level: 0,
            mode: "Manual",
            vhBalance: "+2",
            bwBalance: "Type 3",
            limit: 3,
            crispening: 7,
            hiLightDetail: 4
        }
    },
    {
        "id": "scl-044",
        "name": "SCL-44: Filmic FJ C200",
        "description": "A filmic recipe that mimics FJ C200 film stock.",
        "type": "color",
        "contrast": "high",
        "saturation": "high",
        "tags": ["filmic", "film-emulation", "contemporary"],
        "whiteBalance": "AWB, B1-G0.5",
        "settings": { "Black level": "+5", "Gamma": "Cine4", "Black Gamma": "Narrow +5", "Knee": "Manual 75% +5", "Color Mode": "S-Gamut3.Cine", "Saturation": "+20", "Color Phase": "-2" },
        "colorDepth": { "R": "+2", "G": "-3", "B": "+3", "C": "-4", "M": "+1", "Y": "-2" },
        "detailSettings": {
            level: -5,
            mode: "Manual",
            vhBalance: "-22",
            bwBalance: "Type 1",
            limit: 3,
            crispening: 3,
            hiLightDetail: 2
        }
    },
    {
        "id": "PROCOLOR-001",
        "name": "PROCOLOR-001: ClearCast Pro",
        "description": "A color recipe for crystal-clear images, featuring rich colors on a neutral foundation. Specially designed for livestreaming, it renders Asian skin tones authentically and radiantly.",
        "type": "color",
        "contrast": "normal",
        "saturation": "normal",
        "tags": ["pro-color", "live-stream", "neutral", "lips", "portrait", "color", "high-contrast", "crystal-clear"],
        "whiteBalance": "AWB, B1-M0.75",
        "settings": { "Black level": "-5", "Gamma": "S-Cinetone", "Black Gamma": "Wide -7", "Knee": "Auto", "Color Mode": "S-Cinetone", "Saturation": "+8", "Color Phase": "0" },
        "colorDepth": { "R": "-1", "G": "-1", "B": "+1", "C": "+1", "M": "+1", "Y": "-1" },
        "detailSettings": {
            level: 0,
            mode: "Manual",
            vhBalance: "+2",
            bwBalance: "Type 3",
            limit: 3,
            crispening: 7,
            hiLightDetail: 4
        }
    },
    {
        "id": "PROCOLOR-002",
        "name": "PROCOLOR-002: ClearCast Pro 2",
        "description": "A color recipe for crystal-clear images, featuring rich colors on a neutral foundation. Specially designed for livestreaming, it renders Asian skin tones authentically and radiantly.",
        "type": "color",
        "contrast": "normal",
        "saturation": "normal",
        "tags": ["pro-color", "live-stream", "neutral", "lips", "portrait", "color", "high-contrast", "crystal-clear"],
        "whiteBalance": "AWB, B1-M0.75",
        "settings": { "Black level": "-3", "Gamma": "Movie", "Black Gamma": "Wide -7", "Knee": "Auto", "Color Mode": "Still", "Saturation": "+8", "Color Phase": "0" },
        "colorDepth": { "R": "-1", "G": "-1", "B": "+1", "C": "+1", "M": "+1", "Y": "-1" },
        "detailSettings": {
            level: 0,
            mode: "Manual",
            vhBalance: "+2",
            bwBalance: "Type 3",
            limit: 3,
            crispening: 7,
            hiLightDetail: 4
        }
    },
    {
        "id": "PROCOLOR-003",
        "name": "PROCOLOR-003: EXTRA DR Stream 109",
        "description": "A color recipe for crystal-clear images, featuring rich colors on a neutral foundation. Specially designed for livestreaming, it renders Asian skin tones authentically and radiantly.",
        "type": "color",
        "contrast": "normal",
        "saturation": "normal",
        "tags": ["pro-color", "live-stream", "neutral", "lips", "portrait", "color", "high-contrast", "crystal-clear"],
        "whiteBalance": "AWB, B1-M0.75",
        "settings": { "Black level": "-3", "Gamma": "Cine1", "Black Gamma": "Wide -7", "Knee": "Manual 105% +2", "Color Mode": "Movie", "Saturation": "+15", "Color Phase": "0" },
        "colorDepth": { "R": "-2", "G": "-5", "B": "+3", "C": "+3", "M": "-4", "Y": "+2" },
        "detailSettings": {
            level: 0,
            mode: "Manual",
            vhBalance: "+2",
            bwBalance: "Type 3",
            limit: 3,
            crispening: 7,
            hiLightDetail: 4
        }
          }
];

export default recipesData;
