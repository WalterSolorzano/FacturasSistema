const fs = require('fs');
const content = fs.readFileSync('overview_log.txt', 'utf8');
const lines = content.split('\n');

const matches = lines.filter(l => l.includes('GUI.cs') && l.includes('write_to_file'));
const json = JSON.parse(matches[0]);
let code = json.tool_calls[0].args.CodeContent;
if (code.startsWith('\"')) code = JSON.parse(code);
fs.writeFileSync('FacturasPortable/GUI.cs', code);

const matchesBuild = lines.filter(l => l.includes('build-portable.ps1') && l.includes('write_to_file'));
const jsonBuild = JSON.parse(matchesBuild[0]);
let codeBuild = jsonBuild.tool_calls[0].args.CodeContent;
if (codeBuild.startsWith('\"')) codeBuild = JSON.parse(codeBuild);
fs.writeFileSync('build-portable.ps1', codeBuild);

console.log('Fixed');
