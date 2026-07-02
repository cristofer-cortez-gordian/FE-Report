import { spawn } from 'node:child_process';

export async function convertXlsxToPdf({ sofficeBin, inputXlsxPath, outputDir }) {
  await runProcess(sofficeBin, [
    '--headless',
    '--convert-to',
    'pdf',
    '--outdir',
    outputDir,
    inputXlsxPath
  ]);
}

function runProcess(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'pipe',
      shell: false
    });

    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => reject(error));

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`soffice exited with code ${code}: ${stderr}`));
    });
  });
}
