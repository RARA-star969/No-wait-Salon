const fs = require('node:fs');

const path = 'src/components/PublicSalonPage.tsx';
let text = fs.readFileSync(path, 'utf8');
const marker = `  // Ticking clock for arrival countdown\n  useEffect(() => {\n    const id = setInterval(() => setNow(Date.now()), 1000);\n    return () => clearInterval(id);\n  }, []);\n`;
const addition = `${marker}\n  // The Salon Detail page is much taller than the QR onboarding/ticket steps.\n  // A customer can tap the fixed Join Queue dock while scrolled deep in the\n  // salon page; browsers preserve that scroll offset after the long view is\n  // replaced, which can leave the new phone/OTP/profile/ticket UI above the\n  // viewport and make the page look completely blank. Always reveal the top\n  // of each route step when the public QR flow advances.\n  useEffect(() => {\n    if (typeof window === 'undefined') return;\n    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });\n  }, [step]);\n`;

if (!text.includes("window.scrollTo({ top: 0, left: 0, behavior: 'auto' });")) {
  if (!text.includes(marker)) throw new Error('PublicSalonPage clock anchor not found.');
  text = text.replace(marker, addition);
  fs.writeFileSync(path, text);
  console.log(JSON.stringify({ changed: [path] }));
} else {
  console.log(JSON.stringify({ changed: [] }));
}
