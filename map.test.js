import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MAP_POINTS,locationButton} from './location-map.js';
const data=JSON.parse(fs.readFileSync(new URL('./data.json',import.meta.url),'utf8'));
test('Every known facility has a position inside the supplied map',()=>{for(const code of Object.keys(data.locations)){const p=MAP_POINTS[code];assert.ok(p,code);assert.ok(p.x-p.rx>0&&p.x+p.rx<625,code);assert.ok(p.y-p.ry>0&&p.y+p.ry<634,code);}});
test('Volleyball and basketball share the source K,F assembly point',()=>{assert.deepEqual(MAP_POINTS.F,{x:294,y:429,rx:17,ry:8,group:'K, F'});assert.equal(MAP_POINTS.F,MAP_POINTS.K);});
test('Shared source labels do not invent separate room positions',()=>{assert.equal(MAP_POINTS.B1,MAP_POINTS.B3);assert.equal(MAP_POINTS.J,MAP_POINTS.S);assert.equal(MAP_POINTS.H,MAP_POINTS.U);assert.equal(MAP_POINTS.P,MAP_POINTS.X);});
test('OSF retains its own point and unknown codes do not get a map',()=>{assert.equal(MAP_POINTS.O.x,198);assert.equal(MAP_POINTS.O.y,247);assert.match(locationButton('O','OSF'),/aria-haspopup="dialog"/);assert.doesNotMatch(locationButton('?','Nie podano'),/<button/);assert.ok(locationButton('O','<test>').includes('&lt;test&gt;'));});
