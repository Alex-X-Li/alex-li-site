const fs = require('fs');
const path = require('path');

const WALLPAPER_DIR = path.join(__dirname, '..', 'wallpaper');
const OUT_FILE = path.join(WALLPAPER_DIR, 'manifest.json');

const ALLOWED_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

function generate() {
    if (!fs.existsSync(WALLPAPER_DIR)) {
        console.error('Wallpaper directory does not exist:', WALLPAPER_DIR);
        process.exit(1);
    }

    const files = fs.readdirSync(WALLPAPER_DIR)
        .filter(f => {
            const ext = path.extname(f).toLowerCase();
            return ALLOWED_EXTS.includes(ext);
        })
        .sort();

    fs.writeFileSync(OUT_FILE, JSON.stringify(files, null, 2));
    console.log('Wrote', OUT_FILE, 'with', files.length, 'entries');
}

if (require.main === module) {
    generate();
}

module.exports = generate;