#!/usr/bin/env node
/**
 * Standalone script: reads JSON from stdin, renders LaTeX via MathJax v3, writes JSON to stdout.
 * Spawned as a child process by the Next.js /latex-render route.
 */

const EX_PT = 3.5; // 1ex in PDF points (calibrated for 7pt Helvetica in react-pdf)

let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => { input += d; });
process.stdin.on("end", async () => {
  const { exprs } = JSON.parse(input);

  const mathjax = require("mathjax");
  const MJ = await mathjax.init({
    loader: { load: ["input/tex", "output/svg"] },
    tex: { packages: { "[+]": ["ams", "boldsymbol", "noerrors"] } },
    svg: { fontCache: "none" },
  });

  const results = exprs.map(({ expr, display }) => {
    try {
      const node = MJ.tex2svg(expr, { display: !!display });
      const raw = MJ.startup.adaptor.outerHTML(node);

      // Extract the <svg> element from the <mjx-container> wrapper
      const svgMatch = raw.match(/<svg[\s\S]*<\/svg>/);
      if (!svgMatch) return { uri: "", width: 0, height: 0, depth: 0 };
      let svg = svgMatch[0];

      // Extract vertical-align from container style (negative = descends below baseline)
      const vaMatch = raw.match(/vertical-align:\s*([-\d.]+)ex/);
      const depthEx = vaMatch ? -parseFloat(vaMatch[1]) : 0;

      // Extract dimensions
      const wMatch = svg.match(/width="([\d.]+)ex"/);
      const hMatch = svg.match(/height="([\d.]+)ex"/);
      const width  = wMatch ? parseFloat(wMatch[1]) * EX_PT : 40;
      const height = hMatch ? parseFloat(hMatch[1]) * EX_PT : 14;
      const depth  = Math.max(0, depthEx) * EX_PT;

      // MathJax v3 uses Y-up coords with transform="scale(1,-1)" on root <g>.
      // react-pdf renders this as a solid black block.
      // Fix: replace scale(1,-1) with matrix(1,0,0,-1,0,H) where H = descent below
      // the viewBox top (= vbH + vbY). This is the same flip but expressed as a
      // matrix that react-pdf handles correctly.
      const vbMatch = svg.match(/viewBox="([^"]+)"/);
      if (vbMatch) {
        const [, vbY, , vbH] = vbMatch[1].split(/\s+/).map(Number);
        const H = (vbH + vbY).toFixed(2); // descent in internal units
        svg = svg.replace(' transform="scale(1,-1)"', ` transform="matrix(1,0,0,-1,0,${H})"`);
      }

      // Clean up attributes react-pdf doesn't need
      svg = svg
        .replace(/ style="[^"]*"/g, "")
        .replace(/ role="[^"]*"/g, "")
        .replace(/ focusable="[^"]*"/g, "")
        .replace(/ aria-[^=]+="[^"]*"/g, "")
        .replace(/<title[^>]*>[^<]*<\/title>/g, "")
        .replace(/ data-[^=]+="[^"]*"/g, "")
        .replace(/currentColor/g, "#2c3e50")
        .replace(/ xmlns:xlink="[^"]*"/g, "");

      const uri = "data:image/svg+xml;base64," + Buffer.from(svg, "utf-8").toString("base64");
      return { uri, width, height, depth };
    } catch {
      return { uri: "", width: 0, height: 0, depth: 0 };
    }
  });

  process.stdout.write(JSON.stringify({ results }));
  process.exit(0);
});
