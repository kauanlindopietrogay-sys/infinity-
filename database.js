const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const initFile = (fileName, defaultValue = []) => {
  const filePath = path.join(DATA_DIR, `${fileName}.json`);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
  }
};

initFile('config', { taxes: { mediador: 10, analista: 5 }, roles: {}, channels: {}, defaultQueueValues: [1, 2, 5, 10, 20, 50, 100] });
initFile('mediadores', []);
initFile('blacklist', []);
initFile('tickets', []);

module.exports = {
  readData: async (name) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, `${name}.json`), 'utf8')),
  writeData: async (name, data) => fs.writeFileSync(path.join(DATA_DIR, `${name}.json`), JSON.stringify(data, null, 2))
};

