import {cp,mkdir,rm} from 'node:fs/promises';
await rm(new URL('../dist/',import.meta.url),{recursive:true,force:true});
await mkdir(new URL('../dist/',import.meta.url),{recursive:true});
await cp(new URL('../public/',import.meta.url),new URL('../dist/',import.meta.url),{recursive:true});
console.log('Static website prepared in dist/. WhatsApp enquiries work without a backend.');
