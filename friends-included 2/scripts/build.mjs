import { cp, mkdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { readdir } from 'node:fs/promises';
for (const dir of ['src','api','public','scripts']) for (const file of await readdir(dir)) if (/\.(js|mjs)$/.test(file)) execFileSync(process.execPath,['--check',`${dir}/${file}`]);
await mkdir('dist',{recursive:true});await cp('public','dist',{recursive:true});
const html=await readFile('dist/index.html','utf8');if(!html.includes('lang="en"'))throw new Error('English language metadata missing');
console.log('Build complete: static frontend in dist; Vercel functions in api.');
