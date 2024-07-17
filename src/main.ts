import * as core from '@actions/core';
import { Client } from 'ssh2';
import Sftp from './sftp';

function exec(conn: Client, command: string) {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) return reject(err);
      stream
        .on('close', function (code) {
          resolve(code);
        })
        .on('data', function (data) {
          core.info(data.toString());
        })
        .stderr.on('data', function (data) {
          core.error(data.toString());
        });
    });
  });
}

export async function run() {
  try {
    const host = core.getInput('HOST');
    const port = parseInt(core.getInput('PORT'));
    const username = core.getInput('USERNAME');
    const password = core.getInput('PASSWORD');
    const src = core.getInput('SOURCE');
    const dst = core.getInput('TARGET');
    const afterCommand = core.getInput('AFTER_COMMAND');
    console.log('enter run', host, port)
    const conn = new Client();
    conn.on('ready', async () => {
      const sftp = new Sftp(conn);
      core.info('begin upload');
      // 多个
      const srcPaths = src.split(',');
      const dstPaths = dst.split(',');
      if ( srcPaths.length !== dstPaths.length ) {
        core.info(`upload ${src} to ${dst}`);
        await sftp.uploadDir(src, dst);
      } else {
        srcPaths.forEach(async(item: string, index)=> {
          core.info(`upload ${item} to ${dstPaths[index]}`);
          await sftp.uploadDir(item, dstPaths[index]);
        })
      }
      core.info('end upload');
      let code: any = 0;
      if (afterCommand) {
        core.info('begin execute command');
        code = await exec(conn, `cd ${dst} && ${afterCommand}`);
        core.info('end execute command');
      }
      conn.end();
      if (code === 1) {
        core.setFailed(`command execute failed`);
      }
    });
    conn.connect({ host, port, username, password });
  } catch (error) {
    core.setFailed(error.message);
  }
}
