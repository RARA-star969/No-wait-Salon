import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {Pool, type PoolClient} from 'pg';

export type DbResult={changes:number};
export interface Database {
  dialect:'sqlite'|'postgres';
  get<T=Record<string,unknown>>(sql:string,params?:unknown[]):Promise<T|undefined>;
  all<T=Record<string,unknown>>(sql:string,params?:unknown[]):Promise<T[]>;
  run(sql:string,params?:unknown[]):Promise<DbResult>;
  exec(sql:string):Promise<void>;
  transaction<T>(work:(db:Database)=>Promise<T>):Promise<T>;
  hasColumn(table:string,column:string):Promise<boolean>;
  close():Promise<void>;
}

const postgresSql=(sql:string)=>{let index=0;return sql.replace(/\?/g,()=>`$${++index}`)};

class SqliteDatabase implements Database{
  dialect='sqlite' as const;
  constructor(private readonly db:DatabaseSync){this.db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000')}
  async get<T>(sql:string,params:unknown[]=[]){return this.db.prepare(sql).get(...params as any[]) as T|undefined}
  async all<T>(sql:string,params:unknown[]=[]){return this.db.prepare(sql).all(...params as any[]) as T[]}
  async run(sql:string,params:unknown[]=[]){const result=this.db.prepare(sql).run(...params as any[]);return{changes:Number(result.changes)}}
  async exec(sql:string){this.db.exec(sql)}
  async transaction<T>(work:(db:Database)=>Promise<T>){this.db.exec('BEGIN IMMEDIATE');try{const value=await work(this);this.db.exec('COMMIT');return value}catch(error){try{this.db.exec('ROLLBACK')}catch{}throw error}}
  async hasColumn(table:string,column:string){const rows=await this.all<{name:string}>(`PRAGMA table_info(${table})`);return rows.some(row=>row.name===column)}
  async close(){this.db.close()}
}

class PostgresDatabase implements Database{
  dialect='postgres' as const;
  constructor(private readonly pool:Pool|PoolClient,private readonly owner?:Pool){}
  async get<T>(sql:string,params:unknown[]=[]){const result=await this.pool.query(postgresSql(sql),params);return result.rows[0] as T|undefined}
  async all<T>(sql:string,params:unknown[]=[]){const result=await this.pool.query(postgresSql(sql),params);return result.rows as T[]}
  async run(sql:string,params:unknown[]=[]){const result=await this.pool.query(postgresSql(sql),params);return{changes:result.rowCount||0}}
  async exec(sql:string){await this.pool.query(sql)}
  async transaction<T>(work:(db:Database)=>Promise<T>){if(!this.owner)return work(this);const client=await this.owner.connect();try{await client.query('BEGIN');const value=await work(new PostgresDatabase(client));await client.query('COMMIT');return value}catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}}
  async hasColumn(table:string,column:string){const row=await this.get('SELECT 1 present FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = ? AND column_name = ?',[table,column]);return Boolean(row)}
  async close(){if(this.owner)await this.owner.end();else if('end' in this.pool)await this.pool.end()}
}

export async function createDatabase(dataDir:string):Promise<Database>{
  const connectionString=process.env.DATABASE_URL?.trim();
  if(!connectionString)return new SqliteDatabase(new DatabaseSync(path.join(dataDir,'no-wait-salon.db')));
  const parsed=new URL(connectionString);
  if(!['localhost','127.0.0.1'].includes(parsed.hostname)&&parsed.searchParams.get('sslmode')==='require')parsed.searchParams.set('sslmode','verify-full');
  const pool=new Pool({connectionString:parsed.toString(),max:Number(process.env.DB_POOL_MAX||10),idleTimeoutMillis:30_000,connectionTimeoutMillis:10_000});
  await pool.query('SELECT 1');
  return new PostgresDatabase(pool,pool);
}
