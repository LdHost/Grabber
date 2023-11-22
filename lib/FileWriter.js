const Fs = require('fs');
const Path = require('path');

function FileWriter (relativePath, body, url) {
  console.log('HERE', relativePath, {encoding:'utf8',flag:'w'});
  const dirname = Path.dirname(relativePath);
  Fs.mkdirSync(dirname, { recursive: true });
  Fs.writeFileSync(relativePath, body, {encoding:'utf8',flag:'w'});
}

module.exports = {FileWriter};
