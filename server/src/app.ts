import express, { type ErrorRequestHandler } from 'express';
import session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';
import multer from 'multer';
import path from 'node:path';
import { ZodError } from 'zod';
import router from './routes.js';
import { config } from './config.js';
import { SQLiteSessionStore } from './db/session-store.js';

export function createApp(){
 const app=express(); app.disable('x-powered-by'); app.set('trust proxy',1); app.use(helmet({contentSecurityPolicy:config.production?undefined:false}));app.use(cors({origin:config.origin,credentials:true,methods:['GET','POST','PUT','OPTIONS'],allowedHeaders:['Content-Type','X-CSRF-Token']}));app.use(express.json({limit:'1mb'}));
 app.use(session({store:new SQLiteSessionStore(),name:'vdb.sid',secret:config.sessionSecret,resave:false,saveUninitialized:false,rolling:true,cookie:{httpOnly:true,sameSite:'strict',secure:config.production,maxAge:8*60*60*1000}}));
 app.use('/api',router);
 if(config.production){const client=path.resolve(process.cwd(),'../client/dist');app.use(express.static(client));app.use((req,res,next)=>req.accepts('html')?res.sendFile(path.join(client,'index.html')):next());}
 app.use((_q,res)=>res.status(404).json({error:'Not found'}));
 const errors:ErrorRequestHandler=(err,_req,res,_next)=>{if(err instanceof ZodError)return res.status(400).json({error:'Invalid request',issues:err.flatten()});if((err as any).code==='SQLITE_CONSTRAINT_UNIQUE')return res.status(409).json({error:'That value already exists'});if(err instanceof multer.MulterError)return res.status(400).json({error:err.code==='LIMIT_FILE_SIZE'?'Database file exceeds the upload-size limit':err.message});const status=(err as any).status||500;if(status>=500)console.error(err);res.status(status).json({error:err.message||'Internal server error',...((err as any).report?{report:(err as any).report}:{})});};app.use(errors);return app;
}
