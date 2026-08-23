import { qrcodegen } from './vendor/qrcodegen.ts';
import {deflateSync} from 'node:zlib';

const qrCode=(payload:string)=>qrcodegen.QrCode.encodeText(payload,qrcodegen.QrCode.Ecc.QUARTILE);

export function renderQrSvg(payload: string) {
  const qr = qrCode(payload);
  const border = 4;
  const size = qr.size + border * 2;
  const path: string[] = [];

  for (let y = 0; y < qr.size; y += 1) {
    for (let x = 0; x < qr.size; x += 1) {
      if (qr.getModule(x, y)) path.push(`M${x + border},${y + border}h1v1h-1z`);
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="Business queue QR code"><rect width="100%" height="100%" fill="#fff"/><path d="${path.join('')}" fill="#000"/></svg>`;
}

export function qrSvgDataUrl(payload: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(renderQrSvg(payload))}`;
}

const crcTable=Array.from({length:256},(_,index)=>{let value=index;for(let bit=0;bit<8;bit+=1)value=(value&1)?0xEDB88320^(value>>>1):value>>>1;return value>>>0});
const crc32=(buffer:Buffer)=>{let crc=0xFFFFFFFF;for(const byte of buffer)crc=crcTable[(crc^byte)&0xFF]^(crc>>>8);return(crc^0xFFFFFFFF)>>>0};
const pngChunk=(type:string,data:Buffer)=>{const name=Buffer.from(type,'ascii');const body=Buffer.concat([name,data]);const length=Buffer.alloc(4);length.writeUInt32BE(data.length);const checksum=Buffer.alloc(4);checksum.writeUInt32BE(crc32(body));return Buffer.concat([length,body,checksum])};

export function renderQrPng(payload:string,targetSize=1200){
  const qr=qrCode(payload);const border=4;const modules=qr.size+border*2;const scale=Math.max(1,Math.floor(targetSize/modules));const size=modules*scale;
  const raw=Buffer.alloc((size+1)*size,255);
  for(let y=0;y<size;y+=1){const offset=y*(size+1);raw[offset]=0;for(let x=0;x<size;x+=1){const moduleX=Math.floor(x/scale)-border;const moduleY=Math.floor(y/scale)-border;raw[offset+x+1]=moduleX>=0&&moduleY>=0&&moduleX<qr.size&&moduleY<qr.size&&qr.getModule(moduleX,moduleY)?0:255}}
  const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(size,0);ihdr.writeUInt32BE(size,4);ihdr[8]=8;ihdr[9]=0;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),pngChunk('IHDR',ihdr),pngChunk('IDAT',deflateSync(raw,{level:9})),pngChunk('IEND',Buffer.alloc(0))]);
}

export function qrPngDataUrl(payload:string){return `data:image/png;base64,${renderQrPng(payload).toString('base64')}`}
