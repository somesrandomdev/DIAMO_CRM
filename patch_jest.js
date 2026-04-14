const fs = require('fs');
let code = fs.readFileSync('jest.config.js', 'utf8');
code = code.replace(
  /'\\\\\\.\(css\|sass\)\$': 'identity-obj-proxy',/,
  "'\\\\.(css|scss|sass)$': 'identity-obj-proxy',"
);
fs.writeFileSync('jest.config.js', code);
