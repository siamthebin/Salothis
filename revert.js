import fs from 'fs';
let content = fs.readFileSync('src/App.tsx', 'utf8');
content = content.replace(/bg-\[\#0B1D14\]/g, 'bg-black');
content = content.replace(/from-\[\#0B1D14\]/g, 'from-black');
content = content.replace(/via-\[\#0B1D14\]/g, 'via-black');
content = content.replace(/to-\[\#0B1D14\]/g, 'to-black');
content = content.replace(/text-\[\#0B1D14\]/g, 'text-black');
fs.writeFileSync('src/App.tsx', content);
