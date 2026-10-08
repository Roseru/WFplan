import fs from 'node:fs';import assert from 'node:assert/strict';
for(const f of ['index.html','style.css','app.js','logic.js','data.json','sw.js','manifest.webmanifest','icon.svg'])assert.ok(fs.statSync(f).size>0,f);
const d=JSON.parse(fs.readFileSync('data.json','utf8'));assert.equal(d.events.length,7511);assert.equal(Object.keys(d.lessons).length,165);console.log('Static build validated: 7511 events, 165 lesson descriptions.');

