import { spawn, exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import util from 'util';
import dotenv from 'dotenv';

dotenv.config();

const execAsync = util.promisify(exec);

async function backupDatabase() {
    console.log('--- Database Backup Starting ---');

    const databaseUrl = process.env.DATABASE_URL;
    const directUrl = process.env.DIRECT_URL;

    if (!databaseUrl && !directUrl) {
        console.error('Error: Neither DATABASE_URL nor DIRECT_URL environment variable is defined in .env');
        process.exit(1);
    }

    // Ensure backups directory exists
    const backupDir = path.join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
        console.log(`Created directory: ${backupDir}`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] + '-' + Date.now();
    const filename = `backup-${timestamp}.sql`;
    const filepath = path.join(backupDir, filename);

    // Default pg_dump path for Windows (Supabase often needs a recent version)
    const pgDumpPath = process.platform === 'win32' 
      ? `"C:\\Program Files\\PostgreSQL\\18\\pgAdmin 4\\runtime\\pg_dump.exe"`
      : 'pg_dump';

    // If using Prisma Postgres (specific serverless product), we must tunnel
    if (databaseUrl && databaseUrl.startsWith('prisma+postgres://')) {
        console.log('Prisma Postgres detected. Establishing secure tunnel...');
        
        const npxCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
        const tunnel = spawn(npxCmd, ['-y', '@prisma/ppg-tunnel@latest', '--host', '127.0.0.1', '--port', '0'], {
            shell: true,
            env: { ...process.env }
        });

        let boundPort: string | null = null;
        let backupCompleted = false;

        tunnel.stdout.on('data', async (data) => {
            const text = data.toString();
            const match = text.match(/listening on .*?:(\d+)/);
            
            if (match && !boundPort) {
                boundPort = match[1];
                try {
                    let dbName = 'postgres';
                    if (directUrl) {
                        try {
                            const dUrl = new URL(directUrl);
                            dbName = dUrl.pathname.replace(/^\//, '') || 'postgres';
                        } catch(e){}
                    }

                    const localUrl = `postgresql://postgres@127.0.0.1:${boundPort}/${dbName}?sslmode=disable`;
                    
                    // Flags for Prisma Postgres/Pooler: --no-owner --no-privileges --no-comments to avoid permission errors
                    const command = `${pgDumpPath} "${localUrl}" -f "${filepath}" --no-owner --no-privileges --no-comments --column-inserts --inserts`;

                    console.log(`Executing: pg_dump via tunnel to ${filename}...`);
                    const { stderr } = await execAsync(command);

                    if (stderr) console.log('pg_dump info:', stderr);
                    console.log(`Backup completed successfully!`);
                    console.log(`File saved to: ${filepath}`);
                    backupCompleted = true;
                } catch (error: any) {
                    console.error('Backup failed:', error.message || error);
                    if (fs.existsSync(filepath)) try { fs.unlinkSync(filepath); } catch(e){}
                } finally {
                    tunnel.kill();
                    process.exit(backupCompleted ? 0 : 1);
                }
            }
        });

        setTimeout(() => {
            if (!boundPort) {
                console.error('Error: Timeout waiting for tunnel port.');
                tunnel.kill();
                process.exit(1);
            }
        }, 30000);

    } else {
        // Standard PostgreSQL (Supabase, Local, etc.)
        const targetUrl = directUrl || databaseUrl;
        
        if (!targetUrl) {
            console.error('Error: No valid database URL found.');
            process.exit(1);
        }

        try {
            const url = new URL(targetUrl.replace('pgbouncer=true', ''));
            const password = decodeURIComponent(url.password);
            
            // Mask password in logs
            const maskedUrl = targetUrl.replace(url.password, '****');
            console.log(`Target: ${maskedUrl}`);

            // Use PGPASSWORD environment variable to handle special characters safely
            const env = { ...process.env, PGPASSWORD: password };
            
            // Supabase recommended flags: --no-owner --no-privileges --no-comments
            // This prevents errors on tables you don't have access to in a managed DB
            const command = `${pgDumpPath} -h ${url.hostname} -p ${url.port || '5432'} -U ${url.username} -d ${url.pathname.slice(1)} -f "${filepath}" --no-owner --no-privileges --no-comments`;

            console.log(`Executing pg_dump...`);
            const { stderr } = await execAsync(command, { env });
            
            if (stderr) console.log('pg_dump info:', stderr);
            
            console.log(`\x1b[32mSUCCESS: Backup completed!\x1b[0m`);
            console.log(`File: ${filepath}`);
        } catch (error: any) {
            console.error('\x1b[31mBackup failed:\x1b[0m', error.message || error);
            if (fs.existsSync(filepath)) try { fs.unlinkSync(filepath); } catch(e){}
            
            console.log('\x1b[33mTip: Check if your DIRECT_URL is correct and the database is accessible.\x1b[0m');
            process.exit(1);
        }
    }
}

backupDatabase();
