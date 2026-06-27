const data = require('/tmp/import_out.json');
const exitosas = data.facturas.filter(f => f.exito);
console.log('Total to import:', exitosas.length);
const BATCH = 20;
const http = require('http');
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function sendBatch(batch) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ facturas: batch });
    const req = http.request({ hostname: 'localhost', port: 3099, path: '/api/import/confirm', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch (e) { reject(e); } });
    }); req.on('error', reject); req.write(body); req.end();
  });
}
async function run() {
  let ti = 0, td = 0;
  for (let i = 0; i < exitosas.length; i += BATCH) {
    const batch = exitosas.slice(i, i + BATCH);
    const r = await sendBatch(batch);
    ti += r.importadas || 0; td += r.duplicadas || 0;
    process.stdout.write('Batch ' + Math.ceil((i + BATCH) / BATCH) + '/' + Math.ceil(exitosas.length / BATCH) + ' +' + r.importadas + '  \r');
    await sleep(200);
  }
  console.log('\nDONE: ' + ti + ' imported, ' + td + ' dupes');
}
run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });