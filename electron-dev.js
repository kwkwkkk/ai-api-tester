const { spawn } = require('child_process');
const electron = require('electron');

delete process.env.ELECTRON_RUN_AS_NODE;

const child = spawn(electron, ['.'], { stdio: 'inherit', windowsHide: false });
child.on('close', (code) => process.exit(code ?? 1));
